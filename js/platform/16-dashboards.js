/**
 * Category 8 + 10: Member & Admin dashboard UI wired to platform APIs
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.syncClientToUser = function (client) {
    if (!client?.email) return null;
    const users = P.get('users', []);
    let user = users.find((u) => u.email.toLowerCase() === client.email.toLowerCase());
    if (!user) {
      user = {
        id: client.id || P.uuid(),
        email: client.email,
        name: client.name || client.email.split('@')[0],
        role: 'church-owner',
        package: client.isPaid ? (client.package || 'standard').toLowerCase() : 'free-trial',
        area: client.area,
        profileImage: client.profileImage || '',
        bannerImage: client.bannerImage || '',
        savedListings: [],
        createdAt: client.registeredAt || new Date().toISOString(),
      };
      users.push(user);
      P.set('users', users);
    }
    P.set('current_user', user);
    return user;
  };

  P.getMemberUser = function (client) {
    if (!client) return P.get('current_user', null);
    return P.syncClientToUser(client);
  };

  /* ─── MEMBER DASHBOARD ─── */
  P.initMemberDashboard = function (client) {
    const user = P.getMemberUser(client);
    if (user && !P.getMessages(user.id).length) {
      P.sendMessage(user.id, 'Upper Room DFW', 'Welcome to your member dashboard', 'Complete your listing profile, training modules, and billing setup to get the most from the directory.');
    }
    P.renderMemberProfile(document.getElementById('member-platform-profile'), user, client);
    P.renderMemberMessages(document.getElementById('member-platform-messages'), user);
    P.renderMemberMedia(document.getElementById('member-platform-media'), client);
    P.renderMemberSaved(document.getElementById('member-platform-saved'), user);
    P.renderMemberSupport(document.getElementById('member-platform-support'), client);
    P.renderMemberInvoices(document.getElementById('member-platform-invoices'), client);
    P.renderMemberUpgrade(document.getElementById('member-platform-upgrade'), client);
    P.renderMemberNotifications(document.getElementById('member-platform-notifications'), user);
    P.renderMemberReviews?.(document.getElementById('member-platform-reviews'), client);
    P.renderMemberClaims?.(document.getElementById('member-platform-claims'), client);
    P.renderMemberAnalytics?.(document.getElementById('member-platform-analytics'), client);
  };

  P.renderMemberProfile = function (el, user, client) {
    if (!el || !user) return;
    el.innerHTML = `
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <h3 class="font-semibold mb-3">Profile &amp; Account Settings</h3>
          <form id="member-profile-form" class="space-y-3 text-sm">
            <div><label class="text-xs font-medium">Display Name</label>
              <input name="name" value="${(user.name || '').replace(/"/g, '&quot;')}" class="w-full border rounded-2xl px-4 py-2"></div>
            <div><label class="text-xs font-medium">Email</label>
              <input value="${user.email}" disabled class="w-full border rounded-2xl px-4 py-2 bg-slate-50"></div>
            <div><label class="text-xs font-medium">Area</label>
              <input name="area" value="${(client?.area || user.area || '').replace(/"/g, '&quot;')}" class="w-full border rounded-2xl px-4 py-2"></div>
            <div><label class="text-xs font-medium">Membership</label>
              <div class="text-sm py-2">${P.getUserRole(user)} • ${user.package || 'free-trial'}</div></div>
            <div><label class="text-xs font-medium">New Password</label>
              <input name="password" type="password" placeholder="Leave blank to keep" class="w-full border rounded-2xl px-4 py-2"></div>
            <button type="submit" class="px-6 py-2 bg-[#0369a1] text-white rounded-2xl font-semibold">Save Profile</button>
          </form>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Profile &amp; Banner Images</h3>
          <div class="flex gap-4 items-start">
            <div class="text-center">
              <div class="w-20 h-20 rounded-full bg-slate-100 border overflow-hidden mx-auto" id="profile-img-preview">
                ${user.profileImage ? `<img src="${user.profileImage}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-user text-2xl text-slate-400 mt-6"></i>'}
              </div>
              <label class="text-xs mt-2 block cursor-pointer text-sky-700">Upload profile<input type="file" accept="image/*" class="hidden" id="profile-img-upload"></label>
            </div>
            <div class="flex-1">
              <div class="h-24 rounded-2xl bg-slate-100 border overflow-hidden" id="banner-img-preview">
                ${user.bannerImage ? `<img src="${user.bannerImage}" class="w-full h-full object-cover">` : '<div class="text-xs text-slate-400 p-4">Banner image</div>'}
              </div>
              <label class="text-xs mt-2 block cursor-pointer text-sky-700">Upload banner<input type="file" accept="image/*" class="hidden" id="banner-img-upload"></label>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-3">Role: <strong>${P.getUserRole(user)}</strong>. Package controls listing limits and featured placement.</p>
        </div>
      </div>`;

    el.querySelector('#member-profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const patch = { name: fd.get('name'), area: fd.get('area') };
      if (P.apiConfig?.mode === 'remote' && client?.id && localStorage.getItem('urdfw_api_token')) {
        try {
          await P.api.clients.update(client.id, patch);
          const updated = { ...client, ...patch };
          localStorage.setItem('urdfw_current_client', JSON.stringify(updated));
          P.portalToast?.('Profile saved to your account.');
          return;
        } catch (err) {
          P.portalToast?.(err.message || 'Save failed');
          return;
        }
      }
      const users = P.get('users', []);
      const u = users.find((x) => x.id === user.id);
      if (u) {
        u.name = patch.name;
        u.area = patch.area;
        if (fd.get('password')) u.password = fd.get('password');
        P.set('users', users);
        P.set('current_user', u);
      }
      let clients = P.get('clients', []);
      const c = clients.find((x) => x.email === client.email);
      if (c) { c.name = patch.name; c.area = patch.area; P.set('clients', clients); }
      P.portalToast?.('Profile saved.');
    };

    const bindUpload = (inputId, field, previewId) => {
      const inp = el.querySelector(inputId);
      if (!inp) return;
      inp.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const users = P.get('users', []);
          const u = users.find((x) => x.id === user.id);
          if (u) { u[field] = reader.result; P.set('users', users); }
          const prev = el.querySelector(previewId);
          if (prev) prev.innerHTML = `<img src="${reader.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
      };
    };
    bindUpload('#profile-img-upload', 'profileImage', '#profile-img-preview');
    bindUpload('#banner-img-upload', 'bannerImage', '#banner-img-preview');
  };

  P.renderMemberMessages = async function (el, user) {
    if (!el || !user) return;
    el.innerHTML = '<p class="text-sm text-slate-500 py-4">Loading messages…</p>';
    let msgs = P.getMessages(user.id);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const list = await P.api.messages.list(user.id);
        if (Array.isArray(list)) msgs = list;
      } catch { /* keep local */ }
    }
    const notifs = P.getNotifications(user.id);
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div>
          <h3 class="font-semibold mb-3">Messages <span class="text-xs font-normal text-slate-500">(${msgs.length})</span></h3>
          <div class="space-y-2 max-h-64 overflow-auto text-sm">${msgs.length ? msgs.map((m) => `
            <div class="border rounded-2xl p-3 ${m.read ? '' : 'bg-sky-50'}">
              <div class="font-semibold text-xs">${m.subject}</div>
              <div class="text-slate-600 mt-1">${m.body}</div>
              <div class="text-[10px] text-slate-400 mt-1">From ${m.from} • ${new Date(m.at).toLocaleDateString()}</div>
            </div>`).join('') : '<p class="text-sm text-slate-500">No messages yet. Admin and system notifications appear here.</p>'}
          </div>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Send a Message</h3>
          <form id="member-send-msg" class="space-y-2 text-sm">
            <input name="subject" placeholder="Subject" class="w-full border rounded-2xl px-3 py-2" required>
            <textarea name="body" rows="3" placeholder="Message to Upper Room DFW team..." class="w-full border rounded-2xl px-3 py-2" required></textarea>
            <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-2xl text-sm">Send</button>
          </form>
        </div>
      </div>
      <div class="mt-6">
        <h4 class="font-semibold text-sm mb-2">Notifications</h4>
        <div class="text-sm space-y-1">${notifs.length ? notifs.map((n) => `<div class="py-1 border-b text-xs">${n.subject || n.text} — ${new Date(n.at || Date.now()).toLocaleDateString()}</div>`).join('') : '<span class="text-slate-500 text-xs">No new notifications.</span>'}</div>
      </div>`;

    el.querySelector('#member-send-msg').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await P.api.messages.send('admin', user.email, fd.get('subject'), fd.get('body'));
      P.portalToast?.('Message sent to the Upper Room DFW team.');
      e.target.reset();
      P.renderMemberMessages(el, user);
    };
  };

  P.renderMemberNotifications = function (el, user) {
    if (!el || !user) return;
    const notifs = P.getNotifications(user.id);
    el.innerHTML = `
      <h3 class="font-semibold mb-3 flex items-center gap-2"><i class="fa-solid fa-bell text-sky-600"></i> Notifications</h3>
      <p class="text-xs text-slate-500 mb-4">System alerts, billing reminders, claim updates, and admin messages.</p>
      <div class="space-y-2">${notifs.length ? notifs.map((n) => `
        <div class="border rounded-2xl p-3 text-sm ${n.read ? '' : 'bg-sky-50'}">
          <div class="font-medium text-xs">${n.subject || n.text || 'Notification'}</div>
          <div class="text-[10px] text-slate-400 mt-1">${new Date(n.at || Date.now()).toLocaleString()}</div>
        </div>`).join('') : '<p class="text-sm text-slate-500">You are up to date. Welcome messages and billing reminders appear here.</p>'}
      </div>
      <button type="button" id="member-mark-read" class="mt-4 text-xs px-3 py-1.5 border rounded-lg">Mark all read</button>`;

    el.querySelector('#member-mark-read')?.addEventListener('click', () => {
      const all = P.get('notifications', {});
      if (all[user.id]) all[user.id].forEach((n) => { n.read = true; });
      P.set('notifications', all);
      P.renderMemberNotifications(el, user);
    });
  };

  P.renderMemberMedia = function (el, client) {
    if (!el) return;
    const listingId = client?.listingId || client?.id;
    const media = P.getListingMedia(listingId);
    el.innerHTML = `
      <h3 class="font-semibold mb-3">Photos &amp; Video</h3>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <label class="text-sm font-medium">Upload listing photo</label>
          <input type="file" accept="image/*" id="member-media-upload" class="mt-2 text-sm w-full">
          <div id="member-media-gallery" class="mt-3 flex flex-wrap gap-2">${media.map((m) => `<img src="${m.dataUrl}" class="w-16 h-16 rounded object-cover border" alt="">`).join('') || '<span class="text-xs text-slate-500">No uploads yet.</span>'}</div>
          <div class="mt-4">
            <label class="text-xs font-medium">YouTube or Vimeo URL</label>
            <input id="member-video-url" placeholder="https://youtube.com/..." class="w-full border rounded-2xl px-3 py-2 text-sm mt-1">
            <button type="button" id="member-save-video" class="mt-2 px-4 py-1.5 border rounded-2xl text-sm">Save Video Link</button>
            <div id="member-video-preview" class="mt-2"></div>
          </div>
        </div>
        <div>
          <h4 class="font-semibold text-sm mb-2">Export &amp; Print</h4>
          <div class="space-y-2">
            <button type="button" id="member-export-csv" class="w-full py-2 border rounded-2xl text-sm text-left px-4"><i class="fa-solid fa-file-csv text-emerald-600 mr-2"></i>Export my listing as CSV</button>
            <button type="button" id="member-print-listing" class="w-full py-2 border rounded-2xl text-sm text-left px-4"><i class="fa-solid fa-print text-sky-600 mr-2"></i>Print / PDF listing sheet</button>
            <button type="button" id="member-import-csv" class="w-full py-2 border rounded-2xl text-sm text-left px-4"><i class="fa-solid fa-upload text-amber-600 mr-2"></i>Bulk import via CSV</button>
            <input type="file" accept=".csv" id="member-csv-file" class="hidden">
          </div>
        </div>
      </div>`;

    el.querySelector('#member-media-upload').onchange = async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      await P.uploadImageAjax(file, listingId);
      P.renderMemberMedia(el, client);
    };

    const videoUrl = client?.customFields?.youtube || client?.youtube || '';
    if (videoUrl) {
      el.querySelector('#member-video-url').value = videoUrl;
      el.querySelector('#member-video-preview').innerHTML = P.embedMedia(videoUrl);
    }

    el.querySelector('#member-save-video').onclick = () => {
      const url = el.querySelector('#member-video-url').value;
      let clients = P.get('clients', []);
      const c = clients.find((x) => x.id === client.id);
      if (c) { c.youtube = url; c.customFields = { ...c.customFields, youtube: url }; P.set('clients', clients); }
      el.querySelector('#member-video-preview').innerHTML = P.embedMedia(url);
    };

    el.querySelector('#member-export-csv').onclick = () => {
      P.exportCSV([{ ...client, name: client.name, area: client.area, description: client.description || '' }], 'my-listing.csv');
    };

    el.querySelector('#member-print-listing').onclick = () => P.printListing(client);

    el.querySelector('#member-import-csv').onclick = () => el.querySelector('#member-csv-file').click();
    el.querySelector('#member-csv-file').onchange = (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const count = P.importCSV(reader.result);
        alert(`Imported ${count} listing(s) from CSV.`);
      };
      reader.readAsText(file);
    };
  };

  P.renderMemberSaved = function (el, user) {
    if (!el) return;
    const bookmarks = P.getBookmarks();
    const collections = P.getCollections();
    el.innerHTML = `
      <h3 class="font-semibold mb-3">Saved Listings &amp; Collections</h3>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <h4 class="text-sm font-medium mb-2">Bookmarks</h4>
          <div class="text-sm space-y-1 max-h-48 overflow-auto">
            ${(bookmarks.listings || []).length ? bookmarks.listings.map((b) => `<div class="py-1 border-b text-xs">${b.name || b.id}</div>`).join('') : '<span class="text-slate-500 text-xs">Save churches from the directory with the bookmark button.</span>'}
          </div>
          <h4 class="text-sm font-medium mt-4 mb-2">Saved Reviews</h4>
          <div class="text-xs text-slate-500">${(bookmarks.reviews || []).length} saved</div>
        </div>
        <div>
          <h4 class="text-sm font-medium mb-2">My Collections</h4>
          ${collections.map((col) => `<div class="border rounded-2xl p-3 mb-2 text-sm"><strong>${col.name}</strong> — ${col.items.length} items</div>`).join('')}
          <form id="member-new-collection" class="mt-3 flex gap-2">
            <input name="name" placeholder="New collection name" class="flex-1 border rounded-2xl px-3 py-1.5 text-sm">
            <button type="submit" class="px-3 py-1.5 bg-[#0369a1] text-white rounded-2xl text-sm">Create</button>
          </form>
        </div>
      </div>`;

    el.querySelector('#member-new-collection').onsubmit = (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');
      if (name) { P.createCollection(name); P.renderMemberSaved(el, user); }
    };
  };

  P.renderMemberSupport = function (el, client) {
    if (!el) return;
    const tickets = P.get('support_tickets', []).filter((t) => t.email === client?.email);
    el.innerHTML = `
      <h3 class="font-semibold mb-3">Support Tickets</h3>
      <form id="member-support-form" class="space-y-3 text-sm max-w-lg mb-6">
        <select name="topic" class="w-full border rounded-2xl px-3 py-2">
          <option>Billing question</option><option>Listing help</option><option>Technical issue</option><option>Other</option>
        </select>
        <textarea name="message" rows="4" required placeholder="Describe your issue..." class="w-full border rounded-2xl px-3 py-2"></textarea>
        <button type="submit" class="px-6 py-2 bg-[#0369a1] text-white rounded-2xl">Submit Ticket</button>
      </form>
      <h4 class="font-semibold text-sm mb-2">Your Tickets (${tickets.length})</h4>
      <div class="space-y-2 text-sm">${tickets.length ? tickets.map((t) => `
        <div class="border rounded-2xl p-3"><span class="text-xs px-2 py-0.5 rounded ${t.status === 'open' ? 'bg-amber-100' : 'bg-emerald-100'}">${t.status}</span>
        <div class="mt-1">${t.message || t.topic}</div></div>`).join('') : '<p class="text-xs text-slate-500">No tickets yet.</p>'}</div>`;

    el.querySelector('#member-support-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = { email: client.email, name: client.name, topic: fd.get('topic'), message: fd.get('message') };
      if (P.api?.integrations?.submitSupport) {
        await P.api.integrations.submitSupport(payload);
      } else {
        P.submitSupportForm(payload);
      }
      P.portalToast?.('Support ticket submitted — we respond within 24 hours.');
      P.renderMemberSupport(el, client);
    };
  };

  P.renderMemberPackages = function (el, client) {
    if (!el) return;
    const pkgs = P.getPricingTable();
    el.innerHTML = `
      <h4 class="font-semibold text-sm mb-3">Membership Packages</h4>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">${pkgs.map((p) => `
        <div class="border rounded-2xl p-4 text-sm ${client.package?.toLowerCase() === p.id ? 'border-sky-400 bg-sky-50' : ''}">
          <div class="font-semibold">${p.name}</div>
          <div class="text-2xl font-bold text-[#0369a1] mt-1">${p.price ? '$' + p.price : 'Free'}${p.price ? '/mo' : ''}</div>
          <ul class="text-[11px] text-slate-500 mt-2 space-y-0.5">
            <li>${p.maxLinks || 1} listing link(s)</li>
            <li>${p.featured ? 'Featured' : 'Standard'} placement</li>
            <li>${p.durationDays || 30} day duration</li>
          </ul>
        </div>`).join('')}
      </div>
      <p class="text-[11px] text-slate-400 mt-2">Free trial, one-time, recurring, and variable packages supported via Billing.</p>`;
  };

  P.renderMemberInvoices = function (el, client) {
    if (!el) return;
    const orders = P.get('orders', []);
    const clientOrders = client?.email
      ? orders.filter((o) => o.email === client.email || !o.email)
      : orders;
    const invoices = P.get('invoices', []).filter((i) =>
      clientOrders.some((o) => o.id === i.orderId)
    );
    el.innerHTML = `
      <h4 class="font-semibold text-sm mb-2 mt-6">Invoices &amp; Order History</h4>
      <div class="text-sm divide-y">${invoices.length ? invoices.slice(0, 10).map((i) => `
        <div class="py-2 flex justify-between text-xs">
          <span>${i.id} — ${i.plan || 'plan'}</span>
          <span class="font-mono text-emerald-600">$${i.amount} via ${i.gateway}</span>
        </div>`).join('') : '<div class="text-xs text-slate-500 py-2">No platform invoices yet. Payments in Billing tab create invoices automatically.</div>'}</div>`;
  };

  P.renderMemberUpgrade = function (el, client) {
    if (!el) return;
    const pkgs = P.getPricingTable();
    const listingId = client?.listingId || client?.id;
    el.innerHTML = `
      <div class="mt-6 p-4 bg-sky-50 rounded-2xl border border-sky-100">
        <h4 class="font-semibold text-sm mb-2">Listing Level &amp; Renewal</h4>
        <p class="text-xs text-slate-600 mb-3">Upgrade for featured/sticky placement or renew before expiry.</p>
        <div class="flex flex-wrap gap-2">
          ${pkgs.filter((p) => p.price > 0).map((p) => `<button type="button" data-level="${p.id}" class="member-upgrade-btn px-3 py-1.5 text-xs border rounded-2xl bg-white hover:bg-sky-100">${p.name} $${p.price}/mo</button>`).join('')}
          <button type="button" id="member-renew-btn" class="px-3 py-1.5 text-xs border rounded-2xl bg-white">Renew 30 days</button>
        </div>
      </div>`;

    el.querySelectorAll('.member-upgrade-btn').forEach((btn) => {
      btn.onclick = () => {
        P.upgradeListing(listingId, btn.dataset.level);
        alert(`Listing upgraded to ${btn.dataset.level}. Changes reflect in the directory.`);
      };
    });
    const renew = el.querySelector('#member-renew-btn');
    if (renew) renew.onclick = () => { P.renewListing(listingId, 30); alert('Listing renewed for 30 days.'); };
  };

  /* ─── ADMIN DASHBOARD ─── */
  P.adminTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'listings', label: 'Listings' },
    { id: 'users', label: 'Users' },
    { id: 'claims', label: 'Claims' },
    { id: 'billing', label: 'Billing' },
    { id: 'email', label: 'Email' },
    { id: 'seo', label: 'SEO' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'support', label: 'Support' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'api', label: 'API & Webhooks' },
    { id: 'dns', label: 'DNS' },
  ];

  P._adminDashState = { root: null, panels: null, show: null };

  P.initAdminDashboard = function (rootId) {
    const root = document.getElementById(rootId || 'admin-platform-root');
    if (!root) return;

    root.innerHTML = `<div id="admin-tab-panels"></div>`;

    const panels = root.querySelector('#admin-tab-panels');
    const show = (id) => P.renderAdminTab(panels, id);
    P._adminDashState = { root, panels, show };
    show('overview');
  };

  P.showAdminTab = function (tabId) {
    if (P._adminDashState?.show) return P._adminDashState.show(tabId);
    const root = document.getElementById('admin-platform-root');
    if (root) P.initAdminDashboard('admin-platform-root');
    setTimeout(() => P._adminDashState?.show?.(tabId), 80);
  };

  P.renderAdminTab = async function (el, tabId) {
    if (!el) return;
    if (tabId === 'overview') return P.renderAdminOverview(el);
    if (tabId === 'listings') return P.renderAdminListings(el);
    if (tabId === 'users') return P.renderAdminUsers(el);
    if (tabId === 'claims') return P.renderAdminClaims(el);
    if (tabId === 'billing') return P.renderAdminBilling(el);
    if (tabId === 'email') return P.renderAdminEmail(el);
    if (tabId === 'seo') return P.renderAdminSeo(el);
    if (tabId === 'integrations') return P.renderAdminIntegrations(el);
    if (tabId === 'reviews') return P.renderAdminReviews(el);
    if (tabId === 'support') return P.renderAdminSupport(el);
    if (tabId === 'analytics') return P.renderAdminAnalytics(el);
    if (tabId === 'api') return P.renderAdminApi(el);
    if (tabId === 'dns') return P.renderAdminDns(el);
  };

  P.renderAdminOverview = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 py-8 text-center"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading live command center…</div>';
    const A = global.URDFWAnalytics;
    try {
      if (P.apiConfig?.mode === 'remote' && A?.fetchAdmin) {
        const data = await A.fetchAdmin();
        A.renderKpiGrid(el, data.kpis);
        const chartsHost = document.createElement('div');
        el.appendChild(chartsHost);
        A.renderAdminCharts(chartsHost, data);
        const actions = document.createElement('div');
        actions.className = 'flex flex-wrap gap-2 mt-4';
        actions.innerHTML = `
          <button type="button" id="admin-backup-now" class="px-4 py-2 text-xs bg-slate-900 text-white rounded-xl">Backup DB to S3</button>
          <button type="button" id="admin-refresh-stats" class="px-4 py-2 text-xs border rounded-xl">Refresh Live Data</button>`;
        el.appendChild(actions);
        actions.querySelector('#admin-backup-now')?.addEventListener('click', async () => {
          const token = localStorage.getItem('urdfw_api_token');
          const r = await fetch('/api/admin/backup-db', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
          const j = await r.json();
          P.portalToast?.(j.ok ? 'DB backed up (' + j.bytes + ' bytes)' : (j.error || 'Backup failed'));
        });
        actions.querySelector('#admin-refresh-stats')?.onclick = () => P.renderAdminOverview(el);
        return;
      }
    } catch { /* fallback */ }
    const clients = P.get('clients', []);
    const users = P.get('users', []);
    const orders = P.get('orders', []);
    const claims = P.get('claims', []);
    el.innerHTML = `
      <div class="portal-panel mb-4 text-amber-700 bg-amber-50 text-xs">Local mode — connect API for live analytics.</div>
      <div class="grid md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Registered Clients</div><div class="text-2xl font-bold">${clients.length}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Platform Users</div><div class="text-2xl font-bold">${users.length}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Orders</div><div class="text-2xl font-bold">${orders.length}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Pending Claims</div><div class="text-2xl font-bold">${claims.filter((c) => c.status === 'pending').length}</div></div>
      </div>`;
  };

  P.renderAdminListings = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading listings…</p>';
    let all = [];
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const res = await fetch('/api/listings?status=all', { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) all = await res.json();
      } catch { /* fallback */ }
    }
    if (!all.length) {
      let churches = [];
      try {
        const res = await fetch('data/churches.json');
        churches = await res.json();
      } catch { /* ignore */ }
      const customs = P.get('custom_listings', []);
      all = [...customs, ...churches.map((c) => P.enhanceListing(c))];
    }
    const meta = P.get('listing_meta', {});

    el.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <button type="button" id="admin-export-all-csv" class="px-3 py-1.5 text-xs border rounded-2xl">Export All CSV</button>
        <button type="button" id="admin-seed-demo" class="px-3 py-1.5 text-xs border rounded-2xl">Seed Demo Meta</button>
      </div>
      <div class="bg-white border rounded-3xl p-4 max-h-[480px] overflow-auto text-sm space-y-2" id="admin-all-listings">
        ${all.slice(0, 100).map((l) => {
          const m = meta[l.id] || {};
          const featured = l.featured || m.featured;
          return `<div class="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <div><strong>${l.name}</strong> <span class="text-xs text-slate-500">${l.area || ''} • ${l.status || 'live'}</span>
              ${featured ? '<span class="badge-featured">Featured</span>' : ''}${m.vip ? '<span class="badge-vip">VIP</span>' : ''}</div>
            <div class="flex gap-1 text-xs">
              <button type="button" data-feat="${l.id}" class="admin-feat px-2 py-0.5 border rounded">Feature</button>
              <button type="button" data-sticky="${l.id}" class="admin-sticky px-2 py-0.5 border rounded">Sticky</button>
              <button type="button" data-vip="${l.id}" class="admin-vip px-2 py-0.5 border rounded">VIP</button>
              ${(l.status === 'pending' || l.status === 'registered') ? `<button type="button" data-approve="${l.id}" class="text-emerald-600">Go Live</button>` : ''}
            </div></div>`;
        }).join('') || '<p class="text-slate-500">No listings.</p>'}
      </div>`;

    el.querySelector('#admin-export-all-csv')?.addEventListener('click', () => P.exportCSV(all, 'urdfw-all-listings.csv'));
    el.querySelector('#admin-seed-demo')?.addEventListener('click', () => { P.seedDemoData(); alert('Demo listing meta seeded.'); P.renderAdminListings(el); });

    el.querySelectorAll('[data-feat]').forEach((b) => b.onclick = () => { P.markFeatured(b.dataset.feat, true); P.renderAdminListings(el); });
    el.querySelectorAll('[data-sticky]').forEach((b) => b.onclick = () => { P.upgradeListing(b.dataset.sticky, 'premium'); P.renderAdminListings(el); });
    el.querySelectorAll('[data-vip]').forEach((b) => b.onclick = () => { P.upgradeListing(b.dataset.vip, 'vip'); P.renderAdminListings(el); });
    el.querySelectorAll('[data-approve]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.approve;
      if (P.apiConfig?.mode === 'remote' && token) {
        await fetch('/api/listings/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ status: 'live' }),
        });
      } else {
        const customs2 = P.get('custom_listings', []);
        const item = customs2.find((x) => x.id === id);
        if (item) { item.status = 'approved'; P.set('custom_listings', customs2); }
      }
      P.renderAdminListings(el);
    });
  };

  P.renderAdminUsers = async function (el) {
    let clients = P.get('clients', []);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const list = await P.api.clients.list();
        if (Array.isArray(list)) { clients = list; P.set('clients', list); }
      } catch { /* keep local */ }
    }
    const users = P.get('users', []);
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Church Registrations (${clients.length})</h3>
          <div class="space-y-2 max-h-80 overflow-auto text-xs">
            ${clients.map((c) => `<div class="flex justify-between border-b py-2">
              <span>${c.name} — ${c.email}</span>
              <span class="${c.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'}">${c.status || 'approved'}</span>
              ${c.status === 'pending' ? `<button type="button" data-client="${c.id}" class="admin-approve-client text-emerald-600 ml-2">Approve</button>` : ''}
            </div>`).join('') || '<p class="text-slate-500">No clients.</p>'}
          </div>
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Platform Users (${users.length})</h3>
          <div class="space-y-2 max-h-80 overflow-auto text-xs">
            ${P.getUserDirectory().map((u) => `<div class="border-b py-2">${u.name} — ${u.email} <span class="text-slate-400">(${u.role})</span></div>`).join('') || '<p class="text-slate-500">No users yet.</p>'}
          </div>
        </div>
      </div>`;

    el.querySelectorAll('.admin-approve-client').forEach((b) => b.onclick = async () => {
      if (P.apiConfig?.mode === 'remote') {
        await P.api.clients.approve(b.dataset.client);
      } else {
        const list = P.get('clients', []);
        const c = list.find((x) => x.id === b.dataset.client);
        if (c) { c.status = 'approved'; P.set('clients', list); }
      }
      P.renderAdminUsers(el);
      P.renderAdminQuickStats?.();
    });
  };

  P.renderAdminClaims = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading claims…</p>';
    let claims = P.get('claims', []);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const list = await P.api.claims.list();
        if (Array.isArray(list)) { claims = list; P.set('claims', list); }
      } catch { /* keep local */ }
    }
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-3">Listing Claims (${claims.length})</h3>
        <div class="space-y-2 text-sm">${claims.length ? claims.map((c) => `
          <div class="flex justify-between border rounded-2xl p-3">
            <div><strong>${c.email || c.name || 'Claimant'}</strong> — Listing #${c.listingId}
              <span class="text-xs ml-2 px-2 py-0.5 rounded ${c.status === 'pending' ? 'bg-amber-100' : 'bg-emerald-100'}">${c.status}</span></div>
            ${c.status === 'pending' ? `<button type="button" data-claim="${c.id}" class="admin-approve-claim text-xs text-emerald-600">Approve</button>` : ''}
          </div>`).join('') : '<p class="text-slate-500 text-sm">No claims submitted yet.</p>'}
      </div>`;

    el.querySelectorAll('.admin-approve-claim').forEach((b) => b.onclick = async () => {
      if (P.apiConfig?.mode === 'remote') await P.api.claims.approve(b.dataset.claim);
      else {
        const list = P.get('claims', []);
        const c = list.find((x) => x.id === b.dataset.claim);
        if (c) { c.status = 'approved'; P.set('claims', list); }
      }
      P.portalToast?.('Claim approved — listing linked to client.');
      P.renderAdminClaims(el);
    });
  };

  P.renderAdminBilling = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading billing…</p>';
    let orders = P.get('orders', []);
    let invoices = P.get('invoices', []);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const o = await P.api.admin.orders();
        if (Array.isArray(o)) { orders = o; P.set('orders', o); }
      } catch { /* keep */ }
    }
    const coupons = P.get('coupons', []);
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Orders (${orders.length})</h3>
          <div class="text-xs space-y-1 max-h-64 overflow-auto">${orders.map((o) => `<div class="py-1 border-b">${o.ref} — $${o.amount} ${o.plan} via ${o.gateway}</div>`).join('') || 'No orders.'}</div>
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Coupons</h3>
          <div class="text-sm space-y-2">${coupons.map((c) => `<div class="flex justify-between"><code>${c.code}</code><span>${c.type === 'percent' ? c.discount + '%' : '$' + c.discount} off • used ${c.used}/${c.limit}</span></div>`).join('')}</div>
          <form id="admin-add-coupon" class="mt-4 flex gap-2 text-xs">
            <input name="code" placeholder="CODE" class="border rounded px-2 py-1">
            <input name="discount" type="number" placeholder="10" class="border rounded px-2 py-1 w-16">
            <button type="submit" class="px-2 py-1 bg-[#0369a1] text-white rounded">Add</button>
          </form>
        </div>
      </div>
      <div class="mt-4 bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-2">Invoices</h3>
        <div class="text-xs">${invoices.slice(0, 15).map((i) => `<div class="py-1">${i.id} — $${i.amount}</div>`).join('') || 'No invoices.'}</div>
      </div>`;

    el.querySelector('#admin-add-coupon')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const list = P.get('coupons', []);
      list.push({ code: fd.get('code').toUpperCase(), discount: +fd.get('discount'), type: 'percent', limit: 100, used: 0, expires: '2027-12-31' });
      P.set('coupons', list);
      P.renderAdminBilling(el);
    });
  };

  P.renderAdminEmail = async function (el) {
    const log = P.get('email_log', []);
    const templates = P.emailTemplates;
    let smtpBanner = '';
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const r = await fetch('/api/integrations/status', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('urdfw_api_token') },
        });
        const j = await r.json();
        const smtp = (j.results || []).find((x) => x.provider === 'smtp');
        const acumba = (j.results || []).find((x) => x.provider === 'acumbamail');
        if (smtp?.ok) {
          smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"><i class="fa-solid fa-circle-check mr-1"></i> Acumbamail SMTP relay connected (${smtp.host || 'smtp.acumbamail.com'})</div>`;
        } else if (acumba?.smtpActivationRequired || (smtp?.error || '').includes('535')) {
          smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900"><strong>Acumbamail SMTP not active yet.</strong> API is connected but relay login fails (535). Contact <a class="underline" href="https://acumbamail.com/contact/" target="_blank" rel="noopener">Acumbamail technical support</a> to activate transactional SMTP on your account, then run a test send.</div>`;
        } else if (smtp?.error) {
          smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">SMTP: ${smtp.error}</div>`;
        }
      } catch { /* ignore */ }
    }
    el.innerHTML = `
      ${smtpBanner}
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Email Templates</h3>
          <p id="admin-campaigns-hint" class="text-xs text-slate-500 mb-2"></p>
          <div class="space-y-3 text-sm">${Object.entries(templates).map(([k, t]) => `
            <div class="border rounded-2xl p-3">
              <div class="font-medium text-xs uppercase text-sky-600">${k}</div>
              <div class="text-xs mt-1"><strong>Subject:</strong> ${t.subject}</div>
              <div class="text-xs text-slate-500 mt-1">${t.body}</div>
            </div>`).join('')}
          </div>
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Send Test Email</h3>
          <form id="admin-test-email" class="space-y-2 text-sm">
            <select name="template" class="w-full border rounded px-3 py-2"><option value="smtp_ping">smtp_ping (connection test)</option>${Object.keys(templates).map((k) => `<option value="${k}">${k}</option>`).join('')}</select>
            <input name="email" placeholder="recipient@email.com" class="w-full border rounded px-3 py-2">
            <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-2xl text-sm">Send Test via SMTP</button>
          </form>
          <h4 class="font-semibold text-sm mt-6 mb-2">Email Log (${log.length})</h4>
          <div class="text-xs max-h-48 overflow-auto">${log.slice(0, 20).map((e) => `<div class="py-1 border-b">${e.template}: ${e.subject} → ${e.to}</div>`).join('') || 'Empty.'}</div>
        </div>
      </div>`;

    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      fetch('/api/admin/campaigns', { headers: { Authorization: 'Bearer ' + localStorage.getItem('urdfw_api_token') } })
        .then((r) => r.json())
        .then((j) => {
          const hint = el.querySelector('#admin-campaigns-hint');
          if (hint && j.campaigns) hint.textContent = j.campaigns.length + ' live campaigns wired to event bus (welcome, leads, payments, etc.)';
        })
        .catch(() => {});
    }

    el.querySelector('#admin-test-email').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = fd.get('email');
      if (P.apiConfig?.mode === 'remote') {
        const token = localStorage.getItem('urdfw_api_token');
        const r = await fetch('/api/admin/test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ email, template: fd.get('template') }),
        });
        const j = await r.json();
        P.portalToast?.(j.ok ? 'Test email sent to ' + email : (j.error || 'Send failed'));
      } else {
        P.sendEmail(fd.get('template'), { email, name: 'Admin Test' });
        P.portalToast?.('Email logged (local mode).');
      }
      P.renderAdminEmail(el);
    };
  };

  P.renderAdminSeo = function (el) {
    const pages = ['index.html', 'directory.html', 'features.html', 'pricing.html', 'contact.html'];
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-3">Page SEO Settings</h3>
        <div class="space-y-4">${pages.map((p) => {
          const s = P.getPageSettings(p);
          return `<form data-page="${p}" class="admin-seo-form border rounded-2xl p-4 text-sm">
            <div class="font-medium mb-2">${p}</div>
            <input name="title" value="${(s.title || '').replace(/"/g, '&quot;')}" placeholder="SEO title" class="w-full border rounded px-3 py-1.5 mb-2 text-xs">
            <textarea name="description" rows="2" placeholder="Meta description" class="w-full border rounded px-3 py-1.5 text-xs">${s.description || ''}</textarea>
            <label class="text-xs flex items-center gap-2 mt-2"><input type="checkbox" name="noindex" ${s.noindex ? 'checked' : ''}> noindex</label>
            <button type="submit" class="mt-2 px-3 py-1 text-xs border rounded-2xl">Save</button>
          </form>`;
        }).join('')}</div>
      </div>`;

    el.querySelectorAll('.admin-seo-form').forEach((form) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        P.setPageSettings(form.dataset.page, {
          title: fd.get('title'),
          description: fd.get('description'),
          noindex: fd.get('noindex') === 'on',
        });
        alert('SEO settings saved for ' + form.dataset.page);
      };
    });
  };

  P.renderAdminIntegrations = async function (el) {
    const providers = P.INTEGRATION_PROVIDERS || ['mailchimp', 'vbout', 'acumbamail'];
    const stats = P.getIntegrationStats?.() || providers.map((p) => ({ provider: p, syncedCount: 0, enabled: true }));
    const subs = P.get('subscribers', []);
    const apiBase = P.apiConfig?.endpoints?.integrations || '/api/integrations';
    let log = P.getIntegrationLog?.(null, 12) || [];
    let connections = null;
    if (P.apiConfig?.mode === 'remote') {
      try {
        const token = localStorage.getItem('urdfw_api_token');
        const [connRes, logRes] = await Promise.all([
          fetch('/api/platform/connections', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/integrations/log', { headers: { Authorization: 'Bearer ' + token } }),
        ]);
        if (connRes.ok) connections = await connRes.json();
        if (logRes.ok) {
          const lj = await logRes.json();
          log = (lj.entries || []).map((e) => ({ action: e.action, provider: e.provider, status: e.status, email: e.email, at: e.at }));
        }
      } catch { /* ignore */ }
    }

    const connCards = connections?.results ? `
      <div class="grid md:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
        ${connections.results.map((r) => `
          <div class="rounded-xl px-3 py-2 text-xs border ${r.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}">
            <i class="fa-solid ${r.ok ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1"></i>
            <strong class="capitalize">${r.provider}</strong>
            <div class="text-[10px] mt-0.5 truncate">${r.ok ? (r.message || 'Connected') : (r.error || 'Not configured')}</div>
          </div>`).join('')}
      </div>` : '';

    el.innerHTML = `
      ${connCards}
      <div class="portal-panel mb-4 text-xs text-slate-600">
        <strong>Integrations API:</strong> <code class="bg-slate-100 px-2 py-0.5 rounded">${apiBase}</code>
        <span class="ml-2">Endpoints: <code>GET /{provider}</code> · <code>POST /{provider}/config</code> · <code>POST /{provider}/test</code> · <code>POST /{provider}/sync-all</code> · <code>POST /subscribe</code></span>
      </div>
      <div class="grid lg:grid-cols-3 gap-4 mb-6">
        ${stats.map((s) => {
          const cfg = P.getIntegrationConfig(s.provider);
          return `<div class="portal-panel" data-provider-card="${s.provider}">
            <div class="flex items-center justify-between mb-3">
              <div class="font-semibold capitalize flex items-center gap-2">
                <i class="fa-solid fa-plug text-sky-600"></i> ${s.provider}
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${s.enabled ? 'Enabled' : 'Off'}</span>
            </div>
            <div class="text-2xl font-bold text-[#0369a1]">${s.syncedCount}</div>
            <div class="text-xs text-slate-500 mb-3">synced contacts · list <code>${cfg.listId || '—'}</code></div>
            <form class="admin-int-config space-y-2 text-xs mb-3" data-provider="${s.provider}">
              <input name="listId" value="${(cfg.listId || '').replace(/"/g, '&quot;')}" placeholder="List ID" class="w-full border rounded-lg px-2 py-1.5">
              <input name="apiKey" type="password" value="${(cfg.apiKey || '').replace(/"/g, '&quot;')}" placeholder="API Key" class="w-full border rounded-lg px-2 py-1.5">
              <label class="flex items-center gap-2"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Enabled</label>
              <button type="submit" class="w-full py-1.5 border rounded-lg hover:bg-slate-50">Save via API</button>
            </form>
            <div class="flex flex-wrap gap-1">
              <button type="button" data-test="${s.provider}" class="admin-int-test px-2 py-1 text-[11px] border rounded-lg">Test</button>
              <button type="button" data-sync="${s.provider}" class="admin-sync-btn px-2 py-1 text-[11px] border rounded-lg bg-[#0369a1] text-white">Sync All</button>
            </div>
            <div class="mt-2 text-[10px] text-slate-400 admin-int-status" data-status="${s.provider}"></div>
          </div>`;
        }).join('')}
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="portal-panel text-sm">
          <h3 class="font-semibold mb-2">Newsletter Subscribers (${subs.length})</h3>
          <div class="text-xs max-h-32 overflow-auto mb-3">${subs.map((s) => `<div class="py-0.5 border-b">${s}</div>`).join('') || 'None yet.'}</div>
          <form id="admin-int-subscribe" class="flex gap-2 text-xs">
            <input name="email" type="email" placeholder="email@church.org" class="flex-1 border rounded-lg px-2 py-1.5" required>
            <button type="submit" class="px-3 py-1.5 bg-slate-800 text-white rounded-lg">Subscribe + Sync</button>
          </form>
        </div>
        <div class="portal-panel text-sm">
          <h3 class="font-semibold mb-2">Integration API Log</h3>
          <div class="text-[11px] font-mono max-h-48 overflow-auto space-y-1">
            ${log.length ? log.map((e) => `<div class="py-1 border-b"><span class="text-sky-700">${e.action}</span> · ${e.provider || '—'} · ${e.status || ''} · ${e.email || ''} <span class="text-slate-400">${new Date(e.at).toLocaleString()}</span></div>`).join('') : '<span class="text-slate-500">No API calls yet.</span>'}
          </div>
        </div>
      </div>
      <div class="portal-panel mt-4 text-sm">
        <h3 class="font-semibold mb-2"><i class="fa-solid fa-share-nodes text-sky-600 mr-1"></i> Social Media Links</h3>
        <form id="admin-social-form" class="grid md:grid-cols-2 gap-2 text-xs">
          <input name="facebook" placeholder="Facebook URL" class="border rounded-lg px-2 py-1.5">
          <input name="instagram" placeholder="Instagram URL" class="border rounded-lg px-2 py-1.5">
          <input name="twitter" placeholder="X / Twitter URL" class="border rounded-lg px-2 py-1.5">
          <input name="youtube" placeholder="YouTube URL" class="border rounded-lg px-2 py-1.5">
          <input name="linkedin" placeholder="LinkedIn URL" class="border rounded-lg px-2 py-1.5 col-span-2">
          <button type="submit" class="md:col-span-2 py-2 bg-slate-800 text-white rounded-lg">Save Social Links</button>
        </form>
      </div>`;

    el.querySelectorAll('.admin-int-config').forEach((form) => {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const provider = form.dataset.provider;
        const fd = new FormData(form);
        const res = await P.api.integrations.configure(provider, {
          listId: fd.get('listId'),
          apiKey: fd.get('apiKey'),
          enabled: fd.get('enabled') === 'on',
        });
        P.portalToast?.(res.ok ? `${provider} config saved via API` : 'Config save failed');
        P.renderAdminIntegrations(el);
      };
    });

    el.querySelectorAll('.admin-int-test').forEach((b) => {
      b.onclick = async () => {
        const provider = b.dataset.test;
        const statusEl = el.querySelector(`[data-status="${provider}"]`);
        if (statusEl) statusEl.textContent = 'Testing connection…';
        const res = await P.api.integrations.test(provider);
        if (statusEl) {
          statusEl.textContent = res.ok
            ? `✓ ${res.message} (${res.latencyMs}ms)`
            : `✗ ${res.error || 'Test failed'}`;
          statusEl.className = 'mt-2 text-[10px] ' + (res.ok ? 'text-emerald-600' : 'text-red-600') + ' admin-int-status';
        }
        P.renderAdminIntegrations(el);
      };
    });

    el.querySelectorAll('.admin-sync-btn').forEach((b) => {
      b.onclick = async () => {
        const provider = b.dataset.sync;
        const statusEl = el.querySelector(`[data-status="${provider}"]`);
        if (statusEl) statusEl.textContent = 'Syncing via API…';
        const res = await P.api.integrations.syncAll(provider);
        if (statusEl) {
          statusEl.textContent = res.ok
            ? `Synced ${res.synced} subscriber(s) to ${provider}`
            : `✗ ${res.error || 'Sync failed'}`;
        }
        P.portalToast?.(res.ok ? `Synced ${res.synced} contacts to ${provider}` : (res.error || 'Sync failed'));
        P.renderAdminIntegrations(el);
      };
    });

    el.querySelector('#admin-int-subscribe')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(e.target).get('email');
      const res = await P.api.integrations.subscribe(email);
      P.portalToast?.(res.ok ? `Subscribed ${email} across ${res.synced} integration(s)` : 'Subscribe failed');
      e.target.reset();
      P.renderAdminIntegrations(el);
    });

    if (P.apiConfig?.mode === 'remote') {
      fetch('/api/platform/social').then((r) => r.json()).then((d) => {
        const form = el.querySelector('#admin-social-form');
        if (!form || !d.links) return;
        Object.entries(d.links).forEach(([k, v]) => {
          const inp = form.querySelector('[name="' + k + '"]');
          if (inp) inp.value = v || '';
        });
      }).catch(() => {});
    }

    el.querySelector('#admin-social-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      const token = localStorage.getItem('urdfw_api_token');
      const r = await fetch('/api/platform/social', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      P.portalToast?.(j.ok ? 'Social links saved' : (j.error || 'Save failed'));
    });
  };

  P.renderAdminReviews = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading reviews…</p>';
    let flat = [];
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        flat = await P.api.reviews.listAll();
      } catch { /* fallback */ }
    }
    if (!flat.length) {
      const reviews = P.get('reviews', {});
      flat = Object.entries(reviews).flatMap(([lid, revs]) => revs.map((r) => ({ ...r, listingId: lid })));
    }
    const byListing = {};
    flat.forEach((r) => {
      const lid = r.listingId || r.listing_id || 'unknown';
      if (!byListing[lid]) byListing[lid] = [];
      byListing[lid].push(r);
    });
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-3">Reviews by Listing (${flat.length})</h3>
        <div class="space-y-4 text-sm max-h-[400px] overflow-auto">${Object.keys(byListing).length ? Object.entries(byListing).map(([lid, revs]) => `
          <div><div class="font-medium text-xs text-slate-500">Listing #${lid}</div>
          ${revs.map((r) => `<div class="border rounded p-2 mt-1 text-xs">${P.renderStars?.(r.stars) || r.stars + '★'} ${r.author}: ${r.text}</div>`).join('')}
          </div>`).join('') : '<p class="text-slate-500">No reviews yet.</p>'}
      </div>`;
  };

  P.renderAdminSupport = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading support tickets…</p>';
    let tickets = P.get('support_tickets', []);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const res = await fetch('/api/support', { headers: { Authorization: 'Bearer ' + localStorage.getItem('urdfw_api_token') } });
        if (res.ok) { tickets = await res.json(); P.set('support_tickets', tickets); }
      } catch { /* keep */ }
    }
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-3">Support Tickets (${tickets.length})</h3>
        <div class="space-y-2 text-sm">${tickets.map((t) => `
          <div class="border rounded-2xl p-3 flex justify-between">
            <div><strong>${t.name || t.email}</strong> — ${t.topic || 'General'}<div class="text-xs text-slate-500 mt-1">${t.message}</div></div>
            <button type="button" data-ticket="${t.id}" class="admin-close-ticket text-xs text-emerald-600">${t.status === 'open' ? 'Close' : t.status}</button>
          </div>`).join('') || '<p class="text-slate-500">No tickets.</p>'}
      </div>`;

    el.querySelectorAll('.admin-close-ticket').forEach((b) => b.onclick = async () => {
      const id = b.dataset.ticket;
      if (P.apiConfig?.mode === 'remote') {
        await fetch('/api/support/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('urdfw_api_token') },
          body: JSON.stringify({ status: 'closed' }),
        });
      } else {
        const list = P.get('support_tickets', []);
        const t = list.find((x) => x.id === id);
        if (t) { t.status = 'closed'; P.set('support_tickets', list); }
      }
      P.renderAdminSupport(el);
    });
  };

  P.renderAdminAnalytics = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 py-8 text-center">Loading analytics…</div>';
    const A = global.URDFWAnalytics;
    const stats = P.getClickStats();
    try {
      if (P.apiConfig?.mode === 'remote' && A?.fetchAdmin) {
        const data = await A.fetchAdmin();
        el.innerHTML = '<div id="admin-analytics-live"></div><div id="admin-analytics-clicks" class="mt-6"></div>';
        A.renderAdminCharts(el.querySelector('#admin-analytics-live'), data);
        const clickEl = el.querySelector('#admin-analytics-clicks');
        clickEl.innerHTML = `
          <div class="portal-panel">
            <h3 class="font-semibold mb-2 text-sm">On-Site Click Tracking</h3>
            <div class="text-2xl font-bold text-[#0369a1]">${stats.total}</div>
            <div class="text-xs text-slate-500 mt-2">${Object.entries(stats.byType || {}).map(([k, v]) => k + ': ' + v).join(' · ') || 'No clicks yet'}</div>
          </div>`;
        return;
      }
    } catch { /* fallback */ }
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-6">
        <h3 class="font-semibold mb-4">Click Statistics (local)</h3>
        <div class="text-3xl font-bold text-[#0369a1]">${stats.total}</div>
        <div class="text-sm text-slate-500 mt-1">total tracked interactions</div>
      </div>`;
  };

  P.renderAdminApi = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading API panel…</p>';
    const st = P.api?.getStatus?.() || { mode: 'local', connected: true, endpoints: {}, recentCalls: [] };
    let hooks = P.get('webhooks', []);
    let hookLog = P.get('webhook_log', []);
    let eventLog = [];
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        hooks = await P.api.webhooks.list();
        hookLog = await P.api.webhooks.log();
        eventLog = await P.api.webhooks.eventsLog();
        P.set('webhooks', hooks);
      } catch { /* keep local */ }
    }
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="portal-panel">
          <h3 class="font-semibold mb-3">API Connection</h3>
          <p class="text-xs text-slate-500 mb-4">Local mode uses browser storage. Switch to remote when your backend is ready.</p>
          <form id="admin-api-config" class="space-y-3 text-sm">
            <div>
              <label class="text-xs font-medium">Mode</label>
              <select name="mode" class="w-full border rounded-xl px-3 py-2 text-sm">
                <option value="local" ${st.mode === 'local' ? 'selected' : ''}>Local (localStorage)</option>
                <option value="remote" ${st.mode === 'remote' ? 'selected' : ''}>Remote API</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-medium">Base URL</label>
              <input name="base" value="${st.endpoints?.base || ''}" placeholder="https://api.yourdomain.com" class="w-full border rounded-xl px-3 py-2 text-sm">
            </div>
            <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl text-sm">Save API Config</button>
          </form>
          <div class="mt-4 text-xs space-y-1">
            <div><strong>Auth:</strong> ${st.endpoints?.auth || '/api/auth'}</div>
            <div><strong>Billing:</strong> ${st.endpoints?.billing || '/api/billing'}</div>
            <div><strong>Listings:</strong> ${st.endpoints?.listings || '/api/listings'}</div>
            <div><strong>Integrations:</strong> ${st.endpoints?.integrations || '/api/integrations'}</div>
          </div>
        </div>
        <div class="portal-panel">
          <h3 class="font-semibold mb-3">Webhooks</h3>
          <form id="admin-webhook-form" class="flex gap-2 text-xs mb-4">
            <input name="url" placeholder="https://hooks.example.com/urdfw" class="flex-1 border rounded-xl px-3 py-2" required>
            <button type="submit" class="px-3 py-2 bg-slate-800 text-white rounded-xl">Add</button>
          </form>
          <div class="text-xs space-y-2 max-h-32 overflow-auto mb-4">${hooks.length ? hooks.map((h) => `<div class="py-1 border-b font-mono flex justify-between gap-2"><span>${h.url}</span>${h.active === false ? '<span class="text-red-500">off</span>' : ''}</div>`).join('') : '<span class="text-slate-500">No webhooks registered.</span>'}</div>
          <h4 class="font-semibold text-xs mb-2">Recent API Calls</h4>
          <div class="text-[11px] space-y-1 max-h-32 overflow-auto font-mono">${(st.recentCalls || []).map((c) => `<div class="py-1 border-b">${c.name} • ${c.source} • ${c.ms}ms</div>`).join('') || 'No calls yet.'}</div>
          <h4 class="font-semibold text-xs mt-4 mb-2">Webhook Delivery Log</h4>
          <div class="text-[11px] max-h-24 overflow-auto">${hookLog.slice(0, 10).map((l) => `<div class="py-0.5">${l.event || l.action} → ${l.url || l.target} <span class="text-slate-400">${l.status || ''}</span></div>`).join('') || 'Empty.'}</div>
          <h4 class="font-semibold text-xs mt-4 mb-2">Platform Events</h4>
          <div class="text-[11px] max-h-24 overflow-auto">${eventLog.slice(0, 10).map((e) => `<div class="py-0.5">${e.type || e.event} — ${e.at || e.created_at}</div>`).join('') || 'No events yet.'}</div>
        </div>
      </div>`;

    el.querySelector('#admin-api-config')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      P.api.setMode(fd.get('mode'), fd.get('base') || null);
      P.portalToast?.('API configuration saved.');
      P.renderAdminApi(el);
      P.renderApiStatusPanel?.('admin-api-status');
    });

    el.querySelector('#admin-webhook-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = new FormData(e.target).get('url');
      await P.api.webhooks.register(url, ['payment.completed', 'user.registered', 'lead.created', 'support.created']);
      P.portalToast?.('Webhook registered.');
      e.target.reset();
      P.renderAdminApi(el);
    });
  };

  /* Bridge legacy urdfw_clients key */
  const origGet = P.get;
  P.get = function (key, fallback) {
    if (key === 'clients') {
      const v = origGet.call(P, 'clients', null);
      if (v && v.length) return v;
      return JSON.parse(localStorage.getItem('urdfw_clients') || '[]');
    }
    if (key === 'custom_listings') {
      const v = origGet.call(P, 'custom_listings', null);
      if (v && v.length) return v;
      return JSON.parse(localStorage.getItem('urdfw_custom_listings') || '[]');
    }
    if (key === 'leads') {
      const v = origGet.call(P, 'leads', null);
      if (v && v.length) return v;
      return JSON.parse(localStorage.getItem('urdfw_leads') || '[]');
    }
    if (key === 'subscribers') {
      const v = origGet.call(P, 'subscribers', null);
      if (v && v.length) return v;
      return JSON.parse(localStorage.getItem('urdfw_subscribers') || '[]');
    }
    return origGet.call(P, key, fallback);
  };

  const origSet = P.set;
  P.set = function (key, value) {
    if (key === 'clients') localStorage.setItem('urdfw_clients', JSON.stringify(value));
    if (key === 'custom_listings') localStorage.setItem('urdfw_custom_listings', JSON.stringify(value));
    if (key === 'leads') localStorage.setItem('urdfw_leads', JSON.stringify(value));
    if (key === 'subscribers') localStorage.setItem('urdfw_subscribers', JSON.stringify(value));
    return origSet.call(P, key, value);
  };
})(window);