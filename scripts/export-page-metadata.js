#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCAL_BASE = process.env.APP_URL || 'http://localhost:8000';
const PROD_BASE = 'https://upperroomdfw.com';

function walkHtml(dir, list = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full, list);
    else if (name.endsWith('.html')) list.push(full);
  }
  return list;
}

function metaContent(html, attr, key) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : '';
}

function tagContent(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function toUrl(relPath) {
  return relPath.split(path.sep).join('/');
}

function main() {
  const files = walkHtml(ROOT).sort();
  const pages = files.map((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    const urlPath = toUrl(rel);
    const ogUrl = metaContent(html, 'property', 'og:url');
    const canonical = metaContent(html, 'rel', 'canonical') || (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '');
    return {
      file: rel,
      localUrl: `${LOCAL_BASE}/${urlPath}`,
      productionUrl: ogUrl || canonical || `${PROD_BASE}/${urlPath}`,
      title: tagContent(html, 'title'),
      description: metaContent(html, 'name', 'description'),
      keywords: metaContent(html, 'name', 'keywords'),
      ogTitle: metaContent(html, 'property', 'og:title'),
      ogDescription: metaContent(html, 'property', 'og:description'),
      ogUrl: ogUrl,
      ogType: metaContent(html, 'property', 'og:type'),
      canonical,
      sizeBytes: Buffer.byteLength(html, 'utf8'),
      lines: html.split('\n').length,
    };
  });

  const outJson = path.join(ROOT, 'data', 'page-metadata.json');
  const outCsv = path.join(ROOT, 'data', 'page-metadata.csv');
  fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: { local: LOCAL_BASE, production: PROD_BASE }, count: pages.length, pages }, null, 2));

  const headers = ['file', 'localUrl', 'productionUrl', 'title', 'description', 'keywords', 'ogTitle', 'ogUrl', 'sizeBytes', 'lines'];
  const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...pages.map((p) => headers.map((h) => esc(p[h])).join(','))].join('\n');
  fs.writeFileSync(outCsv, csv);

  console.log(`Exported ${pages.length} HTML pages`);
  console.log('JSON:', outJson);
  console.log('CSV: ', outCsv);
}

main();