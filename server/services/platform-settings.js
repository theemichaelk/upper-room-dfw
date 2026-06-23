/**
 * Platform settings persisted in SQLite (integration overrides, social links).
 */
function getSetting(db, key, fallback) {
  const row = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function setSetting(db, key, value) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
  return value;
}

function getIntegrationSettings(db, provider) {
  const all = getSetting(db, 'integration_config', {});
  return all[provider] || {};
}

function setIntegrationSettings(db, provider, patch) {
  const all = getSetting(db, 'integration_config', {});
  all[provider] = { ...(all[provider] || {}), ...patch };
  setSetting(db, 'integration_config', all);
  return all[provider];
}

const DEFAULT_SOCIAL = {
  facebook: 'https://facebook.com/TheUpperRoomDFW',
  instagram: 'https://instagram.com/TheUpperRoomDFW',
  twitter: 'https://x.com/TheUpperRoomDFW',
  youtube: 'https://youtube.com/@UpperRoomDFW',
  linkedin: 'https://linkedin.com/company/upperroomdfw',
};

function getSocialLinks(db) {
  return { ...DEFAULT_SOCIAL, ...getSetting(db, 'social_links', {}) };
}

function setSocialLinks(db, links) {
  return setSetting(db, 'social_links', { ...DEFAULT_SOCIAL, ...links });
}

module.exports = {
  getSetting,
  setSetting,
  getIntegrationSettings,
  setIntegrationSettings,
  getSocialLinks,
  setSocialLinks,
  DEFAULT_SOCIAL,
};