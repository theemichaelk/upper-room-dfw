#!/usr/bin/env node
/**
 * Export site_settings from SQLite to data/site-settings.json for static build injection.
 */
const path = require('path');
const { initDb } = require('../server/db');
const { exportSiteSettingsJson, exportSiteSettingsJsonSync } = require('../server/services/site-settings');

async function main() {
  const db = initDb();
  const root = path.join(__dirname, '..');
  let result;
  try {
    result = await exportSiteSettingsJson(db, root);
  } catch {
    result = exportSiteSettingsJsonSync(db, root);
  }
  if (!result?.ok && !result?.path) {
    console.error('Export failed:', result?.error || result);
    process.exit(1);
  }
  console.log('Exported site settings:', result.path || result.s3?.key, result.bytes ? '(' + result.bytes + ' bytes)' : '');
  if (result.s3?.ok) console.log('S3:', 's3://' + result.s3.bucket + '/' + result.s3.key);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
