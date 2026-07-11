/**
 * Shared brand logo snippets + HTML replacement for Upper Room DFW.
 */
const fs = require('fs');
const path = require('path');

const LOGO_PNG = 'images/logo-upper-room-dfw.png';
const LOGO_JPG = 'images/logo-upper-room-dfw.jpg';
const BRAND_ALT = 'Upper Room DFW — King Jesus';
const OG_IMAGE = 'https://upperroomdfw.com/images/logo-upper-room-dfw.jpg';

function relPrefix(depth) {
  return depth > 0 ? '../'.repeat(depth) : '';
}

function logoSrc(depth) {
  return relPrefix(depth) + LOGO_PNG;
}

function logoImgTag(depth, sizeClass = 'h-11 w-11') {
  const src = logoSrc(depth);
  return `<img src="${src}" alt="${BRAND_ALT}" class="urdfw-brand-logo ${sizeClass} object-contain shrink-0" width="44" height="44" loading="eager">`;
}

const NAV_ICON_PATTERNS = [
  /<div class="w-10 h-10 bg-\[#0369a1\] rounded-2xl flex items-center justify-center"><i class="fa-solid fa-church text-white(?: text-2xl)?"><\/i><\/div>/g,
  /<div class="w-10 h-10 bg-\[#0ea5e9\] rounded-2xl flex items-center justify-center"><i class="fa-solid fa-church text-white(?: text-2xl)?"><\/i><\/div>/g,
  /<div class="w-9 h-9 bg-indigo-900 rounded-2xl flex items-center justify-center"><i class="fa-solid fa-church text-white"><\/i><\/div>/g,
  /<div class="w-11 h-11 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center"><i class="fa-solid fa-church text-white text-3xl"><\/i><\/div>/g,
];

function applyNavLogo(html, depth) {
  const tag = logoImgTag(depth);
  let out = html;
  let n = 0;
  for (const re of NAV_ICON_PATTERNS) {
    const before = out;
    out = out.replace(re, tag);
    if (out !== before) n += 1;
  }
  return { html: out, replaced: n };
}

function injectFaviconMeta(html, depth) {
  const prefix = relPrefix(depth);
  const png = prefix + LOGO_PNG;
  let block = '';
  if (!html.includes('rel="icon"') && !html.includes("rel='icon'")) {
    block += `  <link rel="icon" href="${png}" type="image/png" sizes="any">\n`;
    block += `  <link rel="apple-touch-icon" href="${png}">\n`;
  }
  if (!html.includes('property="og:image"')) {
    block += `  <meta property="og:image" content="${OG_IMAGE}">\n`;
    block += `  <meta property="og:image:alt" content="${BRAND_ALT}">\n`;
  }
  if (!block) return html;
  if (/<meta[^>]+charset/i.test(html)) {
    return html.replace(/<meta[^>]+charset[^>]*>/i, (m) => m + '\n' + block);
  }
  return html.replace(/<head[^>]*>/i, (m) => m + '\n' + block);
}

function walkHtml(root, fn) {
  let count = 0;
  const walk = (dir, depth) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!name.endsWith('.html')) continue;
      if (fn(full, depth)) count += 1;
    }
  };
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.html')) continue;
    if (fn(path.join(root, name), 0)) count += 1;
  }
  walk(path.join(root, 'churches'), 1);
  walk(path.join(root, 'blog'), 1);
  walk(path.join(root, 'templates'), 1);
  return count;
}

function applyBrandToFile(filePath, depth) {
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = injectFaviconMeta(html, depth);
  const { html: withLogo } = applyNavLogo(html, depth);
  html = withLogo;
  if (html !== before) {
    fs.writeFileSync(filePath, html);
    return true;
  }
  return false;
}

module.exports = {
  LOGO_PNG,
  LOGO_JPG,
  BRAND_ALT,
  OG_IMAGE,
  logoImgTag,
  logoSrc,
  applyNavLogo,
  injectFaviconMeta,
  applyBrandToFile,
  walkHtml,
};