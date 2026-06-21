#!/usr/bin/env node
/**
 * Generate detail pages for any church in data/churches.json
 * that does not yet have a churches/<slug>.html file.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'churches.json');
const CHURCHES_DIR = path.join(ROOT, 'churches');
const GENERATOR = path.join(__dirname, 'generate-church.js');

const churches = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existing = new Set(
  fs
    .readdirSync(CHURCHES_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => f.replace('.html', ''))
);

const missing = churches.filter((c) => !existing.has(c.slug));

if (missing.length === 0) {
  console.log('All churches already have detail pages.');
  process.exit(0);
}

console.log(`Generating ${missing.length} missing page(s)...`);

for (const church of missing) {
  const result = spawnSync(process.execPath, [GENERATOR, '--data', JSON.stringify(church)], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  if (result.status !== 0) {
    console.error(`Failed to generate page for: ${church.slug}`);
    process.exit(result.status || 1);
  }
}

console.log('Done.');