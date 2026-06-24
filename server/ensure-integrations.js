const {
  seedPlatformIntegrations,
  envProviderDefaults,
} = require('./services/platform-integrations');

function ensureIntegrations(db) {
  seedPlatformIntegrations(db);
  const env = envProviderDefaults();
  const active = Object.entries(env).filter(([, c]) => c.apiKeySet).map(([p]) => p);
  if (active.length) {
    console.log(`  Integrations: platform .env active — ${active.join(', ')}`);
  } else {
    console.log('  Integrations: no provider API keys in .env');
  }
}

module.exports = { ensureIntegrations };