/**
 * Granular Page Lifecycle Manager — inventory, registry overrides, CRUD.
 */
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting } = require('./platform-settings');
const { getRedirects } = require('./duplicate-pages');
const { getSeoPages } = require('./seo-settings');

const LIFECYCLE_KEY = 'page_lifecycle';

const STATUS_VALUES = ['live', 'draft', 'scheduled', 'archived', 'redirect'];
const TYPE_VALUES = ['static', 'church', 'portal', 'system', 'template'];
const SHELL_VALUES = ['global', 'minimal', 'embed', 'none'];

function projectRoot(rootDir) {
  return rootDir || path.join(__dirname, '..', '..');
}

function normalizeId(id) {
  return String(id || '').replace(/\\/g, '/').replace(/^\//, '').trim();
}

function urlPathFromId(id) {
  const clean = normalizeId(id);
  return clean ? '/' + clean : '/';
}

function inferType(file) {
  const rel = normalizeId(file);
  if (rel.startsWith('churches/')) return 'church';
  if (['admin.html', 'member-dashboard.html', 'billing-hub.html'].includes(rel)) return 'portal';
  if (['404.html', 'go.html', 'embed.html'].includes(rel)) return 'system';
  if (rel.startsWith('templates/')) return 'template';
  return 'static';
}

function inferShell(file) {
  const rel = normalizeId(file);
  if (rel === 'embed.html' || rel === 'go.html') return 'minimal';
  if (rel === '404.html') return 'global';
  return 'global';
}

function loadPageMetadata(rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'page-metadata.json');
  if (!fs.existsSync(file)) return { pages: [], generatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { pages: [], generatedAt: null };
  }
}

