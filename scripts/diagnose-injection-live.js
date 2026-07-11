#!/usr/bin/env node
/**
 * Live zero-detection: verify nested pages load platform modules from correct paths.
 */
const https = require('https');

const BASE = process.env.URDFW_URL || 'https://upperroomdfw.com';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function checkAsset(url, label) {
  const r = await get(url);
  const ok = r.status === 200;
  console.log(ok ? '  ✓' : '  ✗', label, r.status, url.replace(BASE, ''));
  return ok;
}

async function main() {
  console.log('\n  Live Injection Diagnosis at', BASE, '\n');

  const pages = [
    { path: '/', label: 'index' },
    { path: '/churches/the-grove-community-church.html', label: 'church (depth 1)', base: '/../' },
    { path: '/templates/single/classic.html', label: 'template (depth 2)', base: '/../../' },
    { path: '/embed.html', label: 'embed widget' },
  ];

  let pass = 0;
  let fail = 0;

  for (const p of pages) {
    console.log('──', p.label, '──');
    const page = await get(BASE + p.path);
    if (page.status !== 200) {
      console.log('  ✗ page', page.status);
      fail++;
      continue;
    }
    pass++;

    const loaderMatch = page.body.match(/src=["']([^"']*platform\/loader\.js)["']/);
    const loaderSrc = loaderMatch ? loaderMatch[1] : 'js/platform/loader.js';
    const assetBase = loaderSrc.replace(/js\/platform\/loader\.js$/, '');

    const assets = [
      assetBase + 'js/platform/00-core.js',
      assetBase + 'data/platform-config.json',
      assetBase + 'css/responsive.css',
    ];

    for (const a of assets) {
      const url = BASE + '/' + a.replace(/^\//, '').replace(/^\.\.\//, '');
      const resolved = new URL(a, BASE + p.path).href;
      const r = await get(resolved);
      const ok = r.status === 200;
      console.log(ok ? '  ✓' : '  ✗', r.status, a);
      if (ok) pass++; else fail++;
    }
    console.log('');
  }

  console.log('--- LIVE RESULT ---');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });