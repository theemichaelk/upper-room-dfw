#!/usr/bin/env node
/**
 * Live smoke test against production (upperroomdfw.com).
 */
const https = require('https');

const BASE = process.env.URDFW_URL || 'https://upperroomdfw.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'michaelk@tsbrenterprises.com';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Kingme05$';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : null; } catch { /* raw */ }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail) => {
    if (ok) { console.log('  ✓', name, detail || ''); pass++; }
    else { console.log('  ✗', name, detail || ''); fail++; }
  };

  console.log('Production smoke test:', BASE);

  const health = await request('GET', '/api/health');
  check('health', health.status === 200 && health.body?.ok, health.body?.envReady ? JSON.stringify(health.body.envReady) : '');

  const listings = await request('GET', '/api/listings');
  check('public listings', listings.status === 200 && Array.isArray(listings.body) && listings.body.length > 0, '(' + (listings.body?.length || 0) + ')');

  const admin = await request('POST', '/api/auth/admin', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  check('admin login', admin.status === 200 && admin.body?.token);
  const token = admin.body?.token;

  if (token) {
    const stats = await request('GET', '/api/admin/stats', null, token);
    check('admin stats', stats.status === 200);

    const clients = await request('GET', '/api/clients', null, token);
    check('admin clients', clients.status === 200 && Array.isArray(clients.body));

    const support = await request('GET', '/api/support', null, token);
    check('admin support', support.status === 200 && Array.isArray(support.body));

    const claims = await request('GET', '/api/claims', null, token);
    check('claims API', claims.status === 200 && Array.isArray(claims.body));

    const webhooks = await request('GET', '/api/webhooks', null, token);
    check('webhooks API', webhooks.status === 200 && webhooks.body?.ok);

    const dns = await request('GET', '/api/dns/status', null, token);
    check('dns status', dns.status === 200 && dns.body?.ok);

    const integ = await request('GET', '/api/integrations/status', null, token);
    check('integrations status', integ.status === 200);

    const allListings = await request('GET', '/api/listings?status=all', null, token);
    check('all listings', allListings.status === 200 && Array.isArray(allListings.body));

    const seoPages = await request('GET', '/api/seo/pages', null, token);
    check('seo pages API', seoPages.status === 200 && seoPages.body?.ok && seoPages.body?.pages);

    const seoPatch = await request('PATCH', '/api/seo/pages/index.html', {
      title: 'Upper Room DFW | Church Directory',
      description: 'Find churches across Dallas–Fort Worth.',
      noindex: false,
    }, token);
    check('seo patch', seoPatch.status === 200 && seoPatch.body?.ok);
  } else {
    check('admin stats', false, 'no token');
    check('admin clients', false, 'no token');
    check('admin support', false, 'no token');
    check('claims API', false, 'no token');
    check('webhooks API', false, 'no token');
    check('dns status', false, 'no token');
    check('integrations status', false, 'no token');
    check('all listings', false, 'no token');
    check('seo pages API', false, 'no token');
    check('seo patch', false, 'no token');
  }

  const seoPublic = await request('GET', '/api/seo/page/index.html');
  check('seo public page', seoPublic.status === 200 && seoPublic.body?.ok);

  const html = await request('GET', '/admin.html');
  check('admin.html', html.status === 200 && (html.raw || '').includes('data-admin-tab="dns"'));

  const member = await request('GET', '/member-dashboard.html');
  check('member-dashboard.html', member.status === 200 && (member.raw || '').includes('data-member-tab="dns"'));

  console.log('\n--- PRODUCTION SMOKE ---');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });