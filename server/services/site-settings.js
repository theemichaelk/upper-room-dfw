/**
 * Site-wide telemetry, head injection, widgets — persisted in platform_settings (SQLite).
 * JSON export is best-effort: project data/ when writable, else /tmp, plus S3 on Amplify.
 */
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting } = require('./platform-settings');
const { normalizeSearchConsole } = require('./verification-tokens');
const { writeDataFile, isLambdaLike, projectRoot: pkgRoot, isWritableFsError } = require('./writable-fs');

const SETTINGS_KEY = 'site_settings';

const DEFAULT_SITE_SETTINGS = {
  version: '1.0.0',
  customHeadHtml: '',
  /** HTML injected immediately after the opening <body> tag (public pages). */
  customBodyHtml: '',
  headInjectionScripts: [],
  footerScripts: [],
  ga4Id: '',
  gtmId: '',
  searchConsole: {
    google: '',
    bing: '',
    yahoo: '',
  },
  headerBannerHtml: '',
  sidebarWidgetHtml: '',
  newsletterPopup: {
    enabled: true,
    delayMs: 5000,
    autoCloseMs: 5000,
    scrollPercent: 40,
    frequencyDays: 14,
    dismissDays: 7,
    title: 'Stay connected with DFW faith',
    subtitle: 'Get the weekly church digest in your inbox.',
  },
  updatedAt: null,
};

function mergeSettings(stored) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
  if (!stored || typeof stored !== 'object') return base;
  return {
    ...base,
    ...stored,
    searchConsole: { ...base.searchConsole, ...(stored.searchConsole || {}) },
    newsletterPopup: { ...base.newsletterPopup, ...(stored.newsletterPopup || {}) },
    headInjectionScripts: Array.isArray(stored.headInjectionScripts) ? stored.headInjectionScripts : base.headInjectionScripts,
    footerScripts: Array.isArray(stored.footerScripts) ? stored.footerScripts : base.footerScripts,
  };
}

function getSiteSettings(db) {
  return mergeSettings(getSetting(db, SETTINGS_KEY, null));
}

/**
 * If SQLite has no site_settings (or empty telemetry), seed from static JSON.
 * Prevents Amplify cold starts with empty DB wiping CDN settings on save.
 */
function ensureSiteSettingsSeeded(db, rootDir) {
  const stored = getSetting(db, SETTINGS_KEY, null);
  const hasUseful =
    stored &&
    typeof stored === 'object' &&
    (stored.gtmId ||
      stored.ga4Id ||
      stored.customHeadHtml ||
      stored.customBodyHtml ||
      stored.searchConsole?.google ||
      stored.searchConsole?.bing ||
      stored.updatedAt);
  if (hasUseful) return { seeded: false, settings: mergeSettings(stored) };

  const fromFile = loadStaticSiteSettings(rootDir);
  const usefulFile =
    fromFile.gtmId ||
    fromFile.ga4Id ||
    fromFile.customHeadHtml ||
    fromFile.customBodyHtml ||
    fromFile.searchConsole?.google ||
    fromFile.searchConsole?.bing;
  if (!usefulFile) return { seeded: false, settings: mergeSettings(stored) };

  /* Don't seed placeholder test IDs */
  if (/GTM-(TEST|REBUILD)/i.test(fromFile.gtmId || '')) fromFile.gtmId = '';
  if (/G-(TEST|REBUILD)/i.test(fromFile.ga4Id || '')) fromFile.ga4Id = '';

  const next = setSiteSettings(db, {
    ...fromFile,
    updatedAt: fromFile.updatedAt || new Date().toISOString(),
  });
  console.log('[site-settings] Seeded from static JSON (DB was empty)');
  return { seeded: true, settings: next };
}

function setSiteSettings(db, patch) {
  const current = getSiteSettings(db);
  const mergedSc = patch.searchConsole
    ? normalizeSearchConsole({ ...current.searchConsole, ...patch.searchConsole })
    : current.searchConsole;
  const next = mergeSettings({
    ...current,
    ...patch,
    searchConsole: mergedSc,
    newsletterPopup: patch.newsletterPopup ? { ...current.newsletterPopup, ...patch.newsletterPopup } : current.newsletterPopup,
    headInjectionScripts: patch.headInjectionScripts !== undefined ? patch.headInjectionScripts : current.headInjectionScripts,
    footerScripts: patch.footerScripts !== undefined ? patch.footerScripts : current.footerScripts,
    updatedAt: new Date().toISOString(),
  });
  setSetting(db, SETTINGS_KEY, next);
  return next;
}

