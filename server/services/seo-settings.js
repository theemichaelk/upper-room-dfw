const { getSetting, setSetting } = require('./platform-settings');

const DEFAULT_PAGES = [
  'index.html', 'directory.html', 'features.html', 'pricing.html', 'contact.html',
  'about.html', 'register.html', 'member-dashboard.html',
];

function getSeoPages(db) {
  const stored = getSetting(db, 'seo_pages', {});
  const out = {};
  for (const page of DEFAULT_PAGES) {
    out[page] = { title: '', description: '', noindex: false, ...(stored[page] || {}) };
  }
  return { pages: out, defaults: DEFAULT_PAGES };
}

function getSeoPage(db, pageId) {
  const all = getSetting(db, 'seo_pages', {});
  return { pageId, ...(all[pageId] || { title: '', description: '', noindex: false }) };
}

function setSeoPage(db, pageId, patch) {
  const all = getSetting(db, 'seo_pages', {});
  all[pageId] = { ...(all[pageId] || {}), ...patch };
  setSetting(db, 'seo_pages', all);
  return { pageId, ...all[pageId] };
}

module.exports = { getSeoPages, getSeoPage, setSeoPage, DEFAULT_PAGES };