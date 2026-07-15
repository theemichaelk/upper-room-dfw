#!/usr/bin/env node
const http = require('http');
const https = require('https');

const BASE = process.env.URDFW_URL || 'http://localhost:8000';

function httpClient(url) {
  return url.protocol === 'https:' ? https : http;
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const req = httpClient(url).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  let pass = 0;
  let fail = 0;
  const check = (name, ok) => {
    if (ok) { console.log('  ✓', name); pass++; }
    else { console.log('  ✗', name); fail++; }
  };

  console.log('API tests at', BASE);

  const health = await request('GET', '/api/health');
  check('health endpoint', health.status === 200 && health.body?.ok);
  check('listings seeded', (await request('GET', '/api/listings')).body?.length > 0);

  const sitePublic = await request('GET', '/api/platform/site-settings/public');
  check('site-settings public', sitePublic.status === 200 && sitePublic.body?.version);

  const reg = await request('POST', '/api/auth/register', {
    name: 'API Test Church',
    email: `test-${Date.now()}@example.com`,
    password: 'testpass123',
    area: 'Dallas',
    category: 'Church',
    description: 'Test registration',
    package: 'Standard',
  });
  check('register', reg.status === 200 && reg.body?.token);
  const token = reg.body?.token;

  const me = await request('GET', '/api/auth/me', null, token);
  check('auth me', me.status === 200 && me.body?.client?.email);

  const billing = await request('POST', '/api/billing/charge', { plan: 'standard', amount: 29 }, token);
  check(
    'billing charge (dev or stripe)',
    billing.status === 200 && billing.body?.ok && (billing.body?.checkoutUrl || billing.body?.order)
  );

  const isRemote = BASE.startsWith('https://');
  const adminPass = process.env.ADMIN_PASSWORD || (isRemote ? '' : 'admin123');
  if (!adminPass && isRemote) {
    console.log('  ⊘ admin login tests skipped (set ADMIN_PASSWORD for remote)');
  } else {
    const admin = await request('POST', '/api/auth/admin', {
      email: 'michaelk@tsbrenterprises.com',
      password: adminPass,
    });
    check('admin login (michaelk)', admin.status === 200 && admin.body?.token);

    const admin2 = await request('POST', '/api/auth/admin', {
      email: 'theesaintmichael@gmail.com',
      password: adminPass,
    });
    check('admin login (theesaintmichael)', admin2.status === 200 && admin2.body?.token);
  }

  console.log('\n--- API RESULT ---');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });