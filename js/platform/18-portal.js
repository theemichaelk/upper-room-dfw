/**
 * Portal UI — admin & member login shells, sidebar navigation, API status
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.portalToast = function (msg) {
    const el = document.createElement('div');
    el.className = 'portal-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  };

  P.initAdminPortal = function (opts) {
    opts = opts || {};
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('admin-app');
    const rootId = opts.rootId || 'admin-platform-root';
    if (!loginEl) return;

    const form = loginEl.querySelector('#admin-login-form');
    const emailInput = loginEl.querySelector('#admin-email');
    const passInput = loginEl.querySelector('#admin-pass');
    const toggleBtn = loginEl.querySelector('#admin-toggle-pass');
    const forgotBtn = loginEl.querySelector('#admin-forgot-pass');

    if (toggleBtn && passInput) {
      toggleBtn.onclick = () => {
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
        toggleBtn.querySelector('i').classList.toggle('fa-eye');
        toggleBtn.querySelector('i').classList.toggle('fa-eye-slash');
      };
    }

    if (forgotBtn) {
      forgotBtn.onclick = async (e) => {
        e.preventDefault();
        const email = prompt('Enter admin email for reset link:', 'admin@upperroomdfw.org');
        if (!email) return;
        const res = await P.api.auth.forgotPassword(email);
        P.portalToast(res.message || 'Reset email sent.');
      };
    }

    const doLogin = async () => {
      const pass = passInput?.value || '';
      const email = emailInput?.value || '';
      const btn = form?.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…'; }

      const res = await P.api.auth.loginAdmin(pass, email);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Enter Admin Dashboard'; }

      if (!res.ok) {
        loginEl.querySelector('#admin-login-error')?.classList.remove('hidden');
        return;
      }

      if (res.token) P.storeApiToken?.(res.token);

      /* Show dashboard immediately — sync API data in background (was blocking login 5–15s) */
      loginEl.classList.add('hidden');
      if (appEl) appEl.classList.remove('hidden');
      P.renderAdminShell(rootId);
      if (opts.onLogin) opts.onLogin();
      P.syncPlatformFromApi?.({ background: true });
    };

    if (form) {
      form.onsubmit = (e) => { e.preventDefault(); doLogin(); };
    }

    loginEl.querySelector('#admin-demo-fill')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (emailInput) emailInput.value = 'michaelk@tsbrenterprises.com';
      if (passInput) passInput.value = 'Kingme05$';
    });

    if (P.api.auth.isAdmin() && localStorage.getItem('urdfw_api_token')) {
      loginEl.classList.add('hidden');
      if (appEl) appEl.classList.remove('hidden');
      P.renderAdminShell(rootId);
      if (opts.onLogin) opts.onLogin();
      P.syncPlatformFromApi?.({ background: true });
    }
  };

  P.renderAdminShell = function (rootId) {
    const app = document.getElementById('admin-app');
    const root = document.getElementById(rootId);
    if (!app || !root) return;

    const sidebar = app.querySelector('#admin-sidebar-nav');
    if (sidebar && !sidebar.dataset.bound) {
      sidebar.dataset.bound = '1';
      sidebar.querySelectorAll('.portal-nav-item[data-admin-tab]').forEach((btn) => {
        btn.onclick = () => {
          sidebar.querySelectorAll('.portal-nav-item').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const tab = btn.dataset.adminTab;
          if (tab) P.showAdminTab(tab);
        };
      });
    }

    P.initAdminDashboard(rootId);
    P.renderAdminQuickStats();
    P.renderApiStatusPanel('admin-api-status');
  };

  P.renderAdminQuickStats = async function () {
    const el = document.getElementById('admin-quick-stats');
    if (!el) return;

    let stats = null;
    if (P.apiConfig.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try { stats = await P.api.admin.stats(); } catch { /* fallback */ }
    }

    const clients = stats ? stats.clients : P.get('clients', []).length;
    const orders = stats ? stats.orders : P.get('orders', []).length;
    const subs = stats ? stats.subscribers : P.get('subscribers', []).length;
    const tickets = stats ? stats.tickets : P.get('support_tickets', []).filter((t) => t.status === 'open').length;
    const mrr = stats ? stats.revenue : (() => {
      let n = 0;
      P.get('clients', []).forEach((c) => { if (c.isPaid) n += c.package === 'Premium' ? 79 : 29; });
      return n;
    })();

    el.innerHTML = `
      <div class="portal-stat"><div class="portal-stat-label">Clients</div><div class="portal-stat-value">${clients}</div></div>
      <div class="portal-stat"><div class="portal-stat-label">Revenue</div><div class="portal-stat-value">$${mrr}</div></div>
      <div class="portal-stat"><div class="portal-stat-label">Orders</div><div class="portal-stat-value">${orders}</div></div>
      <div class="portal-stat"><div class="portal-stat-label">Subscribers</div><div class="portal-stat-value">${subs}</div></div>
      <div class="portal-stat"><div class="portal-stat-label">Open Tickets</div><div class="portal-stat-value">${tickets}</div></div>`;
  };

  P.renderApiStatusPanel = function (containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const st = P.api.getStatus();
    el.innerHTML = `
      <span class="portal-api-status ${st.connected ? '' : 'offline'}">
        <i class="fa-solid fa-circle text-[8px]"></i>
        API: ${st.mode}${st.endpoints.base ? ' → ' + st.endpoints.base : ' (localStorage)'}
      </span>`;
  };

  P.initMemberPortalLogin = function (opts) {
    opts = opts || {};
    const gate = document.getElementById('login-gate');
    if (!gate) return;

    const form = gate.querySelector('#client-login-form');
    const forgotBtn = gate.querySelector('#member-forgot-pass');

    forgotBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = gate.querySelector('#client-email')?.value?.trim();
      if (!email) { alert('Enter your email first.'); return; }
      const res = await P.api.auth.forgotPassword(email);
      P.portalToast(res.message || 'Check your inbox.');
    });

    gate.querySelector('#member-demo-fill')?.addEventListener('click', (e) => {
      e.preventDefault();
      const em = gate.querySelector('#client-email');
      if (em) em.value = 'hello@thegrovearlington.org';
    });

    if (opts.onReady) opts.onReady();
  };

  P.adminLogout = function () {
    P.api.auth.logoutAdmin();
    document.getElementById('admin-app')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    const pass = document.getElementById('admin-pass');
    if (pass) pass.value = '';
  };
})(window);