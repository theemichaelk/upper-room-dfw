#!/usr/bin/env node
/**
 * Apply redirect manifest — canonical tags, sitemap exclusions, optional 301 stubs.
 * Usage: node scripts/apply-redirects.js [--canonicals]
 */
const path = require('path');
const {
  loadRedirectsFile, applyCanonicalTags, scanDuplicates, mergeRedirectsFromAudit, saveRedirectsFile,
} = require('../server/services/duplicate-pages');

const ROOT = path.join(__dirname, '..');
const fixCanonicals = process.argv.includes('--canonicals') || process.argv.includes('--all');

function main() {
  let data = loadRedirectsFile(ROOT);

  if (process.argv.includes('--refresh')) {
    const audit = scanDuplicates(ROOT);
    const mergedRules = mergeRedirectsFromAudit(audit, data);
    data = { version: '1.0.0', updatedAt: new Date().toISOString(), redirects: mergedRules };
    saveRedirectsFile(ROOT, data);
    console.log('Refreshed redirects from duplicate audit:', mergedRules.length, 'rules');
  }

  if (fixCanonicals) {
    const n = applyCanonicalTags(ROOT, data);
    console.log('Updated canonical tags on', n, 'duplicate source pages');
  }

  console.log('Redirect manifest:', data.redirects?.length || 0, 'rules at data/redirects.json');
}

main();