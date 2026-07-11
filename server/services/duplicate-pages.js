/**
 * Duplicate page detection, canonical merge strategy, redirect manifest.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getSetting, setSetting } = require('./platform-settings');

const REDIRECTS_KEY = 'page_redirects';
const SKIP_FILES = new Set([
  'upper-room-dfw-complete.html',
  'embed.html',
  'go.html',
]);

const DEFAULT_REDIRECTS = [
  { from: '/upper-room-dfw-complete.html', to: '/', status: 301, reason: 'orphan-duplicate-of-index', canonical: 'https://upperroomdfw.com/' },
  { from: '/index.html', to: '/', status: 301, reason: 'normalize-apex' },
  { from: '/www/', to: 'https://upperroomdfw.com/', status: 301, reason: 'www-to-apex', external: true },
];

function projectRoot(rootDir) {
  return rootDir || path.join(__dirname, '..', '..');
}

function walkHtml(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full, list);
    else if (name.endsWith('.html')) list.push(full);
  }
  return list;
}

function normalizePath(rel) {
  let p = String(rel || '').replace(/\\/g, '/').toLowerCase();
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

function metaContent(html, attr, key) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : '';
}

function linkHref(html, rel) {
  const m = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function tagText(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function bodyFingerprint(html) {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const text = (body ? body[1] : html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return crypto.createHash('sha1').update(text.slice(0, 8000)).digest('hex');
}

function pickCanonical(pages) {
  const scored = pages.map((p) => {
    let score = 0;
    if (p.rel === 'index.html') score += 100;
    if (!p.rel.includes('/')) score += 20;
    if (!SKIP_FILES.has(path.basename(p.rel))) score += 10;
    score -= p.rel.split('/').length * 5;
    score -= Math.min(p.sizeBytes / 50000, 10);
    return { ...p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function scanDuplicates(rootDir) {
  const root = projectRoot(rootDir);
  const files = walkHtml(root).sort();
  const pages = files.map((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const urlPath = normalizePath(rel);
    return {
      file,
      rel,
      urlPath,
      title: tagText(html, 'title'),
      description: metaContent(html, 'name', 'description'),
      canonical: linkHref(html, 'canonical'),
      fingerprint: bodyFingerprint(html),
      sizeBytes: Buffer.byteLength(html, 'utf8'),
    };
  });

  const groups = {
    byTitle: new Map(),
    byCanonical: new Map(),
    byFingerprint: new Map(),
  };

  for (const p of pages) {
    const titleKey = (p.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (titleKey) {
      if (!groups.byTitle.has(titleKey)) groups.byTitle.set(titleKey, []);
      groups.byTitle.get(titleKey).push(p);
    }
    const canonKey = (p.canonical || '').toLowerCase().replace(/\/$/, '');
    if (canonKey) {
      if (!groups.byCanonical.has(canonKey)) groups.byCanonical.set(canonKey, []);
      groups.byCanonical.get(canonKey).push(p);
    }
    if (p.fingerprint) {
      if (!groups.byFingerprint.has(p.fingerprint)) groups.byFingerprint.set(p.fingerprint, []);
      groups.byFingerprint.get(p.fingerprint).push(p);
    }
  }

  const duplicateSets = [];
  const seen = new Set();

  function isTemplateStub(rel) {
  return rel.startsWith('templates/');
}

function addSet(type, key, list) {
    if (list.length < 2) return;
    const nonTemplates = list.filter((p) => !isTemplateStub(p.rel));
    const workList = nonTemplates.length >= 2 ? nonTemplates : (type === 'content' ? [] : list);
    if (workList.length < 2) return;
    const ids = workList.map((p) => p.rel).sort().join('|');
    if (seen.has(ids)) return;
    seen.add(ids);
    const canonical = pickCanonical(workList);
    const duplicates = workList.filter((p) => p.rel !== canonical.rel);
    duplicateSets.push({
      type,
      key,
      count: workList.length,
      canonical: {
        rel: canonical.rel,
        urlPath: canonical.urlPath,
        title: canonical.title,
        canonical: canonical.canonical,
      },
      duplicates: duplicates.map((p) => ({
        rel: p.rel,
        urlPath: p.urlPath,
        title: p.title,
        canonical: p.canonical,
        sizeBytes: p.sizeBytes,
      })),
      suggestedRedirects: duplicates.map((p) => ({
        from: p.urlPath,
        to: canonical.urlPath === '/index.html' ? '/' : canonical.urlPath,
        status: 301,
        reason: `${type}-duplicate`,
        mergeTarget: canonical.rel,
      })),
    });
  }

  for (const [k, list] of groups.byTitle) addSet('title', k, list);
  for (const [k, list] of groups.byCanonical) addSet('canonical', k, list);
  for (const [k, list] of groups.byFingerprint) {
    if (list.length > 3) addSet('content', k.slice(0, 12), list);
  }

  return {
    scannedAt: new Date().toISOString(),
    pageCount: pages.length,
    duplicateSetCount: duplicateSets.length,
    duplicateSets,
    pages,
  };
}

function loadRedirectsFile(rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'redirects.json');
  if (!fs.existsSync(file)) return { version: '1.0.0', redirects: [...DEFAULT_REDIRECTS] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { version: '1.0.0', redirects: [...DEFAULT_REDIRECTS] };
  }
}

function saveRedirectsFile(rootDir, data) {
  const file = path.join(projectRoot(rootDir), 'data', 'redirects.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

function getRedirects(db, rootDir) {
  const stored = getSetting(db, REDIRECTS_KEY, null);
  if (stored?.redirects?.length) return stored;
  return loadRedirectsFile(rootDir);
}

function setRedirects(db, redirects, rootDir) {
  const payload = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    redirects: redirects || [],
  };
  setSetting(db, REDIRECTS_KEY, payload);
  saveRedirectsFile(rootDir, payload);
  return payload;
}

function mergeRedirectsFromAudit(audit, existing) {
  const map = new Map();
  for (const r of existing.redirects || DEFAULT_REDIRECTS) {
    map.set(normalizePath(r.from), r);
  }
  for (const set of audit.duplicateSets || []) {
    for (const r of set.suggestedRedirects || []) {
      const from = normalizePath(r.from);
      if (from === normalizePath(r.to)) continue;
      map.set(from, { ...r, from, autoGenerated: true });
    }
  }
  return Array.from(map.values());
}

function applyCanonicalTags(rootDir, redirects) {
  const root = projectRoot(rootDir);
  let updated = 0;
  for (const r of redirects.redirects || []) {
    if (!r.from || !r.to || r.from === r.to) continue;
    const rel = r.from.replace(/^\//, '');
    const file = path.join(root, rel);
    if (!fs.existsSync(file) || !file.endsWith('.html')) continue;
    const target = r.canonical || `https://upperroomdfw.com${r.to === '/' ? '' : r.to}`;
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '');
    const tag = `  <link rel="canonical" href="${target}">\n`;
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, tag + '</head>');
    if (html !== before) {
      fs.writeFileSync(file, html);
      updated += 1;
    }
  }
  return updated;
}

module.exports = {
  REDIRECTS_KEY,
  DEFAULT_REDIRECTS,
  SKIP_FILES,
  normalizePath,
  scanDuplicates,
  getRedirects,
  setRedirects,
  loadRedirectsFile,
  saveRedirectsFile,
  mergeRedirectsFromAudit,
  applyCanonicalTags,
  walkHtml,
};