/** Public subset — safe for unauthenticated pages */
function getPublicSiteSettings(db) {
  const s = getSiteSettings(db);
  return {
    ok: true,
    version: s.version,
    ga4Id: s.ga4Id || '',
    gtmId: s.gtmId || '',
    searchConsole: { ...s.searchConsole },
    customHeadHtml: s.customHeadHtml || '',
    customBodyHtml: s.customBodyHtml || '',
    headInjectionScripts: (s.headInjectionScripts || []).map((x) => ({
      id: x.id,
      src: x.src || '',
      inline: x.inline || '',
      async: !!x.async,
      defer: !!x.defer,
    })),
    footerScripts: (s.footerScripts || []).map((x) => ({
      id: x.id,
      src: x.src || '',
      inline: x.inline || '',
    })),
    headerBannerHtml: s.headerBannerHtml || '',
    sidebarWidgetHtml: s.sidebarWidgetHtml || '',
    newsletterPopup: { ...s.newsletterPopup },
    updatedAt: s.updatedAt,
  };
}

function projectRoot() {
  return pkgRoot();
}

/**
 * Export public site-settings JSON for static clients.
 * Never throws EROFS — SQLite remains source of truth on Amplify.
 * @returns {Promise|{ok, path?, bytes?, s3?, warning?}}
 */
function exportSiteSettingsJson(db, rootDir) {
  const payload = getPublicSiteSettings(db);
  const body = JSON.stringify(payload, null, 2) + '\n';

  /* Prefer explicit rootDir for local builds / scripts */
  if (rootDir && !isLambdaLike()) {
    try {
      const outPath = path.join(rootDir, 'data', 'site-settings.json');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, body);
      return Promise.resolve({
        ok: true,
        path: outPath,
        bytes: Buffer.byteLength(body),
        mode: 'project',
        persisted: true,
      }).then(async (local) => {
        try {
          const { uploadPublicAsset } = require('./writable-fs');
          const s3 = await uploadPublicAsset('data/site-settings.json', body, 'application/json');
          return { ...local, s3 };
        } catch {
          return local;
        }
      });
    } catch (err) {
      if (!isWritableFsError(err)) {
        return Promise.resolve({ ok: false, error: err.message, code: err.code });
      }
      /* fall through to writeDataFile */
    }
  }

  return writeDataFile('data/site-settings.json', body, {
    s3Key: 'data/site-settings.json',
    contentType: 'application/json',
    uploadS3: true,
  }).then((result) => ({
    ok: result.ok || result.local?.ok || result.s3?.ok,
    path: result.local?.path,
    bytes: result.local?.bytes,
    mode: result.local?.mode || (result.s3?.ok ? 's3' : 'none'),
    s3: result.s3,
    warning: result.local?.warning || (!result.local?.ok ? result.message : undefined),
    message: result.message,
    persisted: true,
    sourceOfTruth: 'sqlite',
  })).catch((err) => ({
    ok: false,
    error: err.message,
    sourceOfTruth: 'sqlite',
    message: 'Settings remain in database; static JSON export failed',
  }));
}

/** Sync helper for scripts that expect a blocking write */
function exportSiteSettingsJsonSync(db, rootDir) {
  const payload = getPublicSiteSettings(db);
  const body = JSON.stringify(payload, null, 2) + '\n';
  const root = rootDir || projectRoot();
  const candidates = [
    path.join(root, 'data', 'site-settings.json'),
    path.join(process.env.TMPDIR || '/tmp', 'urdfw-data', 'site-settings.json'),
  ];
  for (const outPath of candidates) {
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, body);
      return { ok: true, path: outPath, bytes: Buffer.byteLength(body) };
    } catch (err) {
      if (!isWritableFsError(err)) return { ok: false, error: err.message };
    }
  }
  return { ok: false, error: 'No writable path for site-settings.json', sourceOfTruth: 'sqlite' };
}

function loadStaticSiteSettings(rootDir) {
  const candidates = [
    path.join(rootDir || projectRoot(), 'data', 'site-settings.json'),
    path.join(process.env.TMPDIR || '/tmp', 'urdfw-data', 'site-settings.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      return mergeSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch { /* try next */ }
  }
  return mergeSettings(null);
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SITE_SETTINGS,
  getSiteSettings,
  setSiteSettings,
  ensureSiteSettingsSeeded,
  getPublicSiteSettings,
  exportSiteSettingsJson,
  exportSiteSettingsJsonSync,
  loadStaticSiteSettings,
  mergeSettings,
};