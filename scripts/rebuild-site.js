#!/usr/bin/env node
/**
 * Full site rebuild — inject globals, redirects, sitemap, CDN cache purge.
 * Usage: npm run rebuild:site [--no-cache] [--from-api]
 */
const path = require('path');
const { initDb } = require('../server/db');
const { runRebuild } = require('../server/services/rebuild');

const ROOT = path.join(__dirname, '..');
const fromApi = process.argv.includes('--from-api');
const skipCache = process.argv.includes('--no-cache');

async function main() {
  console.log('=== URDFW Site Rebuild ===\n');
  const db = initDb();
  const report = await runRebuild(db, {
    rootDir: ROOT,
    invalidateCache: !skipCache,
    deployS3: process.argv.includes('--deploy-s3'),
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
  console.log('\n✓ Rebuild complete.');
  if (!fromApi) {
    console.log('  CloudFront + Cloudflare caches invalidated.');
    console.log('  Run npm run deploy:s3 to push HTML to S3 if not using --deploy-s3.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});