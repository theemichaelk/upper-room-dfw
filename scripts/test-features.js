#!/usr/bin/env node
/**
 * Automated feature verification against live dev server
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.URDFW_URL || 'http://localhost:8000').replace(/\/$/, '');

function httpClient(url) {
  return url.protocol === 'https:' ? https : http;
}
const ROOT = path.join(__dirname, '..');

const PAGES = [
  'index.html', 'directory.html', 'feature-checklist.html',
  'submit-listing.html', 'claim-listing.html', 'widgets.html', 'embed.html',
  'shortcode-builder.html', 'field-builder.html', 'form-builder.html',
  'page-builder.html', 'collections.html', 'templates.html', 'signup.html',
  'billing-hub.html', 'csv-import.html', 'user-directory.html', 'messages.html',
  'support.html', 'register.html', 'admin.html', 'member-dashboard.html',
  'pricing.html', 'contact.html', 'features.html', 'about.html', 'go.html',
  'templates/single/classic.html', 'templates/multi/standard-multipage.html',
  'churches/the-grove-community-church.html',
];

const PLATFORM_FILES = [
  'js/platform/00-core.js', 'js/platform/01-display.js', 'js/platform/02-search.js',
  'js/platform/03-listings.js', 'js/platform/04-fields.js', 'js/platform/05-maps.js',
  'js/platform/06-reviews.js', 'js/platform/07-media.js', 'js/platform/08-users.js',
  'js/platform/09-billing.js', 'js/platform/10-admin.js', 'js/platform/11-integrations.js',
  'js/platform/12-embed.js', 'js/platform/13-seo.js', 'js/platform/14-bookmarks.js',
  'js/platform/15-global-init.js', 'js/platform/16-dashboards.js',
  'js/platform/17-api-bridge.js', 'js/platform/18-portal.js', 'js/platform/19-member-portal.js', 'js/platform/loader.js',
  'css/platform.css', 'css/responsive.css', 'css/portal.css',
  'data/platform-config.json', 'data/injection-config.json',
  'data/i18n/en.json', 'data/i18n/es.json', 'data/i18n/ar.json',
];

function fetch(path, redirects = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.replace(/^\//, ''), BASE + '/');
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
    };
    httpClient(url).get(opts, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        const next = res.headers.location.startsWith('http')
          ? new URL(res.headers.location).pathname.replace(/^\//, '')
          : res.headers.location.replace(/^\//, '');
        res.resume();
        return resolve(fetch(next, redirects + 1));
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, path }));
    }).on('error', reject);
  });
}

function checkPagePlatform(body, name) {
  const checks = [
    ['platform.css', body.includes('platform.css')],
    ['loader.js', body.includes('platform/loader.js')],
  ];
  return checks.map(([label, ok]) => ({ page: name, label, ok }));
}

async function main() {
  console.log('Testing Upper Room DFW Platform at', BASE);
  let pass = 0, fail = 0;

  for (const f of PLATFORM_FILES) {
    const r = await fetch(f);
    if (r.status === 200) { console.log('  ✓', f); pass++; }
    else { console.log('  ✗', f, r.status); fail++; }
  }

  for (const p of PAGES) {
    const r = await fetch(p);
    if (r.status === 200) { console.log('  ✓ page', p); pass++; }
    else { console.log('  ✗ page', p, r.status); fail++; }
  }

  const dir = await fetch('directory.html');
  const dirChecks = [
    ['display modes', dir.body.includes('urdfw-display-btn')],
    ['map draw', dir.body.includes('urdfw-map-toolbar')],
    ['facets', dir.body.includes('urdfw-facet-container')],
    ['multi-directory', dir.body.includes('urdfw-directory-select')],
    ['bootstrap grid', dir.body.includes('bootstrap')],
  ];
  dirChecks.forEach(([name, ok]) => {
    if (ok) { console.log('  ✓ directory:', name); pass++; }
    else { console.log('  ✗ directory:', name); fail++; }
  });

  const hubPages = ['index.html', 'member-dashboard.html', 'pricing.html', 'contact.html', 'billing-hub.html'];
  for (const p of hubPages) {
    const r = await fetch(p);
    checkPagePlatform(r.body, p).forEach(({ label, ok }) => {
      if (ok) { console.log(`  ✓ ${p}:`, label); pass++; }
      else { console.log(`  ✗ ${p}:`, label); fail++; }
    });
  }

  const church = await fetch('churches/the-grove-community-church.html');
  if (church.body.includes('platform/loader.js')) { console.log('  ✓ church page has platform'); pass++; }
  else { console.log('  ✗ church page missing platform'); fail++; }

  const pricing = await fetch('pricing.html');
  if (pricing.body.includes('pricing-coupon')) { console.log('  ✓ pricing: coupon UI'); pass++; }
  else { console.log('  ✗ pricing: coupon UI'); fail++; }

  const member = await fetch('member-dashboard.html');
  if (member.body.includes('payment-coupon')) { console.log('  ✓ member-dashboard: coupon field'); pass++; }
  else { console.log('  ✗ member-dashboard: coupon field'); fail++; }
  const memberPanels = [
    ['profile tab', 'member-platform-profile'],
    ['messages tab', 'member-platform-messages'],
    ['media tab', 'member-platform-media'],
    ['support tab', 'member-platform-support'],
    ['reviews tab', 'member-platform-reviews'],
    ['claims tab', 'member-platform-claims'],
    ['analytics tab', 'member-platform-analytics'],
    ['notifications tab', 'member-platform-notifications'],
    ['sidebar nav', 'member-sidebar-nav'],
  ];
  memberPanels.forEach(([name, id]) => {
    if (member.body.includes(id)) { console.log('  ✓ member-dashboard:', name); pass++; }
    else { console.log('  ✗ member-dashboard:', name); fail++; }
  });

  const admin = await fetch('admin.html');
  if (admin.body.includes('admin-platform-root')) { console.log('  ✓ admin: platform dashboard root'); pass++; }
  else { console.log('  ✗ admin: platform dashboard root'); fail++; }
  if (admin.body.includes('portal-login-card') && admin.body.includes('admin-login-form')) {
    console.log('  ✓ admin: portal login UI'); pass++;
  } else { console.log('  ✗ admin: portal login UI'); fail++; }
  if (admin.body.includes('admin-sidebar') && admin.body.includes('data-admin-tab')) {
    console.log('  ✓ admin: sidebar navigation'); pass++;
  } else { console.log('  ✗ admin: sidebar navigation'); fail++; }

  if (member.body.includes('portal-login') && member.body.includes('member-forgot-pass')) {
    console.log('  ✓ member-dashboard: portal login UI'); pass++;
  } else { console.log('  ✗ member-dashboard: portal login UI'); fail++; }

  const apiBridge = fs.readFileSync(path.join(ROOT, 'js/platform/17-api-bridge.js'), 'utf8');
  if (apiBridge.includes('integrations:') && apiBridge.includes('syncAll')) {
    console.log('  ✓ api-bridge: integrations API'); pass++;
  } else { console.log('  ✗ api-bridge: integrations API'); fail++; }

  const intModule = fs.readFileSync(path.join(ROOT, 'js/platform/11-integrations.js'), 'utf8');
  if (intModule.includes('testIntegration') && intModule.includes('getIntegrationLog')) {
    console.log('  ✓ integrations: API helpers'); pass++;
  } else { console.log('  ✗ integrations: API helpers'); fail++; }

  const dnsModule = fs.readFileSync(path.join(ROOT, 'js/platform/20-dns.js'), 'utf8');
  if (dnsModule.includes('renderDnsPanel') && dnsModule.includes('/dns/sites')) {
    console.log('  ✓ dns: management panel'); pass++;
  } else { console.log('  ✗ dns: management panel'); fail++; }
  if (admin.body.includes('data-admin-tab="dns"')) {
    console.log('  ✓ admin: DNS tab'); pass++;
  } else { console.log('  ✗ admin: DNS tab'); fail++; }
  if (member.body.includes('data-member-tab="dns"') && member.body.includes('member-platform-dns')) {
    console.log('  ✓ member: DNS tab'); pass++;
  } else { console.log('  ✗ member: DNS tab'); fail++; }

  const cfg = await fetch('data/platform-config.json');
  try {
    const j = JSON.parse(cfg.body);
    if (j.singlePageTemplates?.length === 16) { console.log('  ✓ 16 single templates in config'); pass++; }
    else { console.log('  ✗ template count', j.singlePageTemplates?.length); fail++; }
    if (j.displayModes?.length === 4) { console.log('  ✓ 4 display modes'); pass++; }
    else { console.log('  ✗ display mode count', j.displayModes?.length); fail++; }
  } catch { console.log('  ✗ config parse'); fail++; }

  const churchesDir = path.join(ROOT, 'churches');
  const churchFiles = fs.readdirSync(churchesDir).filter((f) => f.endsWith('.html') && f !== 'index.html');
  let injected = 0;
  churchFiles.forEach((f) => {
    const html = fs.readFileSync(path.join(churchesDir, f), 'utf8');
    if (html.includes('platform/loader.js')) injected++;
  });
  if (injected === churchFiles.length) {
    console.log(`  ✓ all ${churchFiles.length} church pages have platform`);
    pass++;
  } else {
    console.log(`  ✗ church platform injection ${injected}/${churchFiles.length}`);
    fail++;
  }

  console.log('\n--- RESULT ---');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });