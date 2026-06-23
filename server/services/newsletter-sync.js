const crypto = require('crypto');
const https = require('https');

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
        try { parsed = data ? JSON.parse(data) : null; } catch { /* raw */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function mailchimpPrefix() {
  if (process.env.MAILCHIMP_SERVER_PREFIX) return process.env.MAILCHIMP_SERVER_PREFIX;
  const key = process.env.MAILCHIMP_API_KEY || '';
  const parts = key.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

async function syncToMailchimp(email, listId) {
  const key = process.env.MAILCHIMP_API_KEY;
  const prefix = mailchimpPrefix();
  const list = listId || process.env.MAILCHIMP_LIST_ID;
  if (!key || !prefix) return { ok: false, provider: 'mailchimp', error: 'MAILCHIMP_API_KEY not set' };
  if (!list) return { ok: false, provider: 'mailchimp', error: 'Mailchimp list ID required' };

  const auth = Buffer.from(`anystring:${key}`).toString('base64');
  const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  const payload = JSON.stringify({
    email_address: email,
    status_if_new: 'subscribed',
    status: 'subscribed',
  });

  const put = await httpsJson(
    'PUT',
    `https://${prefix}.api.mailchimp.com/3.0/lists/${encodeURIComponent(list)}/members/${hash}`,
    { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    payload
  );

  if (put.status === 200 || put.status === 201) {
    return { ok: true, provider: 'mailchimp', message: 'Subscribed to Mailchimp' };
  }
  const err = put.body?.detail || put.body?.title || `HTTP ${put.status}`;
  return { ok: false, provider: 'mailchimp', error: err };
}

async function syncToVbout(email, listId) {
  const key = process.env.VBOUT_API_KEY;
  const list = listId || process.env.VBOUT_LIST_ID;
  if (!key) return { ok: false, provider: 'vbout', error: 'VBOUT_API_KEY not set' };
  if (!list) return { ok: false, provider: 'vbout', error: 'Vbout list ID required' };

  const url = `https://api.vbout.com/1/emailmarketing/addcontact.json?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&listid=${encodeURIComponent(list)}&status=1`;
  const res = await httpsJson('GET', url);
  const header = res.body?.response?.header;
  const data = res.body?.response?.data;
  if (res.status === 200 && header?.status === 'ok') {
    const already = (data?.error || data?.item || '').toLowerCase().includes('already exists');
    if (!data?.error || already) {
      return { ok: true, provider: 'vbout', message: already ? 'Already on Vbout list' : 'Added to Vbout list' };
    }
  }
  const err = data?.error || data?.item || res.body?.error?.message || `HTTP ${res.status}`;
  return { ok: false, provider: 'vbout', error: err };
}

async function syncToAcumbamail(email, listId) {
  const key = process.env.ACUMBAMAIL_API_KEY;
  const list = listId || process.env.ACUMBAMAIL_LIST_ID;
  if (!key) return { ok: false, provider: 'acumbamail', error: 'ACUMBAMAIL_API_KEY not set (optional)' };
  if (!list) return { ok: false, provider: 'acumbamail', error: 'Acumbamail list ID required' };

  const body = new URLSearchParams({ auth_token: key, list_id: list, email }).toString();
  const res = await httpsJson('POST', 'https://acumbamail.com/api/1/addSubscriber/', {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  }, body);

  if (res.status === 200 && (res.body?.success || res.body?.id)) {
    return { ok: true, provider: 'acumbamail', message: 'Added to Acumbamail' };
  }
  return { ok: false, provider: 'acumbamail', error: res.body?.error || `HTTP ${res.status}` };
}

async function syncEmailToProviders(email, db, providers) {
  const { getIntegrationSettings } = require('./platform-settings');
  const list = providers || ['mailchimp', 'vbout', 'acumbamail'];
  const results = [];

  for (const provider of list) {
    const cfg = getIntegrationSettings(db, provider);
    if (cfg.enabled === false) {
      results.push({ ok: false, provider, error: 'disabled' });
      continue;
    }
    const listId = cfg.listId || null;
    let r;
    if (provider === 'mailchimp') r = await syncToMailchimp(email, listId);
    else if (provider === 'vbout') r = await syncToVbout(email, listId);
    else if (provider === 'acumbamail') r = await syncToAcumbamail(email, listId);
    else r = { ok: false, provider, error: 'Unknown provider' };
    results.push(r);
    db.prepare('INSERT INTO integration_log (action, provider, status, email, at) VALUES (?, ?, ?, ?, ?)').run(
      'sync', provider, r.ok ? 'ok' : 'error', email, new Date().toISOString()
    );
  }

  const okCount = results.filter((r) => r.ok).length;
  return { ok: okCount > 0, synced: okCount, results };
}

module.exports = {
  syncToMailchimp,
  syncToVbout,
  syncToAcumbamail,
  syncEmailToProviders,
};