#!/usr/bin/env node
/** Apply Upper Room DFW logo + favicon across all HTML pages. */
const path = require('path');
const { applyBrandToFile, walkHtml } = require('./brand-assets');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['upper-room-dfw-complete.html']);

let count = 0;
walkHtml(ROOT, (filePath, depth) => {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (SKIP.has(rel)) return false;
  if (applyBrandToFile(filePath, depth)) {
    console.log('Branded:', rel);
    count += 1;
    return true;
  }
  return false;
});

console.log('Done. Branded', count, 'files.');