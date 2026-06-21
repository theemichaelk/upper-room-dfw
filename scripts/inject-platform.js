#!/usr/bin/env node
/** Inject platform.css + loader.js into all root HTML pages */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['upper-room-dfw-complete.html', 'embed.html']);

const CSS = '  <link rel="stylesheet" href="css/platform.css">\n';
const LOADER = '  <script src="js/platform/loader.js"></script>\n';

function inject(filePath, isChurch) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('platform/loader.js')) return false;

  const cssHref = isChurch ? '../css/platform.css' : 'css/platform.css';
  const loaderSrc = isChurch ? '../js/platform/loader.js' : 'js/platform/loader.js';
  const cssTag = `  <link rel="stylesheet" href="${cssHref}">\n`;
  const loaderTag = `  <script src="${loaderSrc}"></script>\n`;

  if (!html.includes('platform.css')) {
    html = html.replace('</head>', cssTag + '</head>');
  }
  html = html.replace('</body>', loaderTag + '</body>');
  fs.writeFileSync(filePath, html);
  return true;
}

let count = 0;
fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !SKIP.has(f)).forEach((f) => {
  if (inject(path.join(ROOT, f), false)) { console.log('Injected:', f); count++; }
});

const churchesDir = path.join(ROOT, 'churches');
if (fs.existsSync(churchesDir)) {
  fs.readdirSync(churchesDir).filter((f) => f.endsWith('.html') && f !== 'index.html').forEach((f) => {
    if (inject(path.join(churchesDir, f), true)) { console.log('Injected: churches/' + f); count++; }
  });
}

console.log('Done. Injected', count, 'files.');