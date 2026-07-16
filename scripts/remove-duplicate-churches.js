#!/usr/bin/env node
/** Remove non-canonical church HTML pages listed as title-duplicate redirect sources. */
const fs = require('fs');
const path = require('path');
const { loadRedirectsFile } = require('../server/services/duplicate-pages');

const ROOT = path.join(__dirname, '..');
const data = loadRedirectsFile(ROOT);
const dups = (data.redirects || []).filter(
  (r) => r.reason === 'title-duplicate' && r.from && String(r.from).startsWith('/churches/')
);

let removed = 0;
for (const r of dups) {
  const from = String(r.from).replace(/^\//, '');
  const full = path.join(ROOT, from);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    removed += 1;
    console.log('removed', from, '->', r.to);
  }
}
console.log('Removed', removed, 'duplicate church HTML files');
