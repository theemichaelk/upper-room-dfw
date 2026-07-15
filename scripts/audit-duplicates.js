#!/usr/bin/env node
/**
 * Duplicate page audit — titles, canonicals, content fingerprints.
 * Usage: npm run audit:duplicates [--apply]
 */
const fs = require('fs');
const path = require('path');
const {
  scanDuplicates, mergeRedirectsFromAudit, loadRedirectsFile, saveRedirectsFile, applyCanonicalTags,
} = require('../server/services/duplicate-pages');

const ROOT = path.join(__dirname, '..');
const apply = process.argv.includes('--apply');

function main() {
  const audit = scanDuplicates(ROOT);
  const merged = mergeRedirectsFromAudit(audit, loadRedirectsFile(ROOT));

  const reportPath = path.join(ROOT, 'data', 'duplicate-audit.json');
  fs.writeFileSync(reportPath, JSON.stringify({ ...audit, suggestedRedirects: merged }, null, 2) + '\n');

  console.log('\n  URDFW Duplicate Page Audit\n');
  console.log(`  Pages scanned:     ${audit.pageCount}`);
  console.log(`  Duplicate sets:    ${audit.duplicateSetCount}`);
  console.log(`  Redirect rules:    ${merged.length}`);
  console.log(`  Report:            data/duplicate-audit.json\n`);

  if (audit.duplicateSetCount) {
    console.log('  ── DUPLICATE SETS ──');
    for (const set of audit.duplicateSets.slice(0, 20)) {
      console.log(`  [${set.type}] ${set.count} pages — canonical: ${set.canonical.rel}`);
      for (const d of set.duplicates) console.log(`      → ${d.rel}`);
    }
    if (audit.duplicateSetCount > 20) console.log(`  ... +${audit.duplicateSetCount - 20} more`);
  }

  if (apply) {
    saveRedirectsFile(ROOT, { version: '1.0.0', updatedAt: new Date().toISOString(), redirects: merged });
    const updated = applyCanonicalTags(ROOT, { redirects: merged });
    console.log(`\n  ✓ Applied ${merged.length} redirects, updated ${updated} canonical tags`);
  } else {
    console.log('\n  Run with --apply to write data/redirects.json and fix canonical tags');
  }

  process.exit(audit.duplicateSetCount > 0 && !apply ? 1 : 0);
}

main();