#!/usr/bin/env node
/**
 * Live smoke test against production (upperroomdfw.com).
 * Run twice (double-test) to confirm stability.
 */
const https = require('https');

const BASE = process.env.URDFW_URL || 'https://upperroomdfw.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'michaelk@tsbrenterprises.com';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Kingme05$';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

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

async function runSuite(label) {
  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail) => {
    if (ok) { console.log('  ✓', name, detail || ''); pass++; }
    else { console.log('  ✗', name, detail || ''); fail++; }
  };

  console.log(`\n=== ${label} ===`);
  console.log('Target:', BASE);

  const health = await request('GET', '/api/health');
  check('health', health.status === 200 && health.body?.ok, health.body?.envReady ? JSON.stringify(health.body.envReady) : '');

  const config = await request('GET', '/api/config');
  check('public config', config.status === 200 && config.body?.integrations);
  const integCfg = config.body?.integrations || {};
  check('config stripe from env', !!integCfg.stripe?.enabled || integCfg.stripe?.mode);

  const listings = await request('GET', '/api/listings');
  check('public listings', listings.status === 200 && Array.isArray(listings.body) && listings.body.length > 0, '(' + (listings.body?.length || 0) + ')');

  const admin = await request('POST', '/api/auth/admin', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  check('admin login', admin.status === 200 && admin.body?.token);
  const adminToken = admin.body?.token;

  if (adminToken) {
    const stats = await request('GET', '/api/admin/stats', null, adminToken);
    check('admin stats', stats.status === 200);

    const platform = await request('GET', '/api/platform/integrations', null, adminToken);
    check('platform integrations', platform.status === 200 && platform.body?.ok && platform.body?.source === 'env');
    const prov = platform.body?.providers || {};
    const envKeys = ['mailchimp', 'vbout', 'acumbamail'].filter((p) => prov[p]?.apiKeySet);
    check('platform .env keys', envKeys.length >= 2, envKeys.join(', ') || 'none');

    const integ = await request('GET', '/api/integrations/status', null, adminToken);
    check('integrations status', integ.status === 200 && Array.isArray(integ.body?.results));
    const connected = (integ.body?.results || []).filter((r) => r.ok).map((r) => r.provider);
    check('integrations live', connected.length >= 4, connected.join(', '));

    const seoPages = await request('GET', '/api/seo/pages', null, adminToken);
    check('seo pages API', seoPages.status === 200 && seoPages.body?.ok && seoPages.body?.pages);

    const adminMemberBlock = await request('GET', '/api/client/integrations', null, adminToken);
    check('admin blocked from client integrations', adminMemberBlock.status === 403 && adminMemberBlock.body?.ok === false);
  } else {
    check('platform integrations', false, 'no admin token');
    check('integrations status', false, 'no admin token');
  }

  const testEmail = `smoke-${Date.now()}@urdfw-test.local`;
  const reg = await request('POST', '/api/auth/register', {
    name: 'Smoke Test Church',
    email: testEmail,
    password: 'SmokeTest99!',
    area: 'Dallas',
    category: 'Church',
    description: 'Production smoke test member',
    package: 'Standard',
  });
  check('member register', reg.status === 200 && reg.body?.token);
  const memberToken = reg.body?.token;
  const clientId = reg.body?.client?.id;
  const listingId = reg.body?.client?.listingId || reg.body?.client?.listing_id;

  if (memberToken) {
    const trainingGet = await request('GET', '/api/training', null, memberToken);
    check('member training GET', trainingGet.status === 200 && trainingGet.body?.ok && Array.isArray(trainingGet.body?.completed));

    const trainingPatch = await request('PATCH', '/api/training', { moduleId: 1, complete: true }, memberToken);
    check('member training PATCH', trainingPatch.status === 200 && trainingPatch.body?.completed?.includes(1));

    const trainingVerify = await request('GET', '/api/training', null, memberToken);
    check('member training persisted', trainingVerify.body?.completed?.includes(1));

    const mediaGet = await request('GET', '/api/media?listingId=' + encodeURIComponent(listingId || 'general'), null, memberToken);
    check('member media GET', mediaGet.status === 200 && mediaGet.body?.ok && Array.isArray(mediaGet.body?.assets));

    const mediaPost = await request('POST', '/api/media', {
      listingId: listingId || 'general',
      clientId,
      name: 'smoke-test.png',
      dataUrl: TINY_PNG,
    }, memberToken);
    check('member media POST', mediaPost.status === 200 && mediaPost.body?.ok && mediaPost.body?.asset?.url);
    const assetId = mediaPost.body?.asset?.id;

    const mediaList2 = await request('GET', '/api/media?listingId=' + encodeURIComponent(listingId || 'general'), null, memberToken);
    check('member media listed', (mediaList2.body?.assets || []).some((a) => a.id === assetId));

    if (assetId) {
      const mediaDel = await request('DELETE', '/api/media/' + assetId, null, memberToken);
      check('member media DELETE', mediaDel.status === 200 && mediaDel.body?.ok);
    }

    const memberIntegGet = await request('GET', '/api/client/integrations', null, memberToken);
    check('member integrations GET', memberIntegGet.status === 200 && memberIntegGet.body?.ok);

    const memberIntegPatch = await request('PATCH', '/api/client/integrations/mailchimp', {
      listId: 'smoke-list',
      apiKey: 'test-key-smoke-' + Date.now(),
      enabled: true,
    }, memberToken);
    check('member integrations PATCH', memberIntegPatch.status === 200 && memberIntegPatch.body?.ok && memberIntegPatch.body?.config?.apiKeySet);

    const memberIntegVerify = await request('GET', '/api/client/integrations', null, memberToken);
    check('member integrations saved', memberIntegVerify.body?.integrations?.mailchimp?.apiKeySet === true);
  } else {
    check('member training GET', false, 'no member token');
    check('member media POST', false, 'no member token');
    check('member integrations GET', false, 'no member token');
  }

  const seoPublic = await request('GET', '/api/seo/page/index.html');
  check('seo public page', seoPublic.status === 200 && seoPublic.body?.ok);

  const html = await request('GET', '/admin.html');
  check('admin.html', html.status === 200 && (html.raw || '').includes('data-admin-tab="integrations"'));

  const member = await request('GET', '/member-dashboard.html');
  check('member-dashboard.html', member.status === 200 && (member.raw || '').includes('member-platform-profile'));
  const dashJs = await request('GET', '/js/platform/16-dashboards.js');
  check('member integrations UI', dashJs.status === 200 && (dashJs.raw || '').includes('member-integrations-panel'));

  console.log(`--- ${label} ---`);
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  return { pass, fail };
}

async function main() {
  console.log('Production smoke test (double-run):', BASE);
  const r1 = await runSuite('PASS 1');
  const r2 = await runSuite('PASS 2');
  const totalFail = r1.fail + r2.fail;
  console.log('\n=== DOUBLE-TEST SUMMARY ===');
  console.log(`Pass 1: ${r1.pass}/${r1.pass + r1.fail}  Pass 2: ${r2.pass}/${r2.pass + r2.fail}`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });