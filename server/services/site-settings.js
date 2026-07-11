/**
 * Site-wide telemetry, head injection, widgets — persisted in platform_settings.
 */
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting } = require('./platform-settings');
const { normalizeSearchConsole } = require('./verification-tokens');

const SETTINGS_KEY = 'site_settings';

const DEFAULT_SITE_SETTINGS = {
  version: '1.0.0',
  customHeadHtml: '',
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
  return path.join(__dirname, '..', '..');
}

function exportSiteSettingsJson(db, rootDir) {
  const root = rootDir || projectRoot();
  const outPath = path.join(root, 'data', 'site-settings.json');
  const payload = getPublicSiteSettings(db);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
  return { ok: true, path: outPath, bytes: fs.statSync(outPath).size };
}

function loadStaticSiteSettings(rootDir) {
  const file = path.join(rootDir || projectRoot(), 'data', 'site-settings.json');
  if (!fs.existsSync(file)) return mergeSettings(null);
  try {
    return mergeSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return mergeSettings(null);
  }
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SITE_SETTINGS,
  getSiteSettings,
  setSiteSettings,
  getPublicSiteSettings,
  exportSiteSettingsJson,
  loadStaticSiteSettings,
  mergeSettings,
};