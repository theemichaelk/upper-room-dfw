/**
 * Google Analytics 4 (Data API) + Search Console traffic for admin dashboard.
 *
 * Env (service account recommended):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
 *   # or GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
 *   GA4_PROPERTY_ID=123456789          # numeric, or properties/123456789
 *   GSC_SITE_URL=https://upperroomdfw.com/
 *   GA4_MEASUREMENT_ID=G-XXXX          # display only (already in site settings)
 *
 * Service account must have:
 *   - GA4: Viewer on the property
 *   - GSC: Full or Restricted user on the property + API enabled
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SCOPES = [GA4_SCOPE, GSC_SCOPE].join(' ');

let cachedToken = null;
let cachedTokenExp = 0;

function loadServiceAccount() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const j = JSON.parse(raw);
      return {
        clientEmail: j.client_email,
        privateKey: String(j.private_key || '').replace(/\\n/g, '\n'),
      };
    } catch (e) {
      return { error: 'Failed to read GOOGLE_APPLICATION_CREDENTIALS: ' + e.message };
    }
  }
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    return { error: 'missing_credentials' };
  }
  return { clientEmail, privateKey };
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.privateKey);
  return `${unsigned}.${sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

function httpsJson(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { raw: text };
        }
        if (res.statusCode >= 400) {
          const err = new Error(json.error?.message || json.error_description || text.slice(0, 200) || `HTTP ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = json;
          return reject(err);
        }
        resolve(json);
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExp - 60_000) return cachedToken;
  const sa = loadServiceAccount();
  if (sa.error) throw new Error(sa.error);
  const assertion = signJwt(sa);
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();
  const data = await httpsJson('POST', TOKEN_URL, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
    body: form,
  });
  cachedToken = data.access_token;
  cachedTokenExp = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

function ga4PropertyId() {
  const raw = (process.env.GA4_PROPERTY_ID || '').trim();
  if (!raw) return '';
  return raw.startsWith('properties/') ? raw.replace(/^properties\//, '') : raw;
}

function gscSiteUrl() {
  return (process.env.GSC_SITE_URL || process.env.APP_URL || 'https://upperroomdfw.com').replace(/\/?$/, '/') ;
}

function configStatus() {
  const sa = loadServiceAccount();
  return {
    credentials: !sa.error,
    credentialsError: sa.error === 'missing_credentials' ? null : sa.error || null,
    ga4PropertyId: ga4PropertyId() || null,
    gscSiteUrl: gscSiteUrl(),
    measurementId: process.env.GA4_MEASUREMENT_ID || null,
  };
}

async function fetchGa4Report(days = 28) {
  const propertyId = ga4PropertyId();
  if (!propertyId) return { configured: false, reason: 'GA4_PROPERTY_ID not set' };
  const token = await getAccessToken();
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const body = {
    dateRanges: [
      {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    dimensions: [{ name: 'date' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  };
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const report = await httpsJson('POST', url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const byDay = (report.rows || []).map((row) => {
    const d = row.dimensionValues?.[0]?.value || '';
    const date = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
    return {
      date,
      sessions: Number(row.metricValues?.[0]?.value || 0),
      users: Number(row.metricValues?.[1]?.value || 0),
      pageViews: Number(row.metricValues?.[2]?.value || 0),
      bounceRate: Number(row.metricValues?.[3]?.value || 0),
      avgSessionDuration: Number(row.metricValues?.[4]?.value || 0),
    };
  });

  const totals = byDay.reduce(
    (a, r) => {
      a.sessions += r.sessions;
      a.users += r.users;
      a.pageViews += r.pageViews;
      return a;
    },
    { sessions: 0, users: 0, pageViews: 0 }
  );

  // Top pages (second request)
  let topPages = [];
  try {
    const pagesBody = {
      dateRanges: body.dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    };
    const pagesReport = await httpsJson('POST', url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: pagesBody,
    });
    topPages = (pagesReport.rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      pageViews: Number(row.metricValues?.[0]?.value || 0),
      users: Number(row.metricValues?.[1]?.value || 0),
    }));
  } catch {
    /* optional */
  }

  return {
    configured: true,
    propertyId,
    rangeDays: days,
    totals,
    byDay,
    topPages,
  };
}

async function fetchGscReport(days = 28) {
  const siteUrl = gscSiteUrl();
  if (!siteUrl) return { configured: false, reason: 'GSC_SITE_URL not set' };
  const token = await getAccessToken();
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const encoded = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dimensions: ['query'],
    rowLimit: 15,
  };
  const data = await httpsJson('POST', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });

  const queries = (data.rows || []).map((r) => ({
    query: r.keys?.[0] || '',
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));

  // By page
  let pages = [];
  try {
    const pageBody = {
      startDate: body.startDate,
      endDate: body.endDate,
      dimensions: ['page'],
      rowLimit: 10,
    };
    const pageData = await httpsJson('POST', url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: pageBody,
    });
    pages = (pageData.rows || []).map((r) => ({
      page: r.keys?.[0] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));
  } catch {
    /* optional */
  }

  // Daily clicks
  let byDay = [];
  try {
    const dayBody = {
      startDate: body.startDate,
      endDate: body.endDate,
      dimensions: ['date'],
      rowLimit: 90,
    };
    const dayData = await httpsJson('POST', url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: dayBody,
    });
    byDay = (dayData.rows || [])
      .map((r) => ({
        date: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    /* optional */
  }

  const totals = queries.reduce(
    (a, q) => {
      a.clicks += q.clicks;
      a.impressions += q.impressions;
      return a;
    },
    { clicks: 0, impressions: 0 }
  );
  // Prefer day totals if available
  if (byDay.length) {
    totals.clicks = byDay.reduce((s, d) => s + d.clicks, 0);
    totals.impressions = byDay.reduce((s, d) => s + d.impressions, 0);
  }

  return {
    configured: true,
    siteUrl,
    rangeDays: days,
    totals,
    topQueries: queries,
    topPages: pages,
    byDay,
  };
}

async function fetchGoogleTraffic({ days = 28 } = {}) {
  const status = configStatus();
  if (!status.credentials) {
    return {
      ok: true,
      configured: false,
      reason: 'Google service account not configured',
      setup: {
        env: [
          'GOOGLE_SERVICE_ACCOUNT_EMAIL',
          'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
          'GA4_PROPERTY_ID',
          'GSC_SITE_URL',
        ],
        note: 'Create a GCP service account, enable Analytics Data API + Search Console API, grant GA4 Viewer + GSC access, paste keys in .env',
      },
      config: status,
      ga4: null,
      gsc: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const out = {
    ok: true,
    configured: true,
    config: status,
    ga4: null,
    gsc: null,
    errors: [],
    generatedAt: new Date().toISOString(),
  };

  try {
    out.ga4 = await fetchGa4Report(days);
  } catch (e) {
    out.errors.push({ source: 'ga4', message: e.message });
    out.ga4 = { configured: !!status.ga4PropertyId, error: e.message };
  }

  try {
    out.gsc = await fetchGscReport(days);
  } catch (e) {
    out.errors.push({ source: 'gsc', message: e.message });
    out.gsc = { configured: true, error: e.message };
  }

  return out;
}

module.exports = {
  fetchGoogleTraffic,
  configStatus,
  ga4PropertyId,
  gscSiteUrl,
};
