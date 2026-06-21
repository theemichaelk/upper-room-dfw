#!/usr/bin/env node
/** Inject Powered By footer into every HTML file */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POWERED_BY_HTML =
  'Powered By <a href="https://tsbrenterprises.com" class="hover:text-white underline" target="_blank" rel="noopener noreferrer">The Stone Builders Rejected</a> Michael K';
const CLASS_MARKER = 'urdfw-powered-by';
const FOOTER_BLOCK = `
    <div class="text-center text-xs py-3 text-slate-500 border-t border-white/10 ${CLASS_MARKER}">${POWERED_BY_HTML}</div>`;

const FALLBACK_FOOTER = `
  <footer class="bg-slate-900 text-slate-400 text-xs text-center py-4 urdfw-powered-by-footer">
    <div class="${CLASS_MARKER}">${POWERED_BY_HTML}</div>
  </footer>`;

function collectHtmlFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && name !== 'node_modules') {
      collectHtmlFiles(full, list);
    } else if (name.endsWith('.html')) {
      list.push(full);
    }
  }
  return list;
}

function inject(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes(CLASS_MARKER)) return false;

  // Normalize legacy copyright footers that already mention TSB
  html = html.replace(
    /©\s*\d{4}(?:-\d{4})?\s*powered by\s*<strong><a href="https:\/\/tsbrenterprises\.com">The Stone Builders Rejected<\/a><\/strong>\.\s*All rights reserved\./gi,
    POWERED_BY_HTML
  );

  if (html.includes('</footer>')) {
    html = html.replace('</footer>', FOOTER_BLOCK + '\n  </footer>');
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', FALLBACK_FOOTER + '\n</body>');
  } else {
    return false;
  }

  fs.writeFileSync(filePath, html);
  return true;
}

const files = collectHtmlFiles(ROOT);
let count = 0;
files.forEach((f) => {
  if (inject(f)) {
    console.log('Footer added:', path.relative(ROOT, f));
    count++;
  }
});
console.log('Done. Updated', count, 'of', files.length, 'HTML files.');