function getRegistry(db) {
  const raw = getSetting(db, LIFECYCLE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

function setRegistry(db, registry) {
  setSetting(db, LIFECYCLE_KEY, registry);
  return registry;
}

function mergePageRecord(scanned, registryEntry, seoEntry, redirectMap) {
  const id = normalizeId(scanned?.file || registryEntry?.id);
  const urlPath = urlPathFromId(id);
  const redirect = redirectMap.get(urlPath.toLowerCase()) || null;
  const base = {
    id,
    file: id,
    urlPath,
    productionUrl: scanned?.productionUrl || `https://upperroomdfw.com/${id}`,
    title: scanned?.title || registryEntry?.title || '',
    description: scanned?.description || registryEntry?.description || '',
    status: registryEntry?.status || (redirect ? 'redirect' : 'live'),
    type: registryEntry?.type || inferType(id),
    shell: registryEntry?.shell || inferShell(id),
    noindex: !!(registryEntry?.noindex ?? seoEntry?.noindex),
    redirectTo: registryEntry?.redirectTo || redirect?.to || null,
    redirectStatus: registryEntry?.redirectStatus || redirect?.status || 301,
    seo: {
      title: seoEntry?.title || registryEntry?.seo?.title || scanned?.title || '',
      description: seoEntry?.description || registryEntry?.seo?.description || scanned?.description || '',
      canonical: scanned?.canonical || registryEntry?.seo?.canonical || null,
      noindex: !!(registryEntry?.noindex ?? seoEntry?.noindex),
    },
    source: registryEntry ? 'registry' : 'filesystem',
    sizeBytes: scanned?.sizeBytes || null,
    lines: scanned?.lines || null,
    createdAt: registryEntry?.createdAt || null,
    updatedAt: registryEntry?.updatedAt || null,
    publishedAt: registryEntry?.publishedAt || null,
  };
  if (registryEntry) {
    return { ...base, ...registryEntry, seo: { ...base.seo, ...(registryEntry.seo || {}) } };
  }
  return base;
}

function buildRedirectMap(db) {
  const map = new Map();
  const redirects = getRedirects(db)?.redirects || [];
  redirects.forEach((r) => {
    if (r.from) map.set(String(r.from).toLowerCase(), r);
  });
  return map;
}

function listPages(db, filters = {}, rootDir) {
  const meta = loadPageMetadata(rootDir);
  const registry = getRegistry(db);
  const seo = getSeoPages(db).pages || {};
  const redirectMap = buildRedirectMap(db);

  const scannedById = new Map();
  (meta.pages || []).forEach((p) => {
    const id = normalizeId(p.file);
    scannedById.set(id, p);
  });

  const allIds = new Set([...scannedById.keys(), ...Object.keys(registry)]);
  let pages = [...allIds].map((id) => {
    const scanned = scannedById.get(id);
    const reg = registry[id];
    const seoEntry = seo[id] || seo[normalizeId(id)];
    return mergePageRecord(scanned, reg, seoEntry, redirectMap);
  });

  const q = String(filters.q || '').trim().toLowerCase();
  if (q) {
    pages = pages.filter((p) => {
      const hay = [p.id, p.title, p.description, p.urlPath, p.productionUrl, p.type, p.status].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if (filters.status) {
    pages = pages.filter((p) => p.status === filters.status);
  }
  if (filters.type) {
    pages = pages.filter((p) => p.type === filters.type);
  }
  if (filters.shell) {
    pages = pages.filter((p) => p.shell === filters.shell);
  }
  if (filters.noindex === 'true' || filters.noindex === true) {
    pages = pages.filter((p) => p.noindex);
  }

  pages.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ok: true,
    count: pages.length,
    totalInventory: allIds.size,
    generatedAt: meta.generatedAt,
    pages,
  };
}

function getPage(db, pageId, rootDir) {
  const id = normalizeId(pageId);
  if (!id) return null;
  const result = listPages(db, {}, rootDir);
  return result.pages.find((p) => p.id === id) || null;
}

function createPage(db, payload = {}) {
  const id = normalizeId(payload.id || payload.file);
  if (!id) throw new Error('Page id required');
  if (!id.endsWith('.html')) throw new Error('Page id must end with .html');

  const registry = getRegistry(db);
  if (registry[id]) throw new Error('Page already exists in registry');

  const now = new Date().toISOString();
  const record = {
    id,
    file: id,
    urlPath: urlPathFromId(id),
    productionUrl: payload.productionUrl || `https://upperroomdfw.com/${id}`,
    title: payload.title || '',
    description: payload.description || '',
    status: STATUS_VALUES.includes(payload.status) ? payload.status : 'draft',
    type: TYPE_VALUES.includes(payload.type) ? payload.type : inferType(id),
    shell: SHELL_VALUES.includes(payload.shell) ? payload.shell : 'global',
    noindex: !!payload.noindex,
    redirectTo: payload.redirectTo || null,
    redirectStatus: payload.redirectStatus || 301,
    seo: payload.seo || { title: payload.title || '', description: payload.description || '', noindex: !!payload.noindex },
    source: 'registry',
    createdAt: now,
    updatedAt: now,
    publishedAt: payload.status === 'live' ? now : null,
  };

  registry[id] = record;
  setRegistry(db, registry);
  return record;
}

function updatePage(db, pageId, patch = {}) {
  const id = normalizeId(pageId);
  if (!id) throw new Error('Page id required');

  const registry = getRegistry(db);
  const existing = registry[id] || {
    id,
    file: id,
    urlPath: urlPathFromId(id),
    source: 'registry',
    createdAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    id,
    file: id,
    urlPath: urlPathFromId(id),
    updatedAt: now,
    source: 'registry',
  };

  if (patch.status && !STATUS_VALUES.includes(patch.status)) {
    throw new Error('Invalid status');
  }
  if (patch.type && !TYPE_VALUES.includes(patch.type)) {
    throw new Error('Invalid type');
  }
  if (patch.shell && !SHELL_VALUES.includes(patch.shell)) {
    throw new Error('Invalid shell');
  }
  if (patch.seo) {
    next.seo = { ...(existing.seo || {}), ...patch.seo };
  }
  if (patch.status === 'live' && !existing.publishedAt) {
    next.publishedAt = now;
  }

  registry[id] = next;
  setRegistry(db, registry);
  return next;
}

function deletePage(db, pageId, opts = {}) {
  const id = normalizeId(pageId);
  if (!id) throw new Error('Page id required');

  const registry = getRegistry(db);
  const now = new Date().toISOString();

  if (opts.hard && registry[id]) {
    delete registry[id];
    setRegistry(db, registry);
    return { id, deleted: true, mode: 'hard' };
  }

  registry[id] = {
    ...(registry[id] || { id, file: id, urlPath: urlPathFromId(id), source: 'registry' }),
    status: 'archived',
    updatedAt: now,
    archivedAt: now,
  };
  setRegistry(db, registry);
  return { id, deleted: false, mode: 'archive', status: 'archived' };
}

function loadControlSchema(rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'platform-control-schema.json');
  if (!fs.existsSync(file)) return { version: '1.0.0', hubs: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = {
  LIFECYCLE_KEY,
  STATUS_VALUES,
  TYPE_VALUES,
  SHELL_VALUES,
  listPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  loadControlSchema,
  normalizeId,
};