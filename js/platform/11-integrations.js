/**
 * Category 11: Contact forms, Mailchimp, Vbout, Acumbamail + Integration API
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.INTEGRATION_PROVIDERS = ['mailchimp', 'vbout', 'acumbamail'];

  P.integrations = {
    mailchimp: { enabled: true, listId: 'urdfw-dfw', apiKey: 'demo-key', serverPrefix: 'us21' },
    vbout: { enabled: true, listId: 'vbout-dfw', apiKey: 'demo-key' },
    acumbamail: { enabled: true, listId: 'acumba-dfw', apiKey: 'demo-key' },
  };

  P.getIntegrationConfig = function (provider) {
    const stored = P.get('integration_config', {});
    if (provider) {
      const base = P.integrations[provider] || {};
      return { ...base, ...(stored[provider] || {}) };
    }
    const out = {};
    P.INTEGRATION_PROVIDERS.forEach((p) => { out[p] = P.getIntegrationConfig(p); });
    return out;
  };

  P.configureIntegration = function (provider, config) {
    if (!P.INTEGRATION_PROVIDERS.includes(provider)) return { error: 'Unknown provider' };
    const stored = P.get('integration_config', {});
    stored[provider] = { ...(stored[provider] || {}), ...config };
    P.set('integration_config', stored);
    if (P.integrations[provider]) Object.assign(P.integrations[provider], config);
    P.logIntegrationApi({ action: 'configure', provider, status: 'success' });
    P.emit('integration:configure', { provider, config: P.getIntegrationConfig(provider) });
    return P.getIntegrationConfig(provider);
  };

  P.logIntegrationApi = function (entry) {
    const log = P.get('integration_api_log', []);
    log.unshift({ id: P.uuid(), ...entry, at: new Date().toISOString() });
    if (log.length > 500) log.length = 500;
    P.set('integration_api_log', log);
  };

  P.getIntegrationStats = function () {
    const sync = P.get('integration_sync', {});
    return P.INTEGRATION_PROVIDERS.map((p) => {
      const cfg = P.getIntegrationConfig(p);
      const records = sync[p] || [];
      return {
        provider: p,
        enabled: !!cfg.enabled,
        listId: cfg.listId,
        syncedCount: records.length,
        lastSyncAt: records.length ? records[records.length - 1].syncedAt : null,
      };
    });
  };

  P.testIntegration = async function (provider) {
    const cfg = P.getIntegrationConfig(provider);
    if (!cfg.enabled) {
      const fail = { ok: false, provider, error: 'Integration is disabled' };
      P.logIntegrationApi({ action: 'test', provider, status: 'failed', error: fail.error });
      return fail;
    }
    await new Promise((r) => setTimeout(r, 180 + Math.floor(Math.random() * 120)));
    const latencyMs = 120 + Math.floor(Math.random() * 80);
    const result = {
      ok: true,
      provider,
      listId: cfg.listId,
      apiKeySet: !!(cfg.apiKey && cfg.apiKey.length > 4),
      message: `Connected to ${provider} list "${cfg.listId}"`,
      latencyMs,
    };
    P.logIntegrationApi({ action: 'test', provider, status: 'success', latencyMs });
    P.emit('integration:test', result);
    return result;
  };

  P.syncToIntegration = function (provider, email, tags, meta) {
    const cfg = P.getIntegrationConfig(provider);
    if (!cfg.enabled) {
      P.logIntegrationApi({ action: 'sync', provider, email, status: 'skipped', reason: 'disabled' });
      return { ok: false, error: 'Integration disabled' };
    }

    const sync = P.get('integration_sync', {});
    sync[provider] = sync[provider] || [];
    const record = {
      id: P.uuid().slice(0, 10),
      email,
      tags: tags || [],
      meta: meta || {},
      syncedAt: Date.now(),
      listId: cfg.listId,
      status: 'synced',
    };
    sync[provider].push(record);
    P.set('integration_sync', sync);

    P.logIntegrationApi({ action: 'sync', provider, email, tags, status: 'success', recordId: record.id });
    P.emit('integration:sync', { provider, email, record });
    if (P.api?.webhooks?.trigger) {
      P.api.webhooks.trigger('integration_sync', { provider, email, tags });
    }
    return { ok: true, provider, record };
  };

  P.syncBulkToIntegration = async function (provider, emails, tags) {
    const list = emails || [];
    const results = [];
    for (const email of list) {
      results.push(P.syncToIntegration(provider, email, tags));
      await new Promise((r) => setTimeout(r, 40));
    }
    return {
      ok: true,
      provider,
      synced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  };

  P.subscribeWithIntegrations = function (email, providers) {
    const subs = P.get('subscribers', []);
    if (!subs.includes(email)) {
      subs.push(email);
      P.set('subscribers', subs);
    }
    const targets = providers || P.INTEGRATION_PROVIDERS.filter((p) => P.getIntegrationConfig(p).enabled);
    const synced = targets.map((p) => P.syncToIntegration(p, email, ['newsletter']));
    return { ok: true, email, synced: synced.filter((s) => s.ok).length, providers: targets };
  };

  P.contactListingOwner = function (listingId, data) {
    const leads = P.get('leads', []);
    const lead = {
      id: P.uuid(),
      listingId,
      church: data.church || listingId,
      targetEmail: data.targetEmail,
      name: data.name,
      email: data.email,
      message: data.message,
      status: 'new',
      date: new Date().toISOString(),
    };
    leads.unshift(lead);
    P.set('leads', leads);
    P.sendEmail('contact_auto_reply', { email: data.email, name: data.name });
    P.sendEmail('contact_admin', { email: data.email, message: data.message });
    P.trackClick('contact', listingId);
    P.logIntegrationApi({ action: 'contact', provider: 'contact-form', status: 'success', listingId });
    return lead;
  };

  P.submitSupportForm = function (data) {
    const tickets = P.get('support_tickets', []);
    tickets.unshift({ id: P.uuid(), ...data, status: 'open', at: Date.now() });
    P.set('support_tickets', tickets);
    P.sendEmail('contact_admin', data);
    P.logIntegrationApi({ action: 'support', provider: 'support-form', status: 'success' });
    return tickets[0];
  };

  P.getIntegrationLog = function (provider, limit) {
    const log = P.get('integration_api_log', []);
    const filtered = provider ? log.filter((e) => e.provider === provider) : log;
    return filtered.slice(0, limit || 50);
  };

  P.renderContactForm = function (container, listing) {
    if (!container) return;
    container.innerHTML = `
      <form id="urdfw-contact-owner" class="space-y-3 text-sm border rounded-xl p-4">
        <div class="font-semibold">Contact ${listing.name || 'Listing Owner'}</div>
        <input name="name" required placeholder="Your name" class="w-full border rounded px-3 py-2">
        <input name="email" type="email" required placeholder="Your email" class="w-full border rounded px-3 py-2">
        <textarea name="message" required rows="3" placeholder="Message..." class="w-full border rounded px-3 py-2"></textarea>
        <div class="g-recaptcha-placeholder text-xs text-slate-400 border rounded px-2 py-1">reCAPTCHA verified (demo)</div>
        <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-lg">Send Message</button>
      </form>`;
    container.querySelector('#urdfw-contact-owner').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        listingId: listing.id,
        church: listing.name,
        targetEmail: listing.email,
        name: fd.get('name'),
        email: fd.get('email'),
        message: fd.get('message'),
      };
      if (P.api?.integrations?.contact) {
        await P.api.integrations.contact(payload);
      } else {
        P.contactListingOwner(listing.id, payload);
      }
      e.target.reset();
      if (global.showToast) global.showToast('Message sent to listing owner!');
    };
  };
})(window);