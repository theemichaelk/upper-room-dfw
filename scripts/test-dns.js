#!/usr/bin/env node
const http = require('http');

const BASE = process.env.URDFW_URL || 'http://localhost:8000';

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
    const lib = url.protocol === 'https:' ? require('https') : http;
    const req = lib.request(opts, (res) => {
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

  console.log('DNS tests at', BASE);

  const admin = await request('POST', '/api/auth/admin', {
    email: 'michaelk@tsbrenterprises.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  check('admin login', admin.status === 200 && admin.body?.token);
  const token = admin.body?.token;
  if (!token) {
    console.log('\n--- DNS RESULT ---');
    console.log(`PASS: ${pass}  FAIL: ${fail + 1}`);
    process.exit(1);
  }

  const status = await request('GET', '/api/dns/status', null, token);
  check('dns status', status.status === 200 && status.body?.ok);
  check('route53 connected', status.body?.route53?.ok === true);

  const sites = await request('GET', '/api/dns/sites', null, token);
  check('list sites', sites.status === 200 && Array.isArray(sites.body?.sites));
  check('platform sites seeded', (sites.body?.sites || []).some((s) => s.domain === 'upperroomdfw.com'));
  check('quantum site seeded', (sites.body?.sites || []).some((s) => s.domain === 'quantumpages.ai'));

  const siteId = sites.body?.sites?.[0]?.id;
  if (siteId) {
    const add = await request('POST', `/api/dns/sites/${siteId}/records`, {
      name: '_urdfw-test',
      type: 'TXT',
      value: 'dns-test-' + Date.now(),
      ttl: 60,
    }, token);
    check('add TXT record', add.status === 200 && add.body?.record?.id);
    const recId = add.body?.record?.id;
    if (recId) {
      const del = await request('DELETE', `/api/dns/records/${recId}`, null, token);
      check('delete record', del.status === 200 && del.body?.ok);
    }
  } else {
    check('add TXT record', false);
    check('delete record', false);
  }

  console.log('\n--- DNS RESULT ---');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });