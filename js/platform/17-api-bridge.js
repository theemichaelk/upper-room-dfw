/**
 * API Bridge — unified async layer for member/admin portals.
 * Uses localStorage + platform APIs now; ready for real backend via config.endpoints.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const DEFAULT_ENDPOINTS = {
    base: null,
    auth: '/api/auth',
    clients: '/api/clients',
    billing: '/api/billing',
    listings: '/api/listings',
    messages: '/api/messages',
    support: '/api/support',
    webhooks: '/api/webhooks',
    integrations: '/api/integrations',
  };

  P.apiConfig = {
    mode: 'local',
    endpoints: { ...DEFAULT_ENDPOINTS },
    latencyMs: 280,
  };

  P.loadApiConfig = function () {
    const saved = P.get('api_config', null);
    if (saved) Object.assign(P.apiConfig, saved);
    if (P.config?.api) Object.assign(P.apiConfig, P.config.api);
    return P.apiConfig;
  };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms || P.apiConfig.latencyMs));
  }

  function isProductionHost() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname || '';
    return host.includes('upperroomdfw.com') || host.includes('amplifyapp.com') || host.includes('cloudfront.net');
  }

  function getTokenPayload() {
    const token = localStorage.getItem('urdfw_api_token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  function getTokenRole() {
    return getTokenPayload()?.role || null;
  }

  function normalizeClient(c) {
    if (!c) return c;
    return {
      ...c,
      churchEmail: c.churchEmail || c.church_email || c.email,
      church_email: c.church_email || c.churchEmail || c.email,
      isPaid: !!(c.isPaid ?? c.is_paid),
      trialStart: c.trialStart || c.trial_start,
      listingId: c.listingId || c.listing_id,
      registeredAt: c.registeredAt || c.registered_at,
    };
  }

  function normalizeLead(l) {
    if (!l) return l;
    return {
      ...l,
      churchEmail: l.churchEmail || l.church_email,
      church_email: l.church_email || l.churchEmail,
      listingId: l.listingId || l.listing_id,
      createdAt: l.createdAt || l.created_at,
    };
  }

  async function remoteFetch(path, opts) {
    const base = P.apiConfig.endpoints.base ?? '';
    const token = localStorage.getItem('urdfw_api_token');
    const res = await fetch(base + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts?.headers || {}),
      },
      ...opts,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'API ' + res.status);
    }
    return res.json();
  }

  P.storeApiToken = function (token) {
    if (token) localStorage.setItem('urdfw_api_token', token);
    else localStorage.removeItem('urdfw_api_token');
  };

  P.resolveApiBase = function () {
    P.loadApiConfig();
    const cfg = P.config?.api || {};
    const fallback =
      cfg.fallbackBase ||
      cfg.endpoints?.base ||
      (typeof window !== 'undefined' && window.URDFW_API_BASE) ||
      '';
    return (fallback || '').replace(/\/$/, '');
  };

  P.detectRemoteApi = async function () {
    const candidates = ['', P.resolveApiBase()].filter((v, i, a) => a.indexOf(v) === i);
    for (const base of candidates) {
      try {
        const res = await fetch((base || '') + '/api/health', { credentials: 'omit' });
        if (!res.ok) continue;
        P.apiConfig.mode = 'remote';
        P.apiConfig.endpoints.base = base;
        P.set('api_config', P.apiConfig);
        P.emit('api:connected', await res.json());
        return true;
      } catch { /* try next */ }
    }
    return false;
  };

  async function call(name, localFn, remotePath, remoteBody) {
    P.loadApiConfig();
    const t0 = Date.now();
    let result;
    let source = 'local';

    if (P.apiConfig.mode === 'remote') {
      try {
        const method = remoteBody?.method || (remoteBody ? 'POST' : 'GET');
        const body = remoteBody?.body !== undefined ? remoteBody.body : remoteBody;
        result = await remoteFetch(remotePath, body !== undefined && method !== 'GET'
          ? { method, body }
          : { method: method || 'GET' });
        source = 'remote';
      } catch (e) {
        if (isProductionHost()) {
          P.emit('api:error', { name, error: e.message });
          throw e;
        }
        P.emit('api:fallback', { name, error: e.message });
        result = await localFn();
        source = 'local-fallback';
      }
    } else {
      await delay();
      result = await localFn();
    }

    const log = P.get('api_log', []);
    log.unshift({ name, source, ms: Date.now() - t0, at: new Date().toISOString() });
    if (log.length > 200) log.length = 200;
    P.set('api_log', log);
    P.emit('api:' + name, result);
    return result;
  }

  P.api = {
    getStatus() {
      P.loadApiConfig();
      return {
        mode: P.apiConfig.mode,
        connected: P.apiConfig.mode === 'local' || P.apiConfig.mode === 'remote',
        endpoints: P.apiConfig.endpoints,
        recentCalls: (P.get('api_log', []) || []).slice(0, 8),
      };
    },

    setMode(mode, baseUrl) {
      P.apiConfig.mode = mode;
      if (baseUrl) P.apiConfig.endpoints.base = baseUrl;
      P.set('api_config', P.apiConfig);
      return P.api.getStatus();
    },

    auth: {
      loginAdmin(password, email) {
        const payload = { password };
        if (email) payload.email = (email || '').trim().toLowerCase();
        return call('auth.loginAdmin', async () => {
          if (isProductionHost()) return { ok: false, error: 'Admin login requires API connection' };
          const valid = password === (P.get('admin_password', null) || 'admin123');
          if (!valid) return { ok: false, error: 'Invalid credentials' };
          P.set('admin_session', { at: new Date().toISOString(), role: 'admin' });
          return { ok: true, role: 'admin' };
        }, P.apiConfig.endpoints.auth + '/admin', payload).then((res) => {
          if (res?.token) {
            P.storeApiToken(res.token);
            P.set('admin_session', { at: new Date().toISOString(), role: 'admin', email: res.email });
          }
          return res;
        });
      },

      loginMember(email, password) {
        return call('auth.loginMember', async () => {
          const em = (email || '').trim().toLowerCase();
          let clients = P.get('clients', []);
          let client = clients.find((c) => (c.email || '').toLowerCase() === em);

          if (!client) {
            client = {
              id: 'client-' + P.uuid().slice(0, 8),
              name: em.split('@')[0].replace(/[^a-z]/gi, ' ').trim() || 'Church Partner',
              email: em,
              area: 'Dallas',
              status: 'approved',
              package: 'Standard',
              registeredAt: new Date().toISOString(),
              trialStart: new Date().toISOString(),
              isPaid: false,
              payments: [],
            };
            clients.push(client);
            P.set('clients', clients);
          }

          if (!client.trialStart) client.trialStart = client.registeredAt || new Date().toISOString();
          if (typeof client.isPaid === 'undefined') client.isPaid = false;
          if (!client.payments) client.payments = [];

          const user = P.syncClientToUser ? P.syncClientToUser(client) : P.loginUser(em, password);
          if (password && P.changePassword && user) P.changePassword(user.id, password);

          localStorage.setItem('urdfw_current_client', JSON.stringify(normalizeClient(client)));
          P.set('member_session', { email: em, at: new Date().toISOString() });
          return { ok: true, client: normalizeClient(client), user };
        }, P.apiConfig.endpoints.auth + '/member', { email, password }).then((res) => {
          if (res?.token) P.storeApiToken(res.token);
          if (res?.client) {
            res.client = normalizeClient(res.client);
            localStorage.setItem('urdfw_current_client', JSON.stringify(res.client));
          }
          return res;
        });
      },

      logoutAdmin() {
        P.storeApiToken?.(null);
        P.set('admin_session', null);
        return { ok: true };
      },

      logoutMember() {
        localStorage.removeItem('urdfw_current_client');
        P.storeApiToken?.(null);
        P.set('member_session', null);
        P.set('current_user', null);
        return { ok: true };
      },

      forgotPassword(email) {
        return call('auth.forgotPassword', async () => {
          P.sendEmail('forgot_password', { email, name: email.split('@')[0] });
          return { ok: true, message: 'Reset link sent (simulated). Check email log in Admin → Email.' };
        }, P.apiConfig.endpoints.auth + '/forgot', { email });
      },

      isAdmin() {
        if (getTokenRole() === 'admin') return true;
        if (isProductionHost()) return false;
        return P.get('admin_session', null)?.role === 'admin';
      },

      getMember() {
        try {
          const raw = localStorage.getItem('urdfw_current_client');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      },
    },

    admin: {
      stats() {
        return call('admin.stats', async () => {
          const clients = P.get('clients', []);
          const orders = P.get('orders', []);
          return {
            clients: clients.length,
            pending: clients.filter((c) => c.status === 'pending').length,
            paid: clients.filter((c) => c.isPaid).length,
            listings: P.get('custom_listings', []).length,
            orders: orders.length,
            revenue: orders.reduce((s, o) => s + (o.amount || 0), 0),
            tickets: P.get('support_tickets', []).filter((t) => t.status === 'open').length,
            subscribers: P.get('subscribers', []).length,
          };
        }, '/api/admin/stats');
      },
      orders() {
        return call('admin.orders', async () => P.get('orders', []), '/api/admin/orders');
      },
    },

    clients: {
      list() {
        return call('clients.list', async () => P.get('clients', []), P.apiConfig.endpoints.clients);
      },
      update(id, patch) {
        return call('clients.update', async () => {
          const list = P.get('clients', []);
          const idx = list.findIndex((c) => c.id === id);
          if (idx < 0) return { error: 'Not found' };
          list[idx] = normalizeClient({ ...list[idx], ...patch });
          P.set('clients', list);
          return list[idx];
        }, P.apiConfig.endpoints.clients + '/' + id, { method: 'PATCH', body: patch });
      },
      approve(id) {
        return P.api.clients.update(id, { status: 'approved' });
      },
    },

    billing: {
      charge(opts) {
        return call('billing.charge', async () => {
          const order = P.processPayment(opts);
          const clients = P.get('clients', []);
          const c = clients.find((x) => x.email === opts.email);
          if (c) {
            c.isPaid = true;
            c.package = (opts.plan || 'standard').charAt(0).toUpperCase() + (opts.plan || 'standard').slice(1);
            if (!c.payments) c.payments = [];
            c.payments.push({
              date: new Date().toISOString(),
              amount: opts.amount,
              plan: c.package,
              status: 'success',
              method: opts.gateway,
              ref: order?.ref,
              coupon: opts.coupon || null,
            });
            P.set('clients', clients);
            localStorage.setItem('urdfw_current_client', JSON.stringify(c));
          }
          return { order, client: c };
        }, P.apiConfig.endpoints.billing + '/charge', opts);
      },
      getInvoices(email) {
        return call('billing.invoices', async () => {
          const orders = P.get('orders', []);
          const invoices = P.get('invoices', []);
          const clientOrders = orders.filter((o) => !email || o.email === email);
          return invoices.filter((i) => clientOrders.some((o) => o.id === i.orderId) || !email);
        }, P.apiConfig.endpoints.billing + '/invoices');
      },
    },

    listings: {
      save(clientId, data) {
        return call('listings.save', async () => {
          const customs = P.get('custom_listings', []);
          let item = customs.find((x) => x.clientId === clientId || x.id === clientId);
          if (!item) {
            item = { id: 'custom-' + P.uuid().slice(0, 8), clientId, status: 'pending', ...data };
            customs.push(item);
          } else {
            Object.assign(item, data);
          }
          P.set('custom_listings', customs);
          const clients = P.get('clients', []);
          const c = clients.find((x) => x.id === clientId);
          if (c) {
            Object.assign(c, data);
            P.set('clients', clients);
          }
          return item;
        }, P.apiConfig.endpoints.listings, { clientId, data });
      },
    },

    messages: {
      list(userId) {
        return call('messages.list', async () => P.getMessages(userId), P.apiConfig.endpoints.messages);
      },
      send(to, from, subject, body) {
        return call('messages.send', async () => {
          P.sendMessage(to, from, subject, body);
          return { ok: true };
        }, P.apiConfig.endpoints.messages, { to, from, subject, body });
      },
    },

    support: {
      submit(ticket) {
        return call('support.submit', async () => {
          P.submitSupportForm(ticket);
          return { ok: true };
        }, P.apiConfig.endpoints.support, ticket);
      },
      list() {
        return call('support.list', async () => P.get('support_tickets', []), P.apiConfig.endpoints.support);
      },
    },

    integrations: {
      list() {
        return call('integrations.list', async () => ({
          providers: P.getIntegrationStats?.() || [],
          config: P.getIntegrationConfig?.() || {},
          subscribers: P.get('subscribers', []).length,
        }), P.apiConfig.endpoints.integrations);
      },

      get(provider) {
        return call('integrations.get', async () => {
          const cfg = P.getIntegrationConfig?.(provider);
          if (!cfg) return { error: 'Unknown provider' };
          const sync = P.get('integration_sync', {})[provider] || [];
          return { provider, config: cfg, syncedCount: sync.length, recent: sync.slice(-5) };
        }, P.apiConfig.endpoints.integrations + '/' + provider);
      },

      configure(provider, config) {
        return call('integrations.configure', async () => {
          if (!P.configureIntegration) return { error: 'Not available' };
          return { ok: true, config: P.configureIntegration(provider, config) };
        }, P.apiConfig.endpoints.integrations + '/' + provider + '/config', { provider, config });
      },

      test(provider) {
        return call('integrations.test', async () => {
          if (!P.testIntegration) return { error: 'Not available' };
          return P.testIntegration(provider);
        }, P.apiConfig.endpoints.integrations + '/' + provider + '/test', { provider });
      },

      sync(provider, opts) {
        opts = opts || {};
        return call('integrations.sync', async () => {
          const emails = opts.emails || (opts.email ? [opts.email] : []);
          const tags = opts.tags || ['newsletter'];
          if (!emails.length) return { ok: false, error: 'No emails provided' };
          if (P.syncBulkToIntegration) return P.syncBulkToIntegration(provider, emails, tags);
          emails.forEach((e) => P.syncToIntegration(provider, e, tags));
          return { ok: true, provider, synced: emails.length };
        }, P.apiConfig.endpoints.integrations + '/' + provider + '/sync', { provider, ...opts });
      },

      syncAll(provider) {
        return call('integrations.syncAll', async () => {
          const subs = P.get('subscribers', []);
          if (!subs.length) return { ok: false, error: 'No subscribers to sync' };
          if (P.syncBulkToIntegration) return P.syncBulkToIntegration(provider, subs, ['newsletter']);
          subs.forEach((e) => P.syncToIntegration(provider, e, ['newsletter']));
          return { ok: true, provider, synced: subs.length };
        }, P.apiConfig.endpoints.integrations + '/' + provider + '/sync-all', { provider });
      },

      subscribe(email, providers) {
        return call('integrations.subscribe', async () => {
          if (!P.subscribeWithIntegrations) return { error: 'Not available' };
          return P.subscribeWithIntegrations(email, providers);
        }, P.apiConfig.endpoints.integrations + '/subscribe', { email, providers });
      },

      contact(data) {
        return call('integrations.contact', async () => {
          const lead = P.contactListingOwner(data.listingId, data);
          return { ok: true, lead };
        }, P.apiConfig.endpoints.integrations + '/contact', data);
      },

      submitSupport(data) {
        return call('integrations.support', async () => {
          const ticket = P.submitSupportForm(data);
          return { ok: true, ticket };
        }, P.apiConfig.endpoints.integrations + '/support', data);
      },

      getLog(provider, limit) {
        return call('integrations.log', async () => ({
          entries: P.getIntegrationLog?.(provider, limit) || [],
        }), P.apiConfig.endpoints.integrations + '/log' + (provider ? '/' + provider : ''));
      },
    },

    claims: {
      list() {
        return call('claims.list', async () => P.get('claims', []), '/api/claims');
      },
      submit(data) {
        return call('claims.submit', async () => {
          const list = P.get('claims', []);
          const claim = { id: P.uuid(), ...data, status: 'pending', at: new Date().toISOString() };
          list.push(claim);
          P.set('claims', list);
          return { ok: true, claim };
        }, '/api/claims', data);
      },
      approve(id) {
        return call('claims.approve', async () => {
          const list = P.get('claims', []);
          const c = list.find((x) => x.id === id);
          if (c) c.status = 'approved';
          P.set('claims', list);
          return { ok: true };
        }, '/api/claims/' + id, { method: 'PATCH', body: { status: 'approved' } });
      },
    },

    reviews: {
      list(listingId) {
        const q = listingId ? '?listingId=' + encodeURIComponent(listingId) : '';
        return call('reviews.list', async () => {
          const all = P.get('reviews', {});
          return all[listingId] || [];
        }, '/api/reviews' + q);
      },
      add(data) {
        return call('reviews.add', async () => {
          if (P.addReview) P.addReview(data.listingId, data);
          return { ok: true };
        }, '/api/reviews', data);
      },
      listAll() {
        return call('reviews.listAll', async () => {
          const all = P.get('reviews', {});
          return Object.entries(all).flatMap(([lid, revs]) => revs.map((r) => ({ ...r, listingId: lid })));
        }, '/api/admin/reviews');
      },
    },

    webhooks: {
      list() {
        return call('webhooks.list', async () => P.get('webhooks', []), '/api/webhooks').then((r) => r?.webhooks || r || []);
      },
      register(url, events) {
        return call('webhooks.register', async () => {
          const hooks = P.get('webhooks', []);
          hooks.push({ id: P.uuid(), url, events: events || ['*'], createdAt: new Date().toISOString() });
          P.set('webhooks', hooks);
          return hooks[hooks.length - 1];
        }, '/api/webhooks', { url, events, label: 'Admin UI' }).then((r) => r?.webhook || r);
      },
      remove(id) {
        return call('webhooks.remove', async () => {
          P.set('webhooks', P.get('webhooks', []).filter((h) => h.id !== id));
          return { ok: true };
        }, '/api/webhooks/' + id, { method: 'DELETE' });
      },
      log() {
        return call('webhooks.log', async () => P.get('webhook_log', []), '/api/webhooks/log').then((r) => r?.entries || r || []);
      },
      eventsLog() {
        return call('events.log', async () => [], '/api/events/log').then((r) => r?.entries || r || []);
      },
      trigger(event, payload) {
        const hooks = P.get('webhooks', []);
        const log = P.get('webhook_log', []);
        hooks.forEach((h) => {
          if (h.events.includes('*') || h.events.includes(event)) {
            log.unshift({ hookId: h.id, url: h.url, event, payload, at: new Date().toISOString(), status: 'queued' });
          }
        });
        P.set('webhook_log', log);
        P.emit('webhook:' + event, payload);
        return { queued: log.length };
      },
    },

    exportAll() {
      return {
        clients: P.get('clients', []),
        users: P.get('users', []),
        orders: P.get('orders', []),
        invoices: P.get('invoices', []),
        listings: P.get('custom_listings', []),
        leads: P.get('leads', []),
        subscribers: P.get('subscribers', []),
        support: P.get('support_tickets', []),
        claims: P.get('claims', []),
        exportedAt: new Date().toISOString(),
      };
    },
  };

  P.loadApiConfig();
  P.detectRemoteApi?.();

  P.syncPlatformFromApi = async function () {
    if (P.apiConfig.mode !== 'remote' || !localStorage.getItem('urdfw_api_token')) return;
    try {
      const me = await remoteFetch('/api/auth/me');
      if (me?.client) {
        const client = normalizeClient(me.client);
        localStorage.setItem('urdfw_current_client', JSON.stringify(client));
        P.set('member_session', { email: client.email, at: new Date().toISOString() });
      }

      const role = getTokenRole();
      if (role === 'admin') {
        const [clients, orders, stats, claims, tickets] = await Promise.all([
          remoteFetch('/api/clients').catch(() => []),
          remoteFetch('/api/admin/orders').catch(() => []),
          remoteFetch('/api/admin/stats').catch(() => null),
          remoteFetch('/api/claims').catch(() => []),
          remoteFetch('/api/support').catch(() => []),
        ]);
        if (Array.isArray(clients)) P.set('clients', clients.map(normalizeClient));
        if (Array.isArray(orders)) P.set('orders', orders);
        if (stats) P.set('admin_stats_cache', stats);
        if (Array.isArray(claims)) P.set('claims', claims);
        if (Array.isArray(tickets)) P.set('support_tickets', tickets);
      } else if (me?.client) {
        const [leads, invoices, claims, msgs] = await Promise.all([
          remoteFetch('/api/leads').catch(() => []),
          remoteFetch('/api/billing/invoices').catch(() => []),
          remoteFetch('/api/claims').catch(() => []),
          remoteFetch('/api/messages').catch(() => []),
        ]);
        if (Array.isArray(leads)) P.set('leads', leads.map(normalizeLead));
        if (Array.isArray(invoices)) P.set('invoices', invoices);
        if (Array.isArray(claims)) P.set('claims', claims);
        if (Array.isArray(msgs) && me?.user?.sub) P.set('messages_' + me.user.sub, msgs);
      }
      P.emit('api:synced', { role });
    } catch (e) {
      if (isProductionHost()) P.emit('api:sync-failed', { error: e.message });
    }
  };

  P.normalizeClient = normalizeClient;
  P.normalizeLead = normalizeLead;
  P.getTokenRole = getTokenRole;
})(window);