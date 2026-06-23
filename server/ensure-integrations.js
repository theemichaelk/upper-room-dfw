const { setIntegrationSettings } = require('./services/platform-settings');

function ensureIntegrations(db) {
  const defaults = {
    mailchimp: {
      listId: process.env.MAILCHIMP_LIST_ID || '',
      enabled: !!process.env.MAILCHIMP_API_KEY,
    },
    vbout: {
      listId: process.env.VBOUT_LIST_ID || '',
      enabled: !!process.env.VBOUT_API_KEY,
    },
  };

  for (const [provider, cfg] of Object.entries(defaults)) {
    if (!cfg.listId) continue;
    const current = require('./services/platform-settings').getIntegrationSettings(db, provider);
    if (!current.listId) {
      setIntegrationSettings(db, provider, cfg);
      console.log(`  Integrations: seeded ${provider} listId=${cfg.listId}`);
    }
  }
}

module.exports = { ensureIntegrations };