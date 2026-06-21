#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://upperroomdfw.com';

const pages = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && f !== 'upper-room-dfw-complete.html');

const extra = ['templates/single/classic.html', 'templates/multi/standard-multipage.html', 'templates/multi/premium-multipage.html'];

const churches = fs.readdirSync(path.join(ROOT, 'churches'))
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => `churches/${f}`);

const all = [...pages, ...extra, ...churches].sort();
const urls = all.map((p) => `  <url><loc>${BASE}/${p}</loc></url>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log('Wrote sitemap.xml with', all.length, 'URLs');