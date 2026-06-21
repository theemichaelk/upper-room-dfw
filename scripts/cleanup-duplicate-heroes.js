#!/usr/bin/env node
/** Remove duplicate sky-gradient hero headers (keeps first, drops second) */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['index.html', 'upper-room-dfw-complete.html']);

function cleanup(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const heroBlocks = [...html.matchAll(/<header[^>]*class="[^"]*sky-gradient[^"]*"[^>]*>[\s\S]*?<\/header>/gi)];
  if (heroBlocks.length < 2) return false;

  const second = heroBlocks[1][0];
  html = html.replace(second, '');
  html = html.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(filePath, html);
  return true;
}

let count = 0;
fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !SKIP.has(f)).forEach((f) => {
  if (cleanup(path.join(ROOT, f))) { console.log('Cleaned:', f); count++; }
});
console.log('Done.', count, 'files cleaned.');