const https = require('https');

function apiToken() {
  return process.env.TINYURL_API_TOKEN || '';
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

async function shortenUrl(url, opts = {}) {
  const token = apiToken();
  if (!token) return { ok: false, error: 'TINYURL_API_TOKEN not set' };
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: 'Valid http(s) URL required' };

  const payload = JSON.stringify({
    url,
    domain: opts.domain || 'tinyurl.com',
    alias: opts.alias || undefined,
    tags: opts.tags || undefined,
  });

  const res = await httpsJson('POST', 'https://api.tinyurl.com/create', {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  }, payload);

  if (res.status === 200 || res.status === 201) {
    const data = res.body?.data || res.body;
    return {
      ok: true,
      url: data?.url || url,
      tinyUrl: data?.tiny_url || data?.tinyUrl,
      alias: data?.alias,
    };
  }

  const err = res.body?.errors?.[0]?.message || res.body?.message || `HTTP ${res.status}`;
  return { ok: false, error: err };
}

async function verifyTinyUrl() {
  if (!apiToken()) return { ok: false, provider: 'tinyurl', error: 'TINYURL_API_TOKEN not set' };
  try {
    const test = await shortenUrl('https://upperroomdfw.com/health-check');
    if (test.ok) return { ok: true, provider: 'tinyurl', message: 'TinyURL API connected', sample: test.tinyUrl };
    return { ok: false, provider: 'tinyurl', error: test.error };
  } catch (err) {
    return { ok: false, provider: 'tinyurl', error: err.message };
  }
}

module.exports = { shortenUrl, verifyTinyUrl };