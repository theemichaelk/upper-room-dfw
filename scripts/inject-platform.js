#!/usr/bin/env node
/**
 * Unified head/body injection — platform CSS, responsive layer, performance hints, loader.
 * Reads data/injection-config.json. Upgrades existing loaders (defer + path normalize).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'injection-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SKIP = new Set(config.skipPages || []);
const EMBED_PAGES = new Set((config.embedTier || {}).pages || ['embed.html']);

function relPrefix(depth) {
  return depth > 0 ? '../'.repeat(depth) : '';
}

function hrefFor(relPath, depth) {
  return relPrefix(depth) + relPath;
}

function hasTag(html, needle) {
  return html.includes(needle);
}

function injectPreconnect(html) {
  let block = '';
  for (const origin of config.preconnect || []) {
    if (!html.includes(origin)) {
      block += `  <link rel="preconnect" href="${origin}" crossorigin>\n`;
    }
  }
  for (const origin of config.dnsPrefetch || []) {
    if (!html.includes(origin)) {
      block += `  <link rel="dns-prefetch" href="${origin}">\n`;
    }
  }
  if (!block) return html;
  return html.replace(/<head[^>]*>/i, (m) => m + '\n' + block);
}

function injectMeta(html) {
  const m = config.meta || {};
  let block = '';
  if (m.themeColor && !hasTag(html, 'name="theme-color"')) {
    block += `  <meta name="theme-color" content="${m.themeColor}">\n`;
  }
  if (m.formatDetection && !hasTag(html, 'name="format-detection"')) {
    block += `  <meta name="format-detection" content="${m.formatDetection}">\n`;
  }
  if (!block) return html;
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) {
    return html.replace(/<meta[^>]+name=["']viewport["'][^>]*>/i, (match) => match + '\n' + block);
  }
  return html.replace(/<head[^>]*>/i, (m) => m + '\n' + block);
}

function injectStyles(html, depth) {
  for (const sheet of config.stylesheets || []) {
    const href = hrefFor(sheet.href, depth);
    if (hasTag(html, `href="${href}"`) || hasTag(html, `href='${href}'`)) continue;
    if (depth === 0 && (hasTag(html, `href="${sheet.href}"`) || hasTag(html, `href='${sheet.href}'`))) continue;
    const tag = `  <link rel="stylesheet" href="${href}">\n`;
    html = html.replace('</head>', tag + '</head>');
  }
  return html;
}

function upgradeLoader(html, depth) {
  const expected = hrefFor(config.scripts?.loader || 'js/platform/loader.js', depth);
  const re = /<script([^>]*src=["'][^"']*platform\/loader\.js[^"']*["'][^>]*)>\s*<\/script>/gi;
  if (re.test(html)) {
    return html.replace(re, (match, attrs) => {
      let a = attrs.replace(/src=["'][^"']*["']/, `src="${expected}"`);
      if (!/\bdefer\b/i.test(a)) a += ' defer';
      return `<script${a}></script>`;
    });
  }
  const tag = `  <script src="${expected}" defer></script>\n`;
  return html.replace('</body>', tag + '</body>');
}

function ensureViewport(html) {
  if (hasTag(html, 'name="viewport"')) return html;
  return html.replace(/<head[^>]*>/i, (m) => m + '\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
}

function injectFile(filePath, depth) {
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = ensureViewport(html);
  html = injectPreconnect(html);
  html = injectMeta(html);
  html = injectStyles(html, depth);
  html = upgradeLoader(html, depth);
  if (html !== before) {
    fs.writeFileSync(filePath, html);
    return true;
  }
  return false;
}

function walkHtml(dir, depth, count) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      count = walkHtml(full, depth + 1, count);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (SKIP.has(name) || SKIP.has(rel)) continue;
    if (injectFile(full, depth)) {
      console.log('Injected:', rel);
      count++;
    }
  }
  return count;
}

let count = 0;
for (const name of fs.readdirSync(ROOT)) {
  if (!name.endsWith('.html')) continue;
  const rel = name;
  if (SKIP.has(name) && !EMBED_PAGES.has(name)) continue;
  const depth = 0;
  if (injectFile(path.join(ROOT, name), depth)) {
    console.log('Injected:', name);
    count++;
  }
}
count = walkHtml(path.join(ROOT, 'churches'), 1, count);
count = walkHtml(path.join(ROOT, 'templates'), 1, count);

console.log('Done. Injected/upgraded', count, 'files.');