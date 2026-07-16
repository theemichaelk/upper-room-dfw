#!/usr/bin/env node
/**
 * Lightweight soak / smoke test against local or production base URL.
 * Usage: node scripts/soak-test.js [baseUrl] [rounds]
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:8000';
const ROUNDS = Math.min(30, Math.max(3, parseInt(process.argv[3], 10) || 8));

async function hit(path, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE.replace(/\/$/, '') + path, {
      ...opts,
      headers: { Accept: 'application/json,text/html,*/*', ...(opts.headers || {}) },
    });
    const ms = Date.now() - t0;
    // 401 on admin analytics is expected without a token (endpoint is alive + protected)
    const ok =
      (res.status >= 200 && res.status < 400) ||
      (res.status === 401 && /\/api\/analytics\//.test(path));
    return { path, status: res.status, ms, ok };
  } catch (e) {
    return { path, status: 0, ms: Date.now() - t0, ok: false, error: e.message };
  }
}

async function main() {
  console.log(`Soak test → ${BASE} × ${ROUNDS} rounds\n`);
  const paths = [
    '/api/health',
    '/api/stats/public',
    '/sitemap.xml',
    '/sitemap.html',
    '/directory.html',
    '/index.html',
    '/api/analytics/traffic',
  ];
  const results = [];
  for (let r = 1; r <= ROUNDS; r++) {
    for (const p of paths) {
      const row = await hit(p);
      results.push(row);
      const mark = row.ok ? '✓' : '✗';
      console.log(`  ${mark} r${r} ${row.status} ${row.ms}ms ${p}${row.error ? ' ' + row.error : ''}`);
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const avg = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
  console.log(`\n--- SOAK RESULT ---`);
  console.log(`PASS: ${ok}  FAIL: ${fail}  avg latency: ${avg}ms`);
  process.exit(fail > 0 && fail === results.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
