const https = require('https');
const { getStripe, isStripeEnabled } = require('./stripe');
const { getTransporter } = require('./email');

function mailchimpPrefix() {
  const key = process.env.MAILCHIMP_API_KEY || '';
  if (process.env.MAILCHIMP_SERVER_PREFIX) return process.env.MAILCHIMP_SERVER_PREFIX;
  const parts = key.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function httpsJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: headers || {},
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function verifyStripe() {
  if (!isStripeEnabled()) return { ok: false, provider: 'stripe', error: 'STRIPE_SECRET_KEY not set' };
  try {
    const s = getStripe();
    await s.balance.retrieve();
    const mode = process.env.STRIPE_MODE || (process.env.NODE_ENV === 'production' ? 'live' : 'test');
    const prices = {
      standard: !!process.env.STRIPE_PRICE_STANDARD,
      premium: !!process.env.STRIPE_PRICE_PREMIUM,
    };
    return {
      ok: true,
      provider: 'stripe',
      mode,
      pricesConfigured: prices.standard && prices.premium,
      prices,
      message: prices.standard && prices.premium
        ? 'Stripe API connected; price IDs configured'
        : 'Stripe API connected; set STRIPE_PRICE_STANDARD and STRIPE_PRICE_PREMIUM for checkout',
    };
  } catch (err) {
    return { ok: false, provider: 'stripe', error: err.message };
  }
}

async function verifyMailchimp() {
  const key = process.env.MAILCHIMP_API_KEY;
  const prefix = mailchimpPrefix();
  if (!key || !prefix) return { ok: false, provider: 'mailchimp', error: 'MAILCHIMP_API_KEY not set' };
  try {
    const auth = Buffer.from(`anystring:${key}`).toString('base64');
    const res = await httpsJson('GET', `https://${prefix}.api.mailchimp.com/3.0/ping`, {
      Authorization: `Basic ${auth}`,
    });
    if (res.status === 200) {
      return { ok: true, provider: 'mailchimp', server: prefix, message: res.body?.health_status || 'connected' };
    }
    return { ok: false, provider: 'mailchimp', error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, provider: 'mailchimp', error: err.message };
  }
}

async function verifyVbout() {
  const key = process.env.VBOUT_API_KEY;
  if (!key) return { ok: false, provider: 'vbout', error: 'VBOUT_API_KEY not set' };
  try {
    const res = await httpsJson('GET', `https://api.vbout.com/1/emailmarketing.json?key=${encodeURIComponent(key)}`);
    if (res.status === 200 && res.body && !res.body.error) {
      return { ok: true, provider: 'vbout', message: 'API key accepted' };
    }
    const errMsg = res.body?.error?.message || res.body?.message || `HTTP ${res.status}`;
    return { ok: false, provider: 'vbout', error: errMsg };
  } catch (err) {
    return { ok: false, provider: 'vbout', error: err.message };
  }
}

async function verifyPaypal() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) return { ok: false, provider: 'paypal', error: 'PayPal credentials not set' };
  const mode = (process.env.PAYPAL_MODE || 'live').toLowerCase();
  const host = mode === 'sandbox' ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
  try {
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const body = 'grant_type=client_credentials';
    const res = await httpsJson('POST', `https://${host}/v1/oauth2/token`, {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    }, body);
    if (res.status === 200 && res.body?.access_token) {
      return {
        ok: true,
        provider: 'paypal',
        mode,
        nvpConfigured: !!(process.env.PAYPAL_API_USERNAME && process.env.PAYPAL_API_PASSWORD && process.env.PAYPAL_API_SIGNATURE),
        message: 'OAuth token retrieved',
      };
    }
    return { ok: false, provider: 'paypal', error: res.body?.error_description || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, provider: 'paypal', error: err.message };
  }
}

async function verifyAcumbamail() {
  const key = process.env.ACUMBAMAIL_API_KEY;
  if (!key) return { ok: false, provider: 'acumbamail', error: 'ACUMBAMAIL_API_KEY not set' };
  try {
    const body = 'auth_token=' + encodeURIComponent(key);
    const res = await httpsJson('POST', 'https://acumbamail.com/api/1/getLists/', {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    }, body);
    if (res.status === 200 && res.body && typeof res.body === 'object') {
      const smtp = await verifySmtp().catch((err) => ({ ok: false, error: err.message }));
      const smtpBlocked = !smtp.ok && (smtp.error || '').includes('535');
      return {
        ok: true,
        provider: 'acumbamail',
        lists: Object.keys(res.body).length,
        smtpRelay: smtp.ok,
        smtpError: smtp.ok ? null : (smtp.error || 'SMTP relay not verified'),
        smtpActivationRequired: smtpBlocked,
        message: smtp.ok
          ? 'Acumbamail API + SMTP relay connected'
          : smtpBlocked
            ? 'Acumbamail API OK — SMTP relay not active yet. Contact Acumbamail technical support to activate transactional SMTP.'
            : 'Acumbamail API OK — SMTP relay not verified',
      };
    }
    return { ok: false, provider: 'acumbamail', error: res.body?.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, provider: 'acumbamail', error: err.message };
  }
}

async function verifySmtp() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return { ok: false, provider: 'smtp', error: 'SMTP_HOST/SMTP_USER not set' };
  }
  try {
    const transport = getTransporter();
    if (typeof transport.verify !== 'function') {
      return { ok: true, provider: 'smtp', message: 'Dev mail transport (no SMTP verify)' };
    }
    await transport.verify();
    const relay = process.env.SMTP_PROVIDER
      || (process.env.SMTP_HOST?.includes('acumbamail') ? 'acumbamail' : 'smtp');
    return {
      ok: true,
      provider: 'smtp',
      relay,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || '587',
      from: process.env.EMAIL_FROM || null,
      message: `${relay} SMTP connection verified`,
    };
  } catch (err) {
    const msg = err.message || '';
    const activationHint = msg.includes('535') && process.env.SMTP_HOST?.includes('acumbamail')
      ? ' — contact Acumbamail support to activate SMTP relay (transactional email package required)'
      : '';
    return { ok: false, provider: 'smtp', error: msg + activationHint };
  }
}

function integrationConfig() {
  return {
    stripe: { enabled: isStripeEnabled(), mode: process.env.STRIPE_MODE || 'test' },
    mailchimp: { enabled: !!process.env.MAILCHIMP_API_KEY, server: mailchimpPrefix() },
    vbout: { enabled: !!process.env.VBOUT_API_KEY },
    paypal: {
      enabled: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      mode: process.env.PAYPAL_MODE || 'live',
      nvp: !!(process.env.PAYPAL_API_USERNAME && process.env.PAYPAL_API_PASSWORD),
    },
    smtp: {
      enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      provider: process.env.SMTP_PROVIDER
        || (process.env.SMTP_HOST?.includes('acumbamail') ? 'acumbamail' : 'smtp'),
      host: process.env.SMTP_HOST || null,
    },
    acumbamail: { enabled: !!process.env.ACUMBAMAIL_API_KEY },
    tinyurl: { enabled: !!process.env.TINYURL_API_TOKEN },
    mailchimpListId: process.env.MAILCHIMP_LIST_ID || null,
    vboutListId: process.env.VBOUT_LIST_ID || null,
    route53: { enabled: !!process.env.ROUTE53_HOSTED_ZONE_ID, hostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID || null },
  };
}

async function verifyAll() {
  const { verifyTinyUrl } = require('./tinyurl');
  const { verifyDns } = require('./dns');
  const results = await Promise.all([
    verifyStripe(),
    verifyMailchimp(),
    verifyVbout(),
    verifyPaypal(),
    verifySmtp(),
    verifyAcumbamail(),
    verifyTinyUrl(),
    verifyDns(),
  ]);
  return {
    ok: results.every((r) => r.ok),
    config: integrationConfig(),
    results,
  };
}

module.exports = {
  integrationConfig,
  verifyAll,
  verifyStripe,
  verifyMailchimp,
  verifyVbout,
  verifyPaypal,
  verifySmtp,
  verifyAcumbamail,
};