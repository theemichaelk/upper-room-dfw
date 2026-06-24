const { getIntegrationSettings, setIntegrationSettings } = require('./platform-settings');
const { integrationConfig } = require('./integrations');
const { isStripeEnabled } = require('./stripe');

const PROVIDERS = ['mailchimp', 'vbout', 'acumbamail'];

function maskKey(val) {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 4) return '••••';
  return '••••' + val.slice(-4);
}

function mailchimpPrefix() {
  if (process.env.MAILCHIMP_SERVER_PREFIX) return process.env.MAILCHIMP_SERVER_PREFIX;
  const key = process.env.MAILCHIMP_API_KEY || '';
  const parts = key.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function envProviderDefaults() {
  return {
    mailchimp: {
      enabled: !!process.env.MAILCHIMP_API_KEY,
      source: 'env',
      listId: process.env.MAILCHIMP_LIST_ID || '',
      apiKey: maskKey(process.env.MAILCHIMP_API_KEY),
      apiKeySet: !!process.env.MAILCHIMP_API_KEY,
      serverPrefix: mailchimpPrefix(),
    },
    vbout: {
      enabled: !!process.env.VBOUT_API_KEY,
      source: 'env',
      listId: process.env.VBOUT_LIST_ID || '',
      apiKey: maskKey(process.env.VBOUT_API_KEY),
      apiKeySet: !!process.env.VBOUT_API_KEY,
    },
    acumbamail: {
      enabled: !!process.env.ACUMBAMAIL_API_KEY,
      source: 'env',
      listId: process.env.ACUMBAMAIL_LIST_ID || '',
      apiKey: maskKey(process.env.ACUMBAMAIL_API_KEY),
      apiKeySet: !!process.env.ACUMBAMAIL_API_KEY,
    },
  };
}

function seedPlatformIntegrations(db) {
  const envDefaults = envProviderDefaults();
  for (const [provider, cfg] of Object.entries(envDefaults)) {
    const current = getIntegrationSettings(db, provider);
    const patch = {
      enabled: cfg.enabled,
      listId: current.listId || cfg.listId,
      source: 'env',
      apiKeySet: cfg.apiKeySet,
    };
    setIntegrationSettings(db, provider, patch);
  }
}

function getAdminPlatformIntegrations(db) {
  const envDefaults = envProviderDefaults();
  const providers = {};
  for (const p of PROVIDERS) {
    const stored = getIntegrationSettings(db, p);
    providers[p] = {
      ...envDefaults[p],
      listId: stored.listId || envDefaults[p].listId,
      enabled: stored.enabled !== false && envDefaults[p].apiKeySet,
    };
  }
  return {
    source: 'env',
    providers,
    platform: integrationConfig(),
    stripe: {
      enabled: isStripeEnabled(),
      mode: process.env.STRIPE_MODE || 'live',
      publishableKey: maskKey(process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY_LIVE || ''),
      pricesConfigured: !!(process.env.STRIPE_PRICE_STANDARD && process.env.STRIPE_PRICE_PREMIUM),
    },
    smtp: {
      enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      provider: process.env.SMTP_PROVIDER || (process.env.SMTP_HOST?.includes('acumbamail') ? 'acumbamail' : 'smtp'),
      host: process.env.SMTP_HOST || null,
      user: process.env.SMTP_USER || null,
      from: process.env.EMAIL_FROM || null,
    },
    adminEmails: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean),
  };
}

function getClientRow(db, clientId) {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
}

function parseClientData(row) {
  try {
    return row?.data_json ? JSON.parse(row.data_json) : {};
  } catch {
    return {};
  }
}

function getMemberIntegrations(db, clientId) {
  const row = getClientRow(db, clientId);
  if (!row) return { ok: false, error: 'Client not found' };
  const data = parseClientData(row);
  const stored = data.integrations || {};
  const out = {};
  for (const p of PROVIDERS) {
    const s = stored[p] || {};
    out[p] = {
      enabled: !!s.enabled,
      listId: s.listId || '',
      apiKey: s.apiKey ? maskKey(s.apiKey) : '',
      apiKeySet: !!(s.apiKey && s.apiKey.length > 4),
      source: 'member',
    };
  }
  return { ok: true, clientId, integrations: out };
}

function setMemberIntegration(db, clientId, provider, patch) {
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'Unknown provider' };
  const row = getClientRow(db, clientId);
  if (!row) return { ok: false, error: 'Client not found' };
  const data = parseClientData(row);
  data.integrations = data.integrations || {};
  const prev = data.integrations[provider] || {};
  const next = {
    enabled: patch.enabled !== undefined ? !!patch.enabled : !!prev.enabled,
    listId: patch.listId !== undefined ? String(patch.listId || '') : (prev.listId || ''),
    apiKey: patch.apiKey !== undefined && patch.apiKey
      ? String(patch.apiKey)
      : (prev.apiKey || ''),
  };
  if (patch.clearApiKey) next.apiKey = '';
  data.integrations[provider] = next;
  db.prepare('UPDATE clients SET data_json = ? WHERE id = ?').run(JSON.stringify(data), clientId);
  return {
    ok: true,
    provider,
    config: {
      enabled: next.enabled,
      listId: next.listId,
      apiKey: maskKey(next.apiKey),
      apiKeySet: !!(next.apiKey && next.apiKey.length > 4),
      source: 'member',
    },
  };
}

function updateAdminProviderSettings(db, provider, patch) {
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'Unknown provider' };
  const envDefaults = envProviderDefaults();
  if (!envDefaults[provider]?.apiKeySet) {
    return { ok: false, error: `${provider} API key not configured in server .env` };
  }
  const cfg = setIntegrationSettings(db, provider, {
    listId: patch.listId,
    enabled: patch.enabled !== false,
    source: 'env',
    apiKeySet: true,
  });
  return {
    ok: true,
    config: {
      ...envDefaults[provider],
      listId: cfg.listId || envDefaults[provider].listId,
      enabled: cfg.enabled !== false,
    },
  };
}

module.exports = {
  PROVIDERS,
  maskKey,
  seedPlatformIntegrations,
  getAdminPlatformIntegrations,
  getMemberIntegrations,
  setMemberIntegration,
  updateAdminProviderSettings,
  envProviderDefaults,
};