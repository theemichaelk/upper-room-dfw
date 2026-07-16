#!/usr/bin/env node
/**
 * Unified head/body injection — platform CSS, responsive layer, performance hints, loader.
 * Reads data/injection-config.json. Upgrades existing loaders (defer + path normalize).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'injection-config.json');
const SITE_SETTINGS_PATH = path.join(ROOT, 'data', 'site-settings.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const {
  buildTelemetryHeadBlock,
  buildTelemetryBodyBlock,
  MARKER,
  MARKER_CLOSE,
  BODY_MARKER,
  BODY_MARKER_CLOSE,
} = require('../server/services/telemetry');
const { loadStaticSiteSettings } = require('../server/services/site-settings');
const { injectFaviconMeta, applyNavLogo } = require('./brand-assets');

const siteSettings = loadStaticSiteSettings(ROOT);
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

function injectStyles(html, depth, rel = '') {
  const base = path.basename(rel || '');
  for (const sheet of config.stylesheets || []) {
    if (Array.isArray(sheet.pages) && sheet.pages.length) {
      if (!sheet.pages.includes(base) && !sheet.pages.includes(rel)) continue;
    }
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

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove prior baked telemetry / body blocks (marker-delimited) before re-injecting. */
function stripOldTelemetry(html) {
  const closed = new RegExp(`${escapeRe(MARKER)}[\\s\\S]*?${escapeRe(MARKER_CLOSE)}`, 'gi');
  if (closed.test(html)) html = html.replace(closed, '');
  else if (html.includes(MARKER)) {
    html = html.replace(/<!-- urdfw-telemetry:v1 -->[\s\S]*?(?=<meta|<link|<script|<\/head>)/i, '');
  }
  const bodyClosed = new RegExp(`${escapeRe(BODY_MARKER)}[\\s\\S]*?${escapeRe(BODY_MARKER_CLOSE)}`, 'gi');
  html = html.replace(bodyClosed, '');
  /* Orphan GTM/GA from bad deploys (e.g. GTM-REBUILD) left outside markers */
  html = html.replace(/<script[^>]*>[\s\S]*?googletagmanager\.com\/gtm\.js[\s\S]*?<\/script>\s*/gi, '');
  html = html.replace(/<noscript>\s*<iframe[^>]*googletagmanager\.com\/ns\.html[^>]*>[\s\S]*?<\/noscript>\s*/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']*gtag\/js\?id=G-[^"']+["'][^>]*>\s*<\/script>\s*/gi, '');
  html = html.replace(/<script>\s*window\.dataLayer\s*=\s*window\.dataLayer[\s\S]*?gtag\('config'[\s\S]*?<\/script>\s*/gi, '');
  return html;
}

function injectTelemetry(html) {
  html = stripOldTelemetry(html);
  const headBlock = buildTelemetryHeadBlock(siteSettings) || (MARKER + '\n' + MARKER_CLOSE + '\n');

  if (/<meta[^>]+name=["']viewport["']/i.test(html)) {
    html = html.replace(/<meta[^>]+name=["']viewport["'][^>]*>/i, (match) => match + '\n' + headBlock);
  } else {
    html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + headBlock);
  }

  /* Always inject body block after <body> so custom body HTML can be added/cleared */
  const bodyBlock = buildTelemetryBodyBlock(siteSettings);
  if (bodyBlock) {
    html = html.replace(/<body([^>]*)>/i, (m) => m + '\n' + bodyBlock);
  }
  return html;
}

function injectFile(filePath, depth) {
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  html = ensureViewport(html);
  html = injectFaviconMeta(html, depth);
  html = injectTelemetry(html);
  html = injectPreconnect(html);
  html = injectMeta(html);
  html = injectStyles(html, depth, rel);
  html = applyNavLogo(html, depth).html;
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
count = walkHtml(path.join(ROOT, 'blog'), 1, count);
count = walkHtml(path.join(ROOT, 'templates'), 1, count);

console.log('Done. Injected/upgraded', count, 'files.');