/**
 * Upper Room DFW — Member Dashboard v2
 */
(function (global) {
  let currentClient = null;
  let leadsFilter = 'all';
  let overviewChart = null;
  let apiLeadsCache = null;

  const trainingModules = [
    { id: 1, title: 'Optimizing Your Listing for Local SEO', content: 'Use DFW-area keywords, service times, and fresh photos so families searching "churches near me" find you.', tip: 'Update photos monthly for up to 40% more profile views.' },
    { id: 2, title: 'Connecting with Families via the Directory', content: 'Respond within 24 hours. Highlight youth and family programs that match directory filters.', tip: 'Tag youth + your city to appear in combined searches.' },
    { id: 3, title: 'Managing Leads & Building Trust', content: 'Every contact form submission lands in Leads & CRM. Follow up personally with testimonies and invites.', tip: 'Personalized replies convert 3× better than templates.' },
    { id: 4, title: 'Subscription, Payments & Visibility', content: 'Standard ($29) or Premium ($79) keeps featured placement, analytics, and lead priority active.', tip: 'Premium unlocks homepage rotation — 4–6× more inquiries.' },
    { id: 5, title: 'Events, Digests & Community Impact', content: 'Promote events through email updates and track what ministries drive the most contacts.', tip: 'Post events in your listing and link to email-updates.' },
    { id: 6, title: 'AI & Keyword Search for Maximum Reach', content: 'Optimize for real Texas searches: bilingual Dallas, youth Frisco, outreach Mesquite.', tip: 'Add specific cities plus DFW to your keyword list.' },
    { id: 7, title: 'Verified Listings & Community Trust', content: 'Complete profile, safety policies, and training for the verified badge families trust.', tip: 'Verified churches rank higher in Best Match sort.' },
  ];

  const TAB_MAP = ['overview', 'billing', 'training', 'listing', 'leads', 'profile', 'messages', 'media', 'saved', 'support', 'notifications', 'reviews', 'claims', 'analytics'];

  const MEMBER_TAB_INDEX = {
    overview: 0, billing: 1, training: 2, listing: 3, leads: 4,
    profile: 5, messages: 6, media: 7, saved: 8, support: 9,
    notifications: 10, reviews: 11, claims: 12, analytics: 13,
  };

  function bindMemberSidebarNav() {
    const drawer = document.getElementById('member-sidebar');
    if (!drawer || drawer.dataset.navBound === '1') return;
    drawer.dataset.navBound = '1';
    drawer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-member-tab]');
      if (!btn) return;
      const tab = btn.dataset.memberTab;
      const idx = MEMBER_TAB_INDEX[tab];
      if (typeof idx !== 'number') return;
      switchMemberTab(idx, tab);
    });
  }

  function getClients() {
    return JSON.parse(localStorage.getItem('urdfw_clients') || '[]');
  }

  function saveClients(clients) {
    localStorage.setItem('urdfw_clients', JSON.stringify(clients));
  }

  function getCurrentClient() {
    const raw = localStorage.getItem('urdfw_current_client');
    return raw ? JSON.parse(raw) : null;
  }

  function setCurrentClient(client) {
    localStorage.setItem('urdfw_current_client', JSON.stringify(client));
  }

  function clearCurrentClient() {
    localStorage.removeItem('urdfw_current_client');
  }

  function getTrialInfo(client) {
    const trialEnd = client.trialStart
      ? new Date(new Date(client.trialStart).getTime() + 14 * 86400000)
      : null;
    const now = new Date();
    const isTrial = trialEnd && now < trialEnd && !client.isPaid;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : 0;
    return { trialEnd, isTrial, daysLeft, isActive: !!client.isPaid };
  }

  function getRelevantLeadsCount(client) {
    if (!client) return 0;
    return getMyLeads(client).length;
  }

  function getMyLeads(client) {
    if (apiLeadsCache) {
      const email = (client.email || '').toLowerCase();
      return apiLeadsCache.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        message: l.message,
        status: l.status || 'new',
        date: l.created_at,
        churchEmail: l.church_email,
      })).filter((l) => (l.churchEmail || '').toLowerCase() === email);
    }
    const email = (client.email || '').toLowerCase();
    const leads = JSON.parse(localStorage.getItem('urdfw_leads') || '[]');
    return leads.filter((l) => {
      if (l.churchEmail && l.churchEmail.toLowerCase() === email) return true;
      if (l.targetEmail && l.targetEmail.toLowerCase() === email) return true;
      if ((l.email || '').toLowerCase() === email) return false;
      const msg = ((l.message || '') + (l.church || '')).toLowerCase();
      const namePart = (client.name || '').toLowerCase().slice(0, 6);
      return namePart && msg.includes(namePart);
    });
  }

  function seedDemoLeadsIfNeeded(client) {
    const key = 'urdfw_leads_seeded_' + (client.email || client.id || '').toLowerCase();
    if (localStorage.getItem(key)) return;

    const email = (client.email || '').toLowerCase();
    const leads = JSON.parse(localStorage.getItem('urdfw_leads') || '[]');
    const church = client.name || 'Your Church';
    const demo = [
      { id: 'lead-' + Date.now() + '-1', date: new Date(Date.now() - 86400000 * 2).toISOString(), name: 'Maria G.', email: 'maria@example.com', message: 'Interested in your youth group for my 14yo daughter. What time is service?', church, churchEmail: email, status: 'new' },
      { id: 'lead-' + Date.now() + '-2', date: new Date(Date.now() - 86400000).toISOString(), name: 'James T.', email: 'jt@family.com', message: 'Looking for a church home in Arlington. Love the description!', church, churchEmail: email, status: 'contacted' },
      { id: 'lead-' + Date.now() + '-3', date: new Date(Date.now() - 3600000 * 5).toISOString(), name: 'The Patel Family', email: 'patels@dfw.com', message: 'Do you have bilingual services? We just moved from Irving.', church, churchEmail: email, status: 'new' },
    ];
    localStorage.setItem('urdfw_leads', JSON.stringify([...demo, ...leads]));
    localStorage.setItem(key, '1');
  }

  function computeTrainingProgress(key) {
    const done = JSON.parse(localStorage.getItem('training_' + (key || '').toLowerCase()) || '[]');
    return Math.round((done.length / trainingModules.length) * 100);
  }

  function updateNavForSession(loggedIn) {
    document.body.classList.toggle('member-session', loggedIn);
  }

  function updateMemberAvatar(client) {
    const el = document.getElementById('member-topbar-avatar');
    if (!el) return;
    const P = global.URDFWPlatform;
    const user = P?.getMemberUser?.(client);
    const img = user?.profileImage || client?.profileImage || client?.image;
    if (img) {
      el.innerHTML = `<img src="${img}" alt="">`;
    } else {
      const initial = (client.name || client.email || 'C').charAt(0).toUpperCase();
      el.innerHTML = `<span>${initial}</span>`;
    }
  }

  async function handleClientLogin(e) {
    e.preventDefault();
    const email = document.getElementById('client-email').value.trim().toLowerCase();
    const pass = document.getElementById('client-pass')?.value || '';
    const btn = e.target.querySelector('button[type="submit"]');
    const btnHtml = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…'; }

    const P = global.URDFWPlatform;
    let client;
    let res = null;

    if (P?.api?.auth?.loginMember) {
      res = await P.api.auth.loginMember(email, pass);
      if (!res.ok) {
        if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
        alert(res.error || 'Login failed.');
        return;
      }
      client = res.client;
      setCurrentClient(client);
    } else {
      let clients = getClients();
      client = clients.find((c) => (c.email || '').toLowerCase() === email);
      if (!client) {
        client = {
          id: 'demo-' + Date.now(),
          name: email.split('@')[0].replace(/[^a-z]/gi, ' ').trim() || 'Demo Church',
          email,
          area: 'Dallas',
          status: 'approved',
          package: 'Standard',
          registeredAt: new Date(Date.now() - 1000 * 3600 * 24 * 3).toISOString(),
          trialStart: new Date(Date.now() - 1000 * 3600 * 24 * 3).toISOString(),
          isPaid: false,
          payments: [],
        };
        clients.push(client);
        saveClients(clients);
      }
      if (!client.trialStart) client.trialStart = client.registeredAt || new Date().toISOString();
      if (typeof client.isPaid === 'undefined') client.isPaid = false;
      if (!client.payments) client.payments = [];
      setCurrentClient(client);
      const idx = clients.findIndex((c) => c.id === client.id);
      if (idx > -1) clients[idx] = client;
      saveClients(clients);
    }

    if (res?.token) P?.storeApiToken?.(res.token);
    if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
    showDashboard(client);
    P?.portalToast?.('Welcome back, ' + (client.name || 'partner') + '!');
  }

  function logoutClient() {
    global.URDFWPlatform?.api?.auth?.logoutMember?.();
    clearCurrentClient();
    currentClient = null;
    document.getElementById('dashboard-main').classList.add('hidden');
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('nav-client-name')?.classList.add('hidden');
    document.getElementById('nav-logout-btn').style.display = 'none';
    updateNavForSession(false);
    document.getElementById('dashboard-main')?.classList.remove('drawer-open');
    const drawer = document.getElementById('member-sidebar');
    if (drawer) delete drawer.dataset.navBound;
    if (global.URDFWPlatform) global.URDFWPlatform._memberShellClientId = null;
  }

  async function loadApiLeads() {
    const token = localStorage.getItem('urdfw_api_token');
    if (!token) { apiLeadsCache = null; return; }
    try {
      const res = await fetch('/api/leads', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) apiLeadsCache = await res.json();
    } catch { apiLeadsCache = null; }
  }

  async function showDashboard(client) {
    currentClient = client;

    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('dashboard-main').classList.remove('hidden');
    bindMemberSidebarNav();
    updateNavForSession(true);

    const navName = document.getElementById('nav-client-name');
    if (navName) {
      navName.textContent = client.name || client.email;
      navName.classList.remove('hidden');
    }
    document.getElementById('nav-logout-btn').style.display = 'inline-block';

    const displayName = client.name || 'Church Partner';
    document.getElementById('welcome-name').textContent = displayName;
    const { isTrial, daysLeft, isActive } = getTrialInfo(client);
    const planLabel = isActive ? (client.package || 'Standard') + ' plan' : (isTrial ? 'Trial · ' + daysLeft + ' days left' : 'Trial ended');
    document.getElementById('welcome-sub').textContent = client.email + ' · ' + (client.area || 'DFW') + ' · ' + planLabel;

    updateStatusPill(client);
    updateMemberAvatar(client);
    updateQuickStats(client);
    renderOverview(client);
    renderBilling(client);
    initTraining(client);
    renderMyListing(client);
    renderLeads(client);

    switchMemberTab(0);
    initMemberPlatform(client);
    if (location.hash === '#billing' || sessionStorage.getItem('urdfw_pending_plan')) {
      handlePendingPlan();
    }

    loadApiLeads().then(() => {
      if (currentClient?.id !== client.id) return;
      if (!apiLeadsCache) seedDemoLeadsIfNeeded(client);
      renderLeads(currentClient);
      renderOverview(currentClient);
      updateQuickStats(currentClient);
    });
  }

  function initMemberPlatform(client) {
    const run = () => {
      const P = global.URDFWPlatform;
      if (!P) return false;
      if (P.initMemberPortalShell) P.initMemberPortalShell(client);
      else if (P.initMemberDashboard) P.initMemberDashboard(client);
      updateMemberAvatar(client);
      return true;
    };

    if (run()) return;

    const onReady = () => run();
    if (global.URDFWPlatform?.on) {
      global.URDFWPlatform.on('core:ready', onReady);
    }

    let attempts = 0;
    const retry = () => {
      if (run() || attempts++ > 30) return;
      setTimeout(retry, 200);
    };
    setTimeout(retry, 100);
  }

  function updateStatusPill(client) {
    const el = document.getElementById('status-pill');
    if (!el) return;
    const { isTrial, daysLeft, isActive } = getTrialInfo(client);

    if (isActive) {
      el.textContent = (client.package || 'Standard') + ' active';
      el.className = 'member-pill is-active';
    } else if (isTrial) {
      el.textContent = 'Trial · ' + daysLeft + 'd left';
      el.className = 'member-pill is-trial';
    } else {
      el.textContent = 'Subscribe to restore access';
      el.className = 'member-pill is-expired';
    }
  }

  function updateQuickStats(client) {
    const clients = getClients();
    const idx = clients.findIndex((c) => c.id === client.id);
    const live = clients[idx] || client;

    document.getElementById('stat-listing').textContent = live.status === 'approved' || live.isPaid ? 'Live' : 'Pending';
    document.getElementById('stat-training').textContent = computeTrainingProgress(live.email || live.id);
    document.getElementById('stat-leads').textContent = String(getRelevantLeadsCount(live));
    document.getElementById('stat-plan').textContent = live.isPaid ? (live.package || 'Standard') : 'Trial';

    const P = global.URDFWPlatform;
    if (P?.renderMemberQuickStats) P.renderMemberQuickStats(live);
  }

  function getOnboardingSteps(client) {
    const training = computeTrainingProgress(client.email || client.id);
    const hasListing = !!(client.description || client.phone);
    const hasProfile = !!(client.name && client.area);
    return [
      { id: 'profile', label: 'Complete your profile', done: hasProfile, tab: 5 },
      { id: 'listing', label: 'Publish your listing', done: hasListing, tab: 3 },
      { id: 'training', label: 'Finish training modules', done: training >= 100, tab: 2, progress: training },
      { id: 'billing', label: 'Activate subscription', done: !!client.isPaid, tab: 1 },
    ];
  }

  const NEXT_ACTION_ICONS = {
    profile: 'fa-user-gear',
    listing: 'fa-church',
    training: 'fa-graduation-cap',
    billing: 'fa-credit-card',
    leads: 'fa-envelope-open-text',
    analytics: 'fa-chart-line',
    success: 'fa-sparkles',
  };

  function getNextAction(client) {
    const steps = getOnboardingSteps(client);
    const next = steps.find((s) => !s.done);
    if (next) {
      return { title: next.label, desc: 'Complete this step to unlock full directory visibility and lead tools.', tab: next.tab, cta: 'Continue', icon: NEXT_ACTION_ICONS[next.id] || 'fa-arrow-right' };
    }
    const leads = getMyLeads(client).filter((l) => l.status === 'new');
    if (leads.length) {
      return { title: leads.length + ' new lead' + (leads.length > 1 ? 's' : '') + ' waiting', desc: 'Families reached out through the directory. Reply within 24 hours for best results.', tab: 4, cta: 'View leads', icon: NEXT_ACTION_ICONS.leads };
    }
    if (!client.isPaid) {
      return { title: 'Upgrade for featured placement', desc: 'Premium churches appear on the homepage rotation and receive 4–6× more inquiries.', tab: 1, cta: 'View plans', icon: NEXT_ACTION_ICONS.billing };
    }
    return { title: 'Your dashboard is in great shape', desc: 'Check analytics for listing performance or update your listing with seasonal events.', tab: 13, cta: 'View analytics', icon: NEXT_ACTION_ICONS.success };
  }

  function updateTrainingRing(pct) {
    const ring = document.getElementById('training-ring-fill');
    const ringLabel = document.getElementById('training-pct-ring');
    const circumference = 188.5;
    if (ring) ring.style.strokeDashoffset = String(circumference - (pct / 100) * circumference);
    if (ringLabel) ringLabel.textContent = pct + '%';
  }

  function renderOverview(client) {
    const steps = getOnboardingSteps(client);
    const next = getNextAction(client);

    const focusEl = document.getElementById('member-focus-step');
    if (focusEl) {
      focusEl.innerHTML = `
        <h3>${next.title}</h3>
        <p>${next.desc}</p>
        <button type="button" class="member-focus-cta" onclick="switchMemberTab(${next.tab})">${next.cta} <i class="fa-solid fa-arrow-right"></i></button>`;
    }

    const onboardEl = document.getElementById('member-onboarding');
    if (onboardEl) {
      onboardEl.innerHTML = steps.map((s) => `
        <div class="member-step ${s.done ? 'is-done' : ''}">
          <span class="member-step-mark">${s.done ? '<i class="fa-solid fa-check"></i>' : ''}</span>
          <span>${s.label}${s.progress !== undefined && !s.done ? ' · ' + s.progress + '%' : ''}</span>
        </div>`).join('');
    }

    const previewEl = document.getElementById('overview-leads-preview');
    if (previewEl) {
      const recent = getMyLeads(client).slice(0, 3);
      previewEl.innerHTML = recent.length
        ? recent.map((l) => `
            <div class="member-lead-preview">
              <strong>${l.name}</strong>
              <span>${(l.status || 'new')} · ${new Date(l.date).toLocaleDateString()}</span>
            </div>`).join('')
        : '<p class="member-lead-preview-empty">No leads yet — keep your listing updated.</p>';
    }

    const leads = getRelevantLeadsCount(client);
    const training = computeTrainingProgress(client.email || client.id);
    setTimeout(() => {
      const ctx = document.getElementById('member-overview-chart');
      if (ctx && global.Chart) {
        if (overviewChart) overviewChart.destroy();
        overviewChart = new global.Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Leads', 'Training %', 'Payments', 'Keywords'],
            datasets: [{
              data: [leads, training, (client.payments || []).length, (client.keywords || []).length || 0],
              backgroundColor: ['#0369a1', '#0ea5e9', '#0284c7', '#7dd3fc'],
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 48,
            }],
          },
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'DM Sans' } } },
              x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', weight: '600' } } },
            },
            plugins: { legend: { display: false } },
          },
        });
      }
    }, 150);
  }

  function renderBilling(client) {
    const statusEl = document.getElementById('billing-status');
    const formEl = document.getElementById('payment-form');
    const histEl = document.getElementById('payment-history');
    const { isTrial, isActive } = getTrialInfo(client);
    const needsPay = !isActive;

    if (statusEl) {
      statusEl.textContent = isActive
        ? 'Subscribed on ' + (client.package || 'Standard') + ' — renews monthly.'
        : (isTrial ? 'Free trial active. Pick a plan below to stay live after it ends.' : 'Trial ended. Choose a plan to restore full visibility.');
    }

    if (formEl) formEl.classList.toggle('hidden', !needsPay);

    const portalBtn = document.getElementById('member-billing-portal');
    if (portalBtn) portalBtn.classList.toggle('hidden', !isActive);

    const payments = client.payments || [];
    if (histEl) {
      histEl.innerHTML = payments.length
        ? payments.slice().reverse().map((p) => `
            <div class="py-2.5 flex justify-between text-xs border-b border-slate-100 last:border-0">
              <span>${new Date(p.date).toLocaleDateString()} — ${p.plan || 'Standard'} · ${p.method || 'card'}</span>
              <span class="font-mono text-emerald-600 font-medium">$${p.amount}.00</span>
            </div>`).join('')
        : '<div class="text-xs text-slate-400 py-2">No payments yet. Your first charge appears here after subscribing.</div>';
    }

    bindPlanCards();
    updatePaymentAmount();
  }

  function bindPlanCards() {
    const cards = document.querySelectorAll('.member-plan');
    const planSel = document.getElementById('payment-plan');
    if (!cards.length || !planSel) return;

    cards.forEach((card) => {
      card.onclick = () => {
        cards.forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        planSel.value = card.dataset.plan;
        updatePaymentAmount();
      };
      if (card.dataset.plan === planSel.value) card.classList.add('is-selected');
    });
  }

  function updatePaymentAmount() {
    const planSel = document.getElementById('payment-plan');
    const btn = document.getElementById('charge-btn-text');
    if (planSel && btn) btn.textContent = 'Charge $' + planSel.value + '.00 — Activate Subscription';

    const method = document.getElementById('payment-method')?.value;
    document.getElementById('card-fields')?.classList.toggle('hidden', method === 'paypal');
    document.getElementById('paypal-fields')?.classList.toggle('hidden', method !== 'paypal');
  }

  async function processPayment() {
    if (!currentClient) return;
    const planSel = document.getElementById('payment-plan');
    const methodSel = document.getElementById('payment-method');
    const couponInput = document.getElementById('payment-coupon');
    let amt = planSel ? parseInt(planSel.value, 10) : 29;
    const method = methodSel ? methodSel.value : 'stripe';
    const couponCode = couponInput ? couponInput.value.trim() : '';
    const P = global.URDFWPlatform;

    if (P && couponCode) {
      const c = P.validateCoupon(couponCode);
      if (c) amt = c.type === 'percent' ? Math.round(amt * (1 - c.discount / 100)) : Math.max(0, amt - c.discount);
    }

    const chargeAmt = amt;
    const form = document.getElementById('payment-form');
    const formHtml = form.innerHTML;
    form.innerHTML = '<div class="py-6 text-center text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing ' + method + ' payment of $' + chargeAmt + '…</div>';

    let orderRef = method.toUpperCase() + '-' + Date.now();
    let clientRef = currentClient;

    if (P?.api?.billing?.charge) {
      const res = await P.api.billing.charge({
        gateway: method, amount: chargeAmt, plan: chargeAmt >= 79 ? 'premium' : 'standard',
        recurring: true, coupon: couponCode || undefined, email: currentClient.email,
        listingId: currentClient.listingId || currentClient.id,
      });
      if (res?.checkoutUrl) {
        form.innerHTML = formHtml;
        bindPlanCards();
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res?.order?.ref) orderRef = res.order.ref;
      if (res?.client) clientRef = res.client;
      P.api.webhooks?.trigger?.('payment', { email: clientRef.email, amount: chargeAmt, ref: orderRef });
    } else {
      await new Promise((r) => setTimeout(r, 1200));
      if (P) {
        P.processPayment({ gateway: method, amount: chargeAmt, plan: chargeAmt >= 79 ? 'premium' : 'standard', recurring: true, coupon: couponCode || undefined, email: currentClient.email, listingId: currentClient.listingId });
      }
      let clients = getClients();
      const idx = clients.findIndex((c) => c.id === currentClient.id);
      clientRef = clients[idx] || currentClient;
      clientRef.isPaid = true;
      clientRef.package = chargeAmt >= 79 ? 'Premium' : 'Standard';
      if (!clientRef.payments) clientRef.payments = [];
      clientRef.payments.push({ date: new Date().toISOString(), amount: chargeAmt, plan: clientRef.package, status: 'success', method, ref: orderRef, coupon: couponCode || null });
      if (idx > -1) clients[idx] = clientRef;
      saveClients(clients);
    }

    setCurrentClient(clientRef);
    currentClient = clientRef;
    P?.portalToast?.('Payment successful — $' + chargeAmt + ' via ' + method);
    form.innerHTML = formHtml;
    bindPlanCards();
    showDashboard(clientRef);
  }

  function initTraining(client) {
    const key = (client.email || client.id || 'demo').toLowerCase();
    const completed = JSON.parse(localStorage.getItem('training_' + key) || '[]');
    const container = document.getElementById('training-modules');
    if (!container) return;
    container.innerHTML = '';

    trainingModules.forEach((mod, i) => {
      const isDone = completed.includes(mod.id);
      const div = document.createElement('div');
      div.className = 'member-module' + (isDone ? ' is-done' : '');
      div.innerHTML = `
        <span class="member-module-tag">Module ${i + 1}</span>
        <h4>${mod.title}</h4>
        <p>${mod.content}</p>
        <div class="member-module-actions">
          <button type="button" data-mid="${mod.id}" class="member-btn-primary" ${isDone ? 'disabled' : ''}>${isDone ? 'Done' : 'Complete'}</button>
          ${!isDone ? '<button type="button" class="member-btn-secondary quiz-btn">Quiz</button>' : ''}
        </div>`;

      const btn = div.querySelector('button[data-mid]');
      if (!isDone && btn) {
        btn.onclick = () => {
          if (!completed.includes(mod.id)) completed.push(mod.id);
          localStorage.setItem('training_' + key, JSON.stringify(completed));
          initTraining(currentClient);
          updateQuickStats(currentClient);
          renderOverview(currentClient);
          global.URDFWPlatform?.portalToast?.('Module ' + mod.id + ' complete!');
        };
      }

      div.querySelector('.quiz-btn')?.addEventListener('click', (ev) => {
        const score = Math.floor(Math.random() * 30) + 70;
        ev.target.textContent = 'Score: ' + score + '%';
        ev.target.disabled = true;
        if (score > 70 && !completed.includes(mod.id)) {
          completed.push(mod.id);
          localStorage.setItem('training_' + key, JSON.stringify(completed));
          setTimeout(() => initTraining(currentClient), 600);
        }
      });

      container.appendChild(div);
    });

    const pct = computeTrainingProgress(key);
    const pctEl = document.getElementById('training-pct');
    if (pctEl) pctEl.textContent = pct;
    updateTrainingRing(pct);
  }

  function renderMyListing(client) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('l-name', client.name);
    set('l-area', client.area);
    set('l-desc', client.description || client.fullDescription);
    set('l-phone', client.phone);
    set('l-website', client.website);
    set('l-times', client.times);
    set('l-category', client.category || 'Church');
    const kwEl = document.getElementById('l-keywords');
    if (kwEl) kwEl.value = Array.isArray(client.keywords) ? client.keywords.join(', ') : (client.keywords || 'youth, DFW, family');
    renderListingPreview(client);
  }

  function renderListingPreview(client) {
    const prev = document.getElementById('listing-preview');
    if (!prev) return;
    const img = client.image || 'images/10.jpg';
    const kw = Array.isArray(client.keywords) ? client.keywords : (client.keywords || '').split(',').map((k) => k.trim()).filter(Boolean);
    const seo = Math.min(100, 60 + kw.length * 8 + (client.description ? 12 : 0));
    prev.innerHTML = `
      <img src="${img}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:0.75rem">
      <strong>${client.name || 'Your Church'}</strong>
      <p style="font-size:0.8rem;color:#64748b;margin-top:0.25rem">${client.area || 'DFW'} · SEO ${seo}/100</p>
      <p style="font-size:0.8rem;color:#475569;margin-top:0.5rem;line-height:1.45">${(client.description || 'Add a description.').substring(0, 120)}</p>`;
  }

  async function saveMyListing(e) {
    e.preventDefault();
    if (!currentClient) return;

    let clients = getClients();
    const idx = clients.findIndex((c) => c.id === currentClient.id);
    const c = clients[idx] || { ...currentClient };

    c.name = document.getElementById('l-name').value || c.name;
    c.area = document.getElementById('l-area').value || c.area;
    c.description = document.getElementById('l-desc').value;
    c.phone = document.getElementById('l-phone').value;
    c.website = document.getElementById('l-website').value;
    c.times = document.getElementById('l-times').value;
    c.category = document.getElementById('l-category').value;
    const kw = document.getElementById('l-keywords')?.value || '';
    c.keywords = kw.split(',').map((k) => k.trim()).filter(Boolean);

    if (document.getElementById('l-photo')?.files?.length) c.image = 'images/30.jpg';

    const P = global.URDFWPlatform;
    if (P?.api?.listings?.save) {
      await P.api.listings.save(c.id, {
        name: c.name, area: c.area, description: c.description, phone: c.phone,
        website: c.website, times: c.times, category: c.category, keywords: c.keywords,
        email: c.email, image: c.image || 'images/5.jpg', status: 'approved',
      });
      P.api.webhooks?.trigger?.('listing_update', { clientId: c.id, name: c.name });
      try {
        const me = await fetch('/api/auth/me', {
          headers: { Authorization: 'Bearer ' + (localStorage.getItem('urdfw_api_token') || '') },
        }).then((r) => r.json());
        if (me?.client) { c = me.client; }
      } catch { /* keep local */ }
    } else {
      let custom = JSON.parse(localStorage.getItem('urdfw_custom_listings') || '[]');
      const cidx = custom.findIndex((x) => x.name === c.name || x.email === c.email);
      const newListing = { id: Date.now(), name: c.name, area: c.area, description: c.description, email: c.email, image: c.image || 'images/5.jpg', keywords: c.keywords, category: c.category };
      if (cidx > -1) custom[cidx] = { ...custom[cidx], ...newListing };
      else custom.unshift(newListing);
      localStorage.setItem('urdfw_custom_listings', JSON.stringify(custom));
    }

    if (idx > -1) clients[idx] = c;
    else clients.push(c);
    saveClients(clients);
    setCurrentClient(c);
    currentClient = c;

    P?.portalToast?.('Listing saved — live in directory.');
    updateQuickStats(c);
    renderLeads(c);
    renderListingPreview(c);
    renderOverview(c);
  }

  function previewMyListing() {
    if (currentClient) global.location.href = 'directory.html';
  }

  function simulatePhotoUpload(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.querySelector('#listing-preview img');
      if (img) img.src = ev.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }

  function setLeadsFilter(filter) {
    leadsFilter = filter;
    if (currentClient) renderLeads(currentClient);
  }

  function renderLeads(client) {
    const el = document.getElementById('leads-list');
    if (!el) return;

    let myLeads = getMyLeads(client);
    if (leadsFilter !== 'all') myLeads = myLeads.filter((l) => (l.status || 'new') === leadsFilter);

    const newCount = getMyLeads(client).filter((l) => (l.status || 'new') === 'new').length;
    const contactedCount = getMyLeads(client).filter((l) => l.status === 'contacted').length;

    const filters = ['all', 'new', 'contacted', 'closed'];
    const filterLabels = { all: 'All', new: 'New', contacted: 'Contacted', closed: 'Closed' };

    el.innerHTML = `
      <div class="member-leads-bar">
        <div><strong>${getMyLeads(client).length}</strong> leads <span style="color:#64748b;font-size:0.8rem">(${newCount} new, ${contactedCount} contacted)</span></div>
        <div class="member-filters">
          ${filters.map((f) => `<button type="button" class="member-filter ${leadsFilter === f ? 'is-on' : ''}" onclick="setLeadsFilter('${f}')">${filterLabels[f]}</button>`).join('')}
        </div>
      </div>
      ${myLeads.length ? myLeads.map((l) => {
        const initial = (l.name || '?').charAt(0).toUpperCase();
        const status = l.status || 'new';
        const badgeClass = status === 'contacted' ? 'is-contacted' : 'is-new';
        return `
        <div class="member-lead">
          <div class="member-lead-top">
            <span class="member-lead-avatar">${initial}</span>
            <div>
              <strong>${l.name}</strong>
              <span class="member-lead-badge ${badgeClass}">${status}</span>
              <div style="font-size:0.75rem;color:#94a3b8">${new Date(l.date).toLocaleDateString()} · ${l.email}</div>
            </div>
          </div>
          <p class="member-lead-msg">${l.message}</p>
          <div class="member-lead-actions">
            ${status !== 'contacted' ? `<button type="button" class="member-btn-primary" onclick="replyToLead('${l.id}')">Mark contacted</button>` : ''}
            <button type="button" class="member-btn-secondary" onclick="viewLeadDetail('${l.id}')">Details</button>
          </div>
        </div>`;
      }).join('') : '<div class="member-empty">No leads for this filter.</div>'}`;
  }

  function replyToLead(leadId) {
    const leads = JSON.parse(localStorage.getItem('urdfw_leads') || '[]');
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      lead.status = 'contacted';
      lead.repliedAt = new Date().toISOString();
      localStorage.setItem('urdfw_leads', JSON.stringify(leads));
    }
    global.URDFWPlatform?.portalToast?.('Reply logged — lead marked contacted.');
    if (currentClient) {
      renderLeads(currentClient);
      renderOverview(currentClient);
      updateQuickStats(currentClient);
    }
  }

  function viewLeadDetail(leadId) {
    const leads = JSON.parse(localStorage.getItem('urdfw_leads') || '[]');
    const l = leads.find((x) => x.id === leadId) || { name: 'Lead', message: 'No details.', status: 'new' };
    alert('Lead: ' + l.name + '\n' + l.email + '\n\n' + l.message + '\n\nStatus: ' + (l.status || 'new'));
  }

  function logActivity() {
    global.URDFWPlatform?.portalToast?.('Activity logged to timeline.');
  }

  function renderMemberTabPanel(n, tabId) {
    const client = currentClient;
    const P = global.URDFWPlatform;
    if (!client || !P) return;
    const id = tabId || TAB_MAP[n];
    const user = P.getMemberUser?.(client);
    if (id === 'profile') P.renderMemberProfile?.(document.getElementById('member-platform-profile'), user, client);
    if (id === 'messages') P.renderMemberMessages?.(document.getElementById('member-platform-messages'), user);
    if (id === 'media') P.renderMemberMedia?.(document.getElementById('member-platform-media'), client);
    if (id === 'saved') P.renderMemberSaved?.(document.getElementById('member-platform-saved'), user);
    if (id === 'support') P.renderMemberSupport?.(document.getElementById('member-platform-support'), client);
    if (id === 'notifications') P.renderMemberNotifications?.(document.getElementById('member-platform-notifications'), user);
    if (id === 'reviews') P.renderMemberReviews?.(document.getElementById('member-platform-reviews'), client);
    if (id === 'claims') P.renderMemberClaims?.(document.getElementById('member-platform-claims'), client);
    if (id === 'analytics') P.renderMemberAnalytics?.(document.getElementById('member-platform-analytics'), client);
  }

  function switchMemberTab(n, tabId) {
    const pane = document.getElementById('member-tab-' + n);
    if (!pane) return;

    document.querySelectorAll('.member-pane').forEach((el) => {
      const idx = parseInt(el.id.replace('member-tab-', ''), 10);
      el.classList.toggle('hidden', idx !== n);
    });

    const id = tabId || TAB_MAP[n];
    const sidebar = document.getElementById('member-sidebar-nav');
    if (sidebar && id) {
      sidebar.querySelectorAll('[data-member-tab]').forEach((b) => b.classList.toggle('active', b.dataset.memberTab === id));
    }

    document.getElementById('dashboard-main')?.classList.remove('drawer-open');

    const metrics = document.getElementById('member-quick-stats');
    if (metrics) metrics.style.display = n === 0 ? '' : 'none';

    renderMemberTabPanel(n, id);
    pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelector('.member-workspace')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  global.switchMemberTab = switchMemberTab;

  function refreshDashboard() {
    if (!currentClient) return;
    const clients = getClients();
    const fresh = clients.find((c) => c.id === currentClient.id) || currentClient;
    setCurrentClient(fresh);
    showDashboard(fresh);
    global.URDFWPlatform?.portalToast?.('Dashboard refreshed.');
  }

  function toggleMemberSidebar() {
    document.getElementById('dashboard-main')?.classList.toggle('drawer-open');
  }

  let memberPortalBooted = false;

  function bootMemberPortal() {
    if (memberPortalBooted) return;
    memberPortalBooted = true;

    const P = global.URDFWPlatform;
    if (P?.initMemberPortalLogin) P.initMemberPortalLogin({});
    if (P?.renderApiStatusPanel) P.renderApiStatusPanel('member-api-status');

    const existing = getCurrentClient();
    if (existing) {
      const clients = getClients();
      showDashboard(clients.find((c) => c.id === existing.id) || existing);
    }
    if (global.loadSavedChurches) global.loadSavedChurches();
  }

  async function handleBillingReturn() {
    const params = new URLSearchParams(location.search);
    if (params.get('billing') === 'success' && currentClient) {
      const P = global.URDFWPlatform;
      try {
        const me = await fetch('/api/auth/me', {
          headers: { Authorization: 'Bearer ' + (localStorage.getItem('urdfw_api_token') || '') },
        }).then((r) => r.json());
        if (me?.client) {
          setCurrentClient(me.client);
          showDashboard(me.client);
          P?.portalToast?.('Subscription active — thank you!');
        }
      } catch { /* ignore */ }
      history.replaceState({}, '', 'member-dashboard.html');
    }
  }

  function handlePendingPlan() {
    const plan = sessionStorage.getItem('urdfw_pending_plan');
    if (!plan || plan === 'Free') return;
    const planSel = document.getElementById('payment-plan');
    const cards = document.querySelectorAll('.member-plan');
    const val = plan === 'Premium' ? '79' : '29';
    if (planSel) planSel.value = val;
    cards.forEach((card) => card.classList.toggle('is-selected', card.dataset.plan === val));
    const coupon = sessionStorage.getItem('urdfw_pending_coupon');
    const couponInput = document.getElementById('payment-coupon');
    if (coupon && couponInput) couponInput.value = coupon;
    updatePaymentAmount();
    switchMemberTab(1, 'billing');
    sessionStorage.removeItem('urdfw_pending_plan');
    sessionStorage.removeItem('urdfw_pending_coupon');
  }

  global.addEventListener('DOMContentLoaded', () => {
    bindMemberSidebarNav();
    bootMemberPortal();
    setTimeout(() => {
      handleBillingReturn();
      if (location.hash === '#billing') handlePendingPlan();
    }, 800);

    document.getElementById('member-sidebar-toggle')?.addEventListener('click', toggleMemberSidebar);
    document.getElementById('member-drawer-backdrop')?.addEventListener('click', () => {
      document.getElementById('dashboard-main')?.classList.remove('drawer-open');
    });
  });

  global.getRelevantLeadsCount = getRelevantLeadsCount;
  global.computeTrainingProgress = computeTrainingProgress;
  global.handleClientLogin = handleClientLogin;
  global.logoutClient = logoutClient;
  global.refreshDashboard = refreshDashboard;
  global.processPayment = processPayment;
  global.updatePaymentAmount = updatePaymentAmount;
  global.saveMyListing = saveMyListing;
  global.previewMyListing = previewMyListing;
  async function openBillingPortal() {
    const P = global.URDFWPlatform;
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (localStorage.getItem('urdfw_api_token') || ''),
        },
      }).then((r) => r.json());
      if (res?.url) window.location.href = res.url;
      else P?.portalToast?.(res.error || 'Billing portal unavailable — subscribe first or add Stripe keys.');
    } catch {
      P?.portalToast?.('Could not open billing portal.');
    }
  }

  global.simulatePhotoUpload = simulatePhotoUpload;
  global.openBillingPortal = openBillingPortal;
  global.setLeadsFilter = setLeadsFilter;
  global.replyToLead = replyToLead;
  global.viewLeadDetail = viewLeadDetail;
  global.logActivity = logActivity;
  global.toggleMemberSidebar = toggleMemberSidebar;

  global.URDFW = global.URDFW || {};
  global.URDFW.loginAsDemo = () => {
    const em = document.getElementById('client-email');
    if (em) em.value = 'hello@thegrovearlington.org';
    document.getElementById('client-login-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
})(window);