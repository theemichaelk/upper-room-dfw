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
      </div>
      <div class="mt-8 border-t pt-6" id="member-integrations-panel">
        <h3 class="font-semibold mb-2">My API Integrations</h3>
        <p class="text-xs text-slate-500 mb-4">Connect your own Mailchimp, Vbout, or Acumbamail accounts. Platform admin keys are not shared with members.</p>
        <div class="grid md:grid-cols-3 gap-4" id="member-int-forms">Loading…</div>
      </div>`;

    P.renderMemberIntegrationsPanel?.(el.querySelector('#member-int-forms'), client);

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

  P.renderMemberMedia = async function (el, client) {
    if (!el) return;
    const listingId = client?.listingId || client?.id;
    const media = await (P.loadListingMedia?.(listingId) || Promise.resolve(P.getListingMedia(listingId)));
    const thumb = (m) => m.url || m.dataUrl || '';
    el.innerHTML = `
      <h3 class="font-semibold mb-3">Photos &amp; Video</h3>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <label class="text-sm font-medium">Upload listing photo</label>
          <input type="file" accept="image/*" id="member-media-upload" class="mt-2 text-sm w-full">
          <div id="member-media-gallery" class="mt-3 flex flex-wrap gap-2">${media.map((m) => `<div class="relative group"><img src="${thumb(m)}" class="w-16 h-16 rounded object-cover border" alt=""><button type="button" data-del="${m.id}" class="hidden group-hover:block absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] leading-4">×</button></div>`).join('') || '<span class="text-xs text-slate-500">No uploads yet.</span>'}</div>
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
      try {
        await P.uploadImageAjax(file, listingId, client?.id);
        P.portalToast?.('Photo uploaded to cloud storage.');
      } catch (err) {
        P.portalToast?.(err.message || 'Upload failed');
      }
      P.renderMemberMedia(el, client);
    };

    el.querySelectorAll('[data-del]').forEach((btn) => {
      btn.onclick = async () => {
        await P.deleteListingMedia?.(btn.dataset.del, listingId);
        P.renderMemberMedia(el, client);
      };
    });

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
  P.esc = P.esc || function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  P.adminPatchListing = async function (id, patch) {
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      const res = await fetch('/api/listings/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      return res.json();
    }
    return null;
  };

  P.adminTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'listings', label: 'Listings' },
    { id: 'users', label: 'Users' },
    { id: 'claims', label: 'Claims' },
    { id: 'billing', label: 'Billing' },
    { id: 'email', label: 'Email' },
    { id: 'seo', label: 'SEO Hub' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'support', label: 'Support' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'api', label: 'API & Webhooks' },
    { id: 'dns', label: 'DNS' },
  ];

  P._adminDashState = { root: null, panels: null, activeTab: null, gen: 0 };
  P._adminTabGen = 0;

  /** Always resolve the live panel node (never a detached closure). */
  P.getAdminPanelEl = function () {
    const root = document.getElementById('admin-platform-root');
    if (!root) return null;
    let panels = root.querySelector('#admin-tab-panels');
    if (!panels) {
      root.innerHTML = '<div id="admin-tab-panels" class="admin-tab-panels" style="min-height:12rem"></div>';
      panels = root.querySelector('#admin-tab-panels');
    }
    return panels;
  };

  P.syncAdminNavActive = function (tabId) {
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      const on = btn.dataset.adminTab === tabId;
      btn.classList.toggle('active', on);
      if (btn.setAttribute) btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };

  P.initAdminDashboard = function (rootId) {
    const root = document.getElementById(rootId || 'admin-platform-root');
    if (!root) return;

    if (!root.querySelector('#admin-tab-panels')) {
      root.innerHTML = '<div id="admin-tab-panels" class="admin-tab-panels" style="min-height:12rem"></div>';
    }

    /* Horizontal tab strip for mobile / secondary nav (sidebar hides &lt;1024px) */
    let strip = document.getElementById('admin-mobile-tabs');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'admin-mobile-tabs';
      strip.className = 'admin-mobile-tabs';
      strip.setAttribute('role', 'tablist');
      strip.innerHTML = (P.adminTabs || []).map((t) =>
        `<button type="button" role="tab" class="admin-mobile-tab" data-admin-tab="${t.id}">${P.esc(t.label)}</button>`
      ).join('');
      root.parentElement?.insertBefore(strip, root);
    }

    P._adminDashState = {
      root,
      panels: root.querySelector('#admin-tab-panels'),
      activeTab: P._adminDashState?.activeTab || 'overview',
      gen: P._adminTabGen,
    };
    P.showAdminTab(P._adminDashState.activeTab || 'overview');
  };

  /**
   * Switch admin main panel. Uses a generation token + staging commit so
   * late async renders from a previous tab cannot wipe the current tab
   * (or leave a blank panel).
   */
  P.showAdminTab = function (tabId) {
    const id = tabId || 'overview';
    const gen = ++P._adminTabGen;
    P._adminDashState = P._adminDashState || {};
    P._adminDashState.activeTab = id;
    P._adminDashState.gen = gen;
    P.syncAdminNavActive(id);

    const el = P.getAdminPanelEl();
    if (!el) {
      console.warn('[URDFW] admin-platform-root missing — cannot show tab', id);
      return Promise.resolve();
    }
    P._adminDashState.panels = el;
    P._adminDashState.root = document.getElementById('admin-platform-root');

    el.dataset.activeTab = id;
    el.innerHTML = `<div class="text-sm text-slate-500 py-10 text-center" data-admin-loading="1">
      <i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading ${P.esc(id)}…
    </div>`;

    return P.renderAdminTab(el, id, gen);
  };

  /**
   * Live panel surface that drops DOM writes when this tab generation is stale.
   * Prevents late async responses from wiping the currently visible tab (or
   * leaving a blank panel). Refresh handlers still target the live node.
   */
  P._adminPanelSurface = function (panel, gen) {
    const current = () => gen === P._adminTabGen;
    const surface = {
      get innerHTML() { return panel.innerHTML; },
      set innerHTML(v) { if (current()) panel.innerHTML = v; },
      get textContent() { return panel.textContent; },
      set textContent(v) { if (current()) panel.textContent = v; },
      get className() { return panel.className; },
      set className(v) { if (current()) panel.className = v; },
      get classList() { return panel.classList; },
      get dataset() { return panel.dataset; },
      get style() { return panel.style; },
      get children() { return panel.children; },
      get childNodes() { return panel.childNodes; },
      get firstChild() { return panel.firstChild; },
      get lastChild() { return panel.lastChild; },
      get parentElement() { return panel.parentElement; },
      get isConnected() { return panel.isConnected; },
      get id() { return panel.id; },
      querySelector: (...a) => panel.querySelector(...a),
      querySelectorAll: (...a) => panel.querySelectorAll(...a),
      getElementById: (id) => panel.querySelector('[id="' + String(id).replace(/"/g, '') + '"]'),
      appendChild(n) { return current() ? panel.appendChild(n) : n; },
      removeChild(n) { return current() ? panel.removeChild(n) : n; },
      replaceChildren(...nodes) { if (current()) panel.replaceChildren(...nodes); },
      insertAdjacentHTML(...a) { if (current()) panel.insertAdjacentHTML(...a); },
      insertAdjacentElement(...a) { if (current()) return panel.insertAdjacentElement(...a); return null; },
      addEventListener: (...a) => panel.addEventListener(...a),
      removeEventListener: (...a) => panel.removeEventListener(...a),
      closest: (...a) => panel.closest(...a),
      matches: (...a) => panel.matches(...a),
      contains: (...a) => panel.contains(...a),
      focus: (...a) => panel.focus?.(...a),
      scrollIntoView: (...a) => panel.scrollIntoView?.(...a),
      _urdfwPanel: panel,
      _urdfwGen: gen,
    };
    return surface;
  };

  P.renderAdminTab = async function (el, tabId, gen) {
    if (gen == null) gen = P._adminTabGen;
    const stillCurrent = () => gen === P._adminTabGen;
    const live = () => P.getAdminPanelEl() || el;

    const handlers = {
      overview: P.renderAdminOverview,
      listings: P.renderAdminListings,
      users: P.renderAdminUsers,
      claims: P.renderAdminClaims,
      billing: P.renderAdminBilling,
      email: P.renderAdminEmail,
      seo: P.renderAdminSeo,
      integrations: P.renderAdminIntegrations,
      reviews: P.renderAdminReviews,
      support: P.renderAdminSupport,
      analytics: P.renderAdminAnalytics,
      api: P.renderAdminApi,
      dns: P.renderAdminDns,
    };

    const fn = handlers[tabId];
    if (typeof fn !== 'function') {
      if (!stillCurrent()) return;
      const panel = live();
      if (panel) {
        panel.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          <strong><i class="fa-solid fa-puzzle-piece mr-1"></i> Tab “${P.esc(tabId)}” is unavailable</strong>
          <p class="mt-2 text-xs">The renderer module did not load. Hard-refresh the page (Ctrl+F5). If it persists, check that platform scripts are deployed.</p>
          <button type="button" class="mt-3 px-3 py-1.5 text-xs border rounded-xl bg-white" data-retry-tab="${P.esc(tabId)}">Retry</button>
        </div>`;
        panel.querySelector('[data-retry-tab]')?.addEventListener('click', () => P.showAdminTab(tabId));
      }
      return;
    }

    const panel = live();
    if (!panel) return;
    const surface = P._adminPanelSurface(panel, gen);

    try {
      await fn.call(P, surface);
      if (!stillCurrent()) return;
      /* Renderer returned without painting anything useful */
      const onlyLoading = !!panel.querySelector('[data-admin-loading]') && (panel.textContent || '').trim().startsWith('Loading');
      if (!panel.innerHTML.trim() || onlyLoading) {
        panel.innerHTML = `<div class="bg-white border rounded-2xl p-8 text-center text-sm text-slate-500">
          <i class="fa-solid fa-inbox text-2xl text-slate-300 mb-2 block"></i>
          No content for <strong>${P.esc(tabId)}</strong> yet.
          <div class="mt-3"><button type="button" class="px-3 py-1.5 text-xs border rounded-xl" data-retry-tab="${P.esc(tabId)}">Retry</button></div>
        </div>`;
        panel.querySelector('[data-retry-tab]')?.addEventListener('click', () => P.showAdminTab(tabId));
      }
      panel.dataset.renderedTab = tabId;
    } catch (err) {
      console.error('[URDFW] Admin tab render failed:', tabId, err);
      if (!stillCurrent()) return;
      panel.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">
        <strong><i class="fa-solid fa-circle-exclamation mr-1"></i> Could not load ${P.esc(tabId)}</strong>
        <p class="mt-2 text-xs font-mono break-all">${P.esc(err?.message || String(err))}</p>
        <button type="button" class="mt-3 px-3 py-1.5 text-xs border border-red-200 rounded-xl bg-white text-red-800" data-retry-tab="${P.esc(tabId)}">Retry</button>
      </div>`;
      panel.querySelector('[data-retry-tab]')?.addEventListener('click', () => P.showAdminTab(tabId));
    }
  };

  P.renderAdminOverview = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 py-8 text-center"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading live command center…</div>';
    const A = global.URDFWAnalytics;
    const token = localStorage.getItem('urdfw_api_token');
    const remote = P.apiConfig?.mode === 'remote' && token;

    try {
      if (remote && A?.fetchAdmin) {
        const data = await A.fetchAdmin();
        A.renderKpiGrid(el, data.kpis || {});
        const chartsHost = document.createElement('div');
        el.appendChild(chartsHost);
        A.renderAdminCharts(chartsHost, data);
        const actions = document.createElement('div');
        actions.className = 'flex flex-wrap gap-2 mt-4';
        actions.innerHTML = `
          <button type="button" id="admin-backup-now" class="px-4 py-2 text-xs bg-slate-900 text-white rounded-xl">Backup DB to S3</button>
          <button type="button" id="admin-refresh-stats" class="px-4 py-2 text-xs border rounded-xl">Refresh Live Data</button>
          <button type="button" data-jump="listings" class="px-4 py-2 text-xs border rounded-xl">Listings</button>
          <button type="button" data-jump="billing" class="px-4 py-2 text-xs border rounded-xl">Billing</button>
          <button type="button" data-jump="support" class="px-4 py-2 text-xs border rounded-xl">Support</button>`;
        el.appendChild(actions);
        actions.querySelector('#admin-backup-now')?.addEventListener('click', async () => {
          try {
            const r = await fetch('/api/admin/backup-db', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
            const j = await r.json();
            P.portalToast?.(j.ok ? 'DB backed up (' + (j.bytes || 0) + ' bytes)' : (j.error || 'Backup failed'));
          } catch (e) {
            P.portalToast?.(e.message || 'Backup failed');
          }
        });
        actions.querySelector('#admin-refresh-stats')?.addEventListener('click', () => P.renderAdminOverview(el));
        actions.querySelectorAll('[data-jump]').forEach((b) => {
          b.onclick = () => P.showAdminTab(b.dataset.jump);
        });
        return;
      }
    } catch (err) {
      console.warn('[URDFW] Overview analytics failed', err);
    }

    /* Stats fallback (remote without charts, or local) */
    let stats = null;
    if (remote) {
      try { stats = await P.api.admin.stats(); } catch { /* ignore */ }
    }
    const clients = stats ? stats.clients : P.get('clients', []).length;
    const orders = stats ? stats.orders : P.get('orders', []).length;
    const tickets = stats ? stats.tickets : P.get('support_tickets', []).filter((t) => t.status === 'open').length;
    const listings = stats ? stats.listings : P.get('custom_listings', []).length;
    const pending = stats ? stats.pending : P.get('clients', []).filter((c) => c.status === 'pending').length;
    const revenue = stats ? stats.revenue : 0;
    el.innerHTML = `
      <div class="portal-panel mb-4 text-xs ${remote ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'}">
        ${remote ? 'Live stats from API (charts unavailable).' : 'Local mode — connect API for full analytics.'}
      </div>
      <div class="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Clients</div><div class="text-2xl font-bold">${clients}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Listings</div><div class="text-2xl font-bold">${listings}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Orders</div><div class="text-2xl font-bold">${orders}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Revenue</div><div class="text-2xl font-bold">$${revenue}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Pending</div><div class="text-2xl font-bold">${pending}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Open Tickets</div><div class="text-2xl font-bold">${tickets}</div></div>
      </div>
      <button type="button" id="admin-refresh-stats" class="px-4 py-2 text-xs border rounded-xl">Refresh</button>`;
    el.querySelector('#admin-refresh-stats')?.addEventListener('click', () => P.renderAdminOverview(el));
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
        const res = await fetch(P.resolveAsset('data/churches.json'));
        churches = await res.json();
      } catch { /* ignore */ }
      const customs = P.get('custom_listings', []);
      const enhance = P.enhanceListing || ((c) => c);
      all = [...customs, ...churches.map((c) => enhance(c))];
    }
    const meta = P.get('listing_meta', {});
    const esc = P.esc;

    const renderRows = (list) => list.slice(0, 150).map((l) => {
      const m = meta[l.id] || {};
      const featured = l.featured || m.featured;
      const sticky = l.sticky || m.sticky;
      const vip = l.level === 'vip' || m.vip || m.level === 'vip';
      const slug = l.slug ? `churches/${l.slug}.html` : '';
      return `<div class="flex flex-wrap items-center justify-between gap-2 border-b py-2 admin-listing-row" data-name="${esc((l.name || '').toLowerCase())}" data-area="${esc((l.area || '').toLowerCase())}">
        <div>
          <strong>${slug ? `<a href="${esc(slug)}" class="hover:underline text-sky-800" target="_blank" rel="noopener">${esc(l.name)}</a>` : esc(l.name)}</strong>
          <span class="text-xs text-slate-500"> ${esc(l.area || '')} • ${esc(l.status || 'live')}</span>
          ${featured ? '<span class="badge-featured ml-1">Featured</span>' : ''}
          ${sticky ? '<span class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded ml-1">Sticky</span>' : ''}
          ${vip ? '<span class="badge-vip ml-1">VIP</span>' : ''}
        </div>
        <div class="flex flex-wrap gap-1 text-xs">
          <button type="button" data-feat="${esc(l.id)}" data-on="${featured ? '1' : '0'}" class="admin-feat px-2 py-0.5 border rounded">${featured ? 'Unfeature' : 'Feature'}</button>
          <button type="button" data-sticky="${esc(l.id)}" class="admin-sticky px-2 py-0.5 border rounded">Sticky</button>
          <button type="button" data-vip="${esc(l.id)}" class="admin-vip px-2 py-0.5 border rounded">VIP</button>
          ${(l.status === 'pending' || l.status === 'registered') ? `<button type="button" data-approve="${esc(l.id)}" class="text-emerald-600 px-2">Go Live</button>` : ''}
        </div></div>`;
    }).join('') || '<p class="text-slate-500">No listings.</p>';

    el.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <input id="admin-listing-search" type="search" placeholder="Search name or area…" class="border rounded-xl px-3 py-1.5 text-xs min-w-[200px]">
        <button type="button" id="admin-export-all-csv" class="px-3 py-1.5 text-xs border rounded-2xl">Export CSV</button>
        <button type="button" id="admin-seed-demo" class="px-3 py-1.5 text-xs border rounded-2xl">Seed Demo Meta</button>
        <span class="text-xs text-slate-500" id="admin-listing-count">${all.length} listings</span>
      </div>
      <div class="bg-white border rounded-3xl p-4 max-h-[520px] overflow-auto text-sm space-y-2" id="admin-all-listings">
        ${renderRows(all)}
      </div>`;

    const listEl = el.querySelector('#admin-all-listings');
    el.querySelector('#admin-listing-search')?.addEventListener('input', (e) => {
      const q = (e.target.value || '').toLowerCase().trim();
      const rows = listEl.querySelectorAll('.admin-listing-row');
      let shown = 0;
      rows.forEach((row) => {
        const hit = !q || (row.dataset.name || '').includes(q) || (row.dataset.area || '').includes(q);
        row.classList.toggle('hidden', !hit);
        if (hit) shown++;
      });
      const count = el.querySelector('#admin-listing-count');
      if (count) count.textContent = shown + ' of ' + all.length + ' listings';
    });

    el.querySelector('#admin-export-all-csv')?.addEventListener('click', () => {
      if (P.exportCSV) P.exportCSV(all, 'urdfw-all-listings.csv');
      else P.portalToast?.('CSV export module not loaded');
    });
    el.querySelector('#admin-seed-demo')?.addEventListener('click', () => {
      if (P.seedDemoData) { P.seedDemoData(); P.portalToast?.('Demo listing meta seeded.'); }
      else P.portalToast?.('Seed only available in full local mode.');
      P.renderAdminListings(el);
    });

    const withToast = async (fn, okMsg) => {
      try {
        await fn();
        if (okMsg) P.portalToast?.(okMsg);
        P.renderAdminListings(el);
      } catch (e) {
        P.portalToast?.(e.message || 'Update failed');
      }
    };

    el.querySelectorAll('[data-feat]').forEach((b) => b.onclick = () => withToast(async () => {
      const id = b.dataset.feat;
      const on = b.dataset.on === '1';
      P.markFeatured?.(id, !on);
      await P.adminPatchListing(id, { featured: !on });
    }, b.dataset.on === '1' ? 'Feature removed' : 'Marked featured'));
    el.querySelectorAll('[data-sticky]').forEach((b) => b.onclick = () => withToast(async () => {
      const id = b.dataset.sticky;
      P.upgradeListing?.(id, 'premium');
      await P.adminPatchListing(id, { featured: true, sticky: true, level: 'premium' });
    }, 'Marked sticky / premium'));
    el.querySelectorAll('[data-vip]').forEach((b) => b.onclick = () => withToast(async () => {
      const id = b.dataset.vip;
      P.upgradeListing?.(id, 'vip');
      await P.adminPatchListing(id, { featured: true, sticky: true, level: 'vip' });
    }, 'Marked VIP'));
    el.querySelectorAll('[data-approve]').forEach((b) => b.onclick = () => withToast(async () => {
      const id = b.dataset.approve;
      await P.adminPatchListing(id, { status: 'live' });
      if (P.apiConfig?.mode !== 'remote') {
        const customs2 = P.get('custom_listings', []);
        const item = customs2.find((x) => x.id === id);
        if (item) { item.status = 'approved'; P.set('custom_listings', customs2); }
      }
    }, 'Listing is live'));
  };

  P.renderAdminUsers = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading users…</p>';
    let clients = P.get('clients', []);
    let users = P.get('users', []);
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const list = await P.api.clients.list();
        if (Array.isArray(list)) { clients = list; P.set('clients', list); }
      } catch { /* keep local */ }
      try {
        const res = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) {
          const data = await res.json();
          users = Array.isArray(data) ? data : (data.users || []);
          P.set('users', users);
        }
      } catch { /* keep local */ }
    }
    const dir = typeof P.getUserDirectory === 'function'
      ? P.getUserDirectory()
      : users.map((u) => ({ name: u.name, email: u.email, role: u.role || 'member' }));
    const esc = P.esc;
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Church Registrations (${clients.length})</h3>
          <div class="space-y-2 max-h-80 overflow-auto text-xs">
            ${clients.map((c) => `<div class="flex justify-between border-b py-2 gap-2">
              <span>${esc(c.name)} — ${esc(c.email)}</span>
              <span class="shrink-0 ${c.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'}">${esc(c.status || 'approved')}</span>
              ${c.status === 'pending' ? `<button type="button" data-client="${esc(c.id)}" class="admin-approve-client text-emerald-600 ml-2 shrink-0">Approve</button>` : ''}
            </div>`).join('') || '<p class="text-slate-500">No clients.</p>'}
          </div>
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Platform Users (${dir.length})</h3>
          <div class="space-y-2 max-h-80 overflow-auto text-xs">
            ${dir.map((u) => `<div class="border-b py-2">${esc(u.name)} — ${esc(u.email)} <span class="text-slate-400">(${esc(u.role)})</span></div>`).join('') || '<p class="text-slate-500">No users yet.</p>'}
          </div>
        </div>
      </div>`;

    el.querySelectorAll('.admin-approve-client').forEach((b) => b.onclick = async () => {
      try {
        if (P.apiConfig?.mode === 'remote') {
          await P.api.clients.approve(b.dataset.client);
        } else {
          const list = P.get('clients', []);
          const c = list.find((x) => x.id === b.dataset.client);
          if (c) { c.status = 'approved'; P.set('clients', list); }
        }
        P.portalToast?.('Client approved');
        P.renderAdminUsers(el);
        P.renderAdminQuickStats?.();
      } catch (e) {
        P.portalToast?.(e.message || 'Approve failed');
      }
    });
  };

  P.renderAdminClaims = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading claims…</p>';
    let claims = P.get('claims', []);
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const list = await P.api.claims.list();
        if (Array.isArray(list)) { claims = list; P.set('claims', list); }
      } catch (e) {
        el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">Could not load claims: ${P.esc(e.message)}</div>`;
        return;
      }
    }
    const pending = claims.filter((c) => c.status === 'pending').length;
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-1">Listing Claims (${claims.length})</h3>
        <p class="text-xs text-slate-500 mb-3">${pending} pending approval</p>
        <div class="space-y-2 text-sm">${claims.length ? claims.map((c) => `
          <div class="flex flex-wrap justify-between border rounded-2xl p-3 gap-2">
            <div>
              <strong>${P.esc(c.email || c.name || 'Claimant')}</strong>
              ${c.name && c.email ? `<span class="text-slate-500"> · ${P.esc(c.name)}</span>` : ''}
              <div class="text-xs text-slate-500 mt-0.5">Listing: ${P.esc(c.listingId || c.listing_id || '—')}${c.proof ? ' · Proof: ' + P.esc(c.proof) : ''}</div>
              <span class="text-xs mt-1 inline-block px-2 py-0.5 rounded ${c.status === 'pending' ? 'bg-amber-100 text-amber-800' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">${P.esc(c.status || 'pending')}</span>
            </div>
            ${c.status === 'pending' ? `<div class="flex gap-2 shrink-0">
              <button type="button" data-claim="${P.esc(c.id)}" data-action="approved" class="admin-claim-act text-xs text-emerald-700 font-medium">Approve</button>
              <button type="button" data-claim="${P.esc(c.id)}" data-action="rejected" class="admin-claim-act text-xs text-red-600">Reject</button>
            </div>` : ''}
          </div>`).join('') : '<p class="text-slate-500 text-sm">No claims submitted yet.</p>'}
      </div>`;

    el.querySelectorAll('.admin-claim-act').forEach((b) => b.onclick = async () => {
      const id = b.dataset.claim;
      const status = b.dataset.action;
      try {
        if (P.apiConfig?.mode === 'remote') {
          await fetch('/api/claims/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + localStorage.getItem('urdfw_api_token'),
            },
            body: JSON.stringify({ status }),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              throw new Error(j.error || 'Claim update failed');
            }
          });
        } else {
          const list = P.get('claims', []);
          const c = list.find((x) => x.id === id);
          if (c) { c.status = status; P.set('claims', list); }
        }
        P.portalToast?.(status === 'approved' ? 'Claim approved — listing linked.' : 'Claim rejected.');
        P.renderAdminClaims(el);
      } catch (e) {
        P.portalToast?.(e.message || 'Claim update failed');
      }
    });
  };

  P.renderAdminBilling = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading billing…</p>';
    let orders = P.get('orders', []);
    let invoices = P.get('invoices', []);
    let coupons = P.get('coupons', []);
    let stripe = null;
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const [o, inv, coup, st] = await Promise.all([
          P.api.admin.orders().catch(() => null),
          fetch('/api/admin/invoices', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.ok ? r.json() : []).catch(() => []),
          fetch('/api/admin/coupons', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.ok ? r.json() : []).catch(() => []),
          fetch('/api/billing/stripe-status').then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (Array.isArray(o)) { orders = o; P.set('orders', o); }
        if (Array.isArray(inv)) { invoices = inv; P.set('invoices', inv); }
        if (Array.isArray(coup) && coup.length) { coupons = coup; P.set('coupons', coup); }
        stripe = st;
      } catch { /* keep */ }
    }
    const revenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const stripeBanner = stripe
      ? `<div class="mb-4 p-3 rounded-2xl border text-sm ${stripe.configured || stripe.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}">
          <strong>Stripe:</strong> ${stripe.enabled ? (stripe.mode || 'live') : 'disabled'}
          ${stripe.configured ? ' · prices configured' : ' · set STRIPE_PRICE_* in env'}
          ${stripe.publishableKey ? ' · publishable key set' : ''}
        </div>`
      : '';
    el.innerHTML = `
      ${stripeBanner}
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Orders</div><div class="text-2xl font-bold">${orders.length}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Order revenue</div><div class="text-2xl font-bold">$${revenue.toLocaleString()}</div></div>
        <div class="bg-white border rounded-2xl p-4"><div class="text-xs text-slate-500">Invoices</div><div class="text-2xl font-bold">${invoices.length}</div></div>
      </div>
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Orders (${orders.length})</h3>
          <div class="text-xs space-y-1 max-h-64 overflow-auto">${orders.map((o) => `<div class="py-1.5 border-b flex justify-between gap-2">
            <span>${P.esc(o.ref || o.id || '—')} · ${P.esc(o.email || '')}</span>
            <span class="shrink-0">$${o.amount ?? 0} ${P.esc(o.plan || '')} <span class="text-slate-400">via ${P.esc(o.gateway || '—')}</span></span>
          </div>`).join('') || 'No orders yet.'}</div>
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Coupons</h3>
          <div class="text-sm space-y-2 mb-3">${coupons.length ? coupons.map((c) => `<div class="flex justify-between border-b py-1"><code>${P.esc(c.code)}</code><span class="text-xs text-slate-600">${c.type === 'percent' ? c.discount + '%' : '$' + c.discount} off · used ${c.used || 0}/${c.limit || c.limit_count || '∞'}</span></div>`).join('') : '<p class="text-xs text-slate-500">No coupons yet.</p>'}</div>
          <form id="admin-add-coupon" class="mt-2 flex flex-wrap gap-2 text-xs">
            <input name="code" placeholder="CODE" class="border rounded px-2 py-1.5" required>
            <input name="discount" type="number" min="1" placeholder="10" class="border rounded px-2 py-1.5 w-16" required>
            <select name="type" class="border rounded px-2 py-1.5"><option value="percent">%</option><option value="fixed">$</option></select>
            <button type="submit" class="px-3 py-1.5 bg-[#0369a1] text-white rounded">Add</button>
          </form>
        </div>
      </div>
      <div class="mt-4 bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-2">Invoices</h3>
        <div class="text-xs max-h-48 overflow-auto">${invoices.slice(0, 25).map((i) => `<div class="py-1 border-b flex justify-between"><span>${P.esc(i.id)}</span><span>$${i.amount ?? 0} · ${P.esc(i.status || '')} · ${P.esc(i.date || '')}</span></div>`).join('') || 'No invoices.'}</div>
      </div>`;

    el.querySelector('#admin-add-coupon')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        code: String(fd.get('code') || '').toUpperCase(),
        discount: +fd.get('discount'),
        type: fd.get('type') || 'percent',
        limit: 100,
      };
      try {
        if (P.apiConfig?.mode === 'remote' && token) {
          const r = await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(payload),
          });
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || 'Save failed');
        } else {
          const list = P.get('coupons', []);
          list.push({ ...payload, used: 0, expires: '2027-12-31' });
          P.set('coupons', list);
        }
        P.portalToast?.('Coupon saved: ' + payload.code);
        P.renderAdminBilling(el);
      } catch (err) {
        P.portalToast?.(err.message || 'Coupon save failed');
      }
    });
  };

  P.renderAdminEmail = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading email…</p>';
    const log = P.get('email_log', []);
    const templates = P.emailTemplates || {
      welcome: { subject: 'Welcome', body: 'Welcome to Upper Room DFW' },
      contact_auto_reply: { subject: 'We received your message', body: 'Thanks for contacting us.' },
    };
    let smtpBanner = '';
    let campaigns = [];
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const [statusRes, campRes] = await Promise.all([
          fetch('/api/integrations/status', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/admin/campaigns', { headers: { Authorization: 'Bearer ' + token } }),
        ]);
        if (statusRes.ok) {
          const j = await statusRes.json();
          const smtp = (j.results || []).find((x) => x.provider === 'smtp');
          const acumba = (j.results || []).find((x) => x.provider === 'acumbamail');
          if (smtp?.ok) {
            smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"><i class="fa-solid fa-circle-check mr-1"></i> SMTP connected (${P.esc(smtp.host || smtp.message || 'relay')})</div>`;
          } else if (acumba?.smtpActivationRequired || (smtp?.error || '').includes('535')) {
            smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900"><strong>SMTP not fully active.</strong> Contact email provider support to enable transactional relay, then send a test.</div>`;
          } else if (smtp?.error) {
            smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">SMTP: ${P.esc(smtp.error)}</div>`;
          } else {
            smtpBanner = `<div class="mb-4 p-3 rounded-2xl bg-slate-50 border text-sm text-slate-600">SMTP status unknown — try a connection test below.</div>`;
          }
        }
        if (campRes.ok) {
          const cj = await campRes.json();
          campaigns = cj.campaigns || [];
        }
      } catch { /* ignore */ }
    }
    el.innerHTML = `
      ${smtpBanner}
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-2">Email Templates</h3>
          <p class="text-xs text-slate-500 mb-3">${campaigns.length ? campaigns.length + ' live campaigns on event bus' : 'Template previews (server sends branded HTML)'}</p>
          <div class="space-y-3 text-sm max-h-80 overflow-auto">${Object.entries(templates).map(([k, t]) => `
            <div class="border rounded-2xl p-3">
              <div class="font-medium text-xs uppercase text-sky-600">${P.esc(k)}</div>
              <div class="text-xs mt-1"><strong>Subject:</strong> ${P.esc(t.subject)}</div>
              <div class="text-xs text-slate-500 mt-1">${P.esc(t.body)}</div>
            </div>`).join('')}
          </div>
          ${campaigns.length ? `<div class="mt-4 text-xs space-y-1"><h4 class="font-semibold text-sm mb-1">Campaigns</h4>${campaigns.slice(0, 12).map((c) => `<div class="py-0.5 border-b">${P.esc(c.id || c.name || c.event || JSON.stringify(c))}</div>`).join('')}</div>` : ''}
        </div>
        <div class="bg-white border rounded-3xl p-5">
          <h3 class="font-semibold mb-3">Send Test Email</h3>
          <form id="admin-test-email" class="space-y-2 text-sm">
            <select name="template" class="w-full border rounded px-3 py-2">
              <option value="smtp_ping">smtp_ping (connection test)</option>
              ${Object.keys(templates).map((k) => `<option value="${P.esc(k)}">${P.esc(k)}</option>`).join('')}
            </select>
            <input name="email" type="email" required placeholder="recipient@email.com" class="w-full border rounded px-3 py-2">
            <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-2xl text-sm">Send Test via SMTP</button>
          </form>
          <h4 class="font-semibold text-sm mt-6 mb-2">Local Email Log (${log.length})</h4>
          <div class="text-xs max-h-48 overflow-auto">${log.slice(0, 20).map((e) => `<div class="py-1 border-b">${P.esc(e.template)}: ${P.esc(e.subject)} → ${P.esc(e.to)}</div>`).join('') || 'Empty (server sends do not appear here).'}</div>
        </div>
      </div>`;

    el.querySelector('#admin-test-email').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = String(fd.get('email') || '').trim();
      if (!email) { P.portalToast?.('Recipient email required'); return; }
      const btn = e.target.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      try {
        if (P.apiConfig?.mode === 'remote') {
          const r = await fetch('/api/admin/test-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ email, template: fd.get('template') }),
          });
          const j = await r.json();
          P.portalToast?.(j.ok ? 'Test email sent to ' + email : (j.error || 'Send failed'));
        } else {
          P.sendEmail?.(fd.get('template'), { email, name: 'Admin Test' });
          P.portalToast?.('Email logged (local mode).');
        }
        P.renderAdminEmail(el);
      } catch (err) {
        P.portalToast?.(err.message || 'Send failed');
        if (btn) { btn.disabled = false; btn.textContent = 'Send Test via SMTP'; }
      }
    };
  };

  P.renderAdminSeo = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading control panel…</div>';
    if (P.apiConfig?.mode === 'remote') {
      try {
        const token = localStorage.getItem('urdfw_api_token');
        const settingsRes = await fetch('/api/platform/site-settings', { headers: { Authorization: 'Bearer ' + token } });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          P.set('site_settings', data.settings || P.get('site_settings', {}));
        }
      } catch { /* use local */ }
    }
    if (P.renderAdminSeoControlPanel) {
      return P.renderAdminSeoControlPanel(el);
    }
    el.innerHTML = '<div class="text-sm text-red-600 p-4">Control panel module not loaded. Ensure js/platform/25-control-panel.js is in the loader.</div>';
  };

  P.renderAdminIntegrations = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading platform integrations from server…</div>';
    const providers = P.INTEGRATION_PROVIDERS || ['mailchimp', 'vbout', 'acumbamail'];
    let subs = P.get('subscribers', []);
    const apiBase = P.apiConfig?.endpoints?.integrations || '/api/integrations';
    let log = P.getIntegrationLog?.(null, 12) || [];
    let connections = null;
    let platformData = null;
    if (P.apiConfig?.mode === 'remote') {
      try {
        const token = localStorage.getItem('urdfw_api_token');
        const [connRes, logRes, platRes, integRes] = await Promise.all([
          fetch('/api/platform/connections', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/integrations/log', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/platform/integrations', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/integrations', { headers: { Authorization: 'Bearer ' + token } }),
        ]);
        if (connRes.ok) connections = await connRes.json();
        if (logRes.ok) {
          const lj = await logRes.json();
          log = (lj.entries || []).map((e) => ({ action: e.action, provider: e.provider, status: e.status, email: e.email, at: e.at }));
        }
        if (platRes.ok) {
          platformData = await platRes.json();
          P.applyPlatformIntegrations?.(platformData);
        }
        if (integRes.ok) {
          const ij = await integRes.json();
          if (ij.subscriberEmails) {
            subs = ij.subscriberEmails;
            P.set('subscribers', subs);
          }
        }
      } catch { /* ignore */ }
    }
    const stats = P.getIntegrationStats?.() || providers.map((p) => ({ provider: p, syncedCount: 0, enabled: true }));

    const connCards = connections?.results ? `
      <div class="grid md:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
        ${connections.results.map((r) => `
          <div class="rounded-xl px-3 py-2 text-xs border ${r.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}">
            <i class="fa-solid ${r.ok ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1"></i>
            <strong class="capitalize">${r.provider}</strong>
            <div class="text-[10px] mt-0.5 truncate">${r.ok ? (r.message || 'Connected') : (r.error || 'Not configured')}</div>
          </div>`).join('')}
      </div>` : '';

    const envBanner = platformData?.source === 'env' ? `
      <div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong><i class="fa-solid fa-server mr-1"></i> Platform credentials loaded from server .env</strong>
        <div class="text-xs mt-1 text-emerald-800">Admin accounts use production API keys automatically. Members configure their own keys in Profile → My API Integrations.</div>
      </div>` : '';

    el.innerHTML = `
      ${envBanner}
      ${connCards}
      <div class="portal-panel mb-4 text-xs text-slate-600">
        <strong>Integrations API:</strong> <code class="bg-slate-100 px-2 py-0.5 rounded">${apiBase}</code>
        <span class="ml-2">Admin keys: <code>server .env</code> · Members: <code>/api/client/integrations</code></span>
      </div>
      <div class="grid lg:grid-cols-3 gap-4 mb-6">
        ${stats.map((s) => {
          const cfg = (typeof P.getIntegrationConfig === 'function' ? P.getIntegrationConfig(s.provider) : null) || {};
          const keyLabel = cfg.source === 'env'
            ? (cfg.apiKeySet || cfg.apiKey ? `API key: ${cfg.apiKey || 'configured'}` : 'API key not in .env')
            : (cfg.apiKeySet || cfg.apiKey ? 'API key set' : 'No API key');
          return `<div class="portal-panel" data-provider-card="${P.esc(s.provider)}">
            <div class="flex items-center justify-between mb-3">
              <div class="font-semibold capitalize flex items-center gap-2">
                <i class="fa-solid fa-plug text-sky-600"></i> ${P.esc(s.provider)}
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${cfg.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${cfg.enabled ? 'Enabled' : 'Off'}</span>
            </div>
            <div class="text-2xl font-bold text-[#0369a1]">${s.syncedCount ?? 0}</div>
            <div class="text-xs text-slate-500 mb-3">synced contacts · list <code>${P.esc(cfg.listId || '—')}</code></div>
            <div class="text-[10px] text-slate-500 mb-2 font-mono">${P.esc(keyLabel)}</div>
            <form class="admin-int-config space-y-2 text-xs mb-3" data-provider="${P.esc(s.provider)}">
              <input name="listId" value="${P.esc(cfg.listId || '')}" placeholder="List ID" class="w-full border rounded-lg px-2 py-1.5">
              <input name="apiKey" type="text" value="${cfg.source === 'env' ? P.esc(cfg.apiKey || 'from .env') : ''}" placeholder="API key (admin: from .env)" class="w-full border rounded-lg px-2 py-1.5 bg-slate-50" readonly>
              <label class="flex items-center gap-2"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Enabled</label>
              <button type="submit" class="w-full py-1.5 border rounded-lg hover:bg-slate-50">Save list settings</button>
            </form>
            <div class="flex flex-wrap gap-1">
              <button type="button" data-test="${P.esc(s.provider)}" class="admin-int-test px-2 py-1 text-[11px] border rounded-lg">Test</button>
              <button type="button" data-sync="${P.esc(s.provider)}" class="admin-sync-btn px-2 py-1 text-[11px] border rounded-lg bg-[#0369a1] text-white">Sync All</button>
            </div>
            <div class="mt-2 text-[10px] text-slate-400 admin-int-status" data-status="${P.esc(s.provider)}"></div>
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
        try {
          const res = await P.api.integrations.configure(provider, {
            listId: fd.get('listId'),
            enabled: fd.get('enabled') === 'on',
          });
          P.portalToast?.(res?.ok !== false ? `${provider} config saved` : 'Config save failed');
          P.renderAdminIntegrations(el);
        } catch (err) {
          P.portalToast?.(err.message || 'Config save failed');
        }
      };
    });

    el.querySelectorAll('.admin-int-test').forEach((b) => {
      b.onclick = async () => {
        const provider = b.dataset.test;
        const statusEl = el.querySelector(`[data-status="${provider}"]`);
        if (statusEl) statusEl.textContent = 'Testing connection…';
        try {
          const res = await P.api.integrations.test(provider);
          if (statusEl) {
            statusEl.textContent = res?.ok
              ? `✓ ${res.message || 'OK'} (${res.latencyMs || '?'}ms)`
              : `✗ ${res?.error || 'Test failed'}`;
            statusEl.className = 'mt-2 text-[10px] ' + (res?.ok ? 'text-emerald-600' : 'text-red-600') + ' admin-int-status';
          }
          P.portalToast?.(res?.ok ? provider + ' OK' : (res?.error || 'Test failed'));
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = '✗ ' + (err.message || 'Test failed');
            statusEl.className = 'mt-2 text-[10px] text-red-600 admin-int-status';
          }
          P.portalToast?.(err.message || 'Test failed');
        }
      };
    });

    el.querySelectorAll('.admin-sync-btn').forEach((b) => {
      b.onclick = async () => {
        const provider = b.dataset.sync;
        const statusEl = el.querySelector(`[data-status="${provider}"]`);
        if (statusEl) statusEl.textContent = 'Syncing via API…';
        try {
          const res = await P.api.integrations.syncAll(provider);
          if (statusEl) {
            statusEl.textContent = res?.ok
              ? `Synced ${res.synced || 0} subscriber(s) to ${provider}`
              : `✗ ${res?.error || 'Sync failed'}`;
          }
          P.portalToast?.(res?.ok ? `Synced ${res.synced || 0} contacts to ${provider}` : (res?.error || 'Sync failed'));
          if (res?.ok) P.renderAdminIntegrations(el);
        } catch (err) {
          if (statusEl) statusEl.textContent = '✗ ' + (err.message || 'Sync failed');
          P.portalToast?.(err.message || 'Sync failed');
        }
      };
    });

    el.querySelector('#admin-int-subscribe')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(e.target).get('email');
      try {
        const res = await P.api.integrations.subscribe(email);
        P.portalToast?.(res?.ok ? `Subscribed ${email}` : (res?.error || 'Subscribe failed'));
        e.target.reset();
        if (res?.ok) P.renderAdminIntegrations(el);
      } catch (err) {
        P.portalToast?.(err.message || 'Subscribe failed');
      }
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
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        flat = await P.api.reviews.listAll();
        if (!Array.isArray(flat)) flat = [];
      } catch (e) {
        el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">Could not load reviews: ${P.esc(e.message)}</div>`;
        return;
      }
    }
    if (!flat.length) {
      const reviews = P.get('reviews', {});
      flat = Object.entries(reviews).flatMap(([lid, revs]) => (revs || []).map((r) => ({ ...r, listingId: lid })));
    }
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-1">Reviews (${flat.length})</h3>
        <p class="text-xs text-slate-500 mb-3">Hide or remove moderated content</p>
        <div class="space-y-2 text-sm max-h-[480px] overflow-auto">${flat.length ? flat.map((r) => `
          <div class="border rounded-2xl p-3 flex flex-wrap justify-between gap-2">
            <div>
              <div class="text-xs text-slate-500">Listing ${P.esc(r.listingId || r.listing_id || '—')} · ${P.esc(r.status || 'published')}</div>
              <div class="mt-1">${P.renderStars?.(r.stars) || (r.stars || 0) + '★'} <strong>${P.esc(r.author || 'Anonymous')}</strong></div>
              <div class="text-xs text-slate-600 mt-1">${P.esc(r.text || '')}</div>
            </div>
            ${r.id ? `<div class="flex gap-2 text-xs shrink-0">
              <button type="button" data-rid="${P.esc(r.id)}" data-status="hidden" class="admin-rev-act text-amber-700">Hide</button>
              <button type="button" data-rid="${P.esc(r.id)}" data-status="published" class="admin-rev-act text-emerald-700">Publish</button>
              <button type="button" data-rid="${P.esc(r.id)}" data-status="removed" class="admin-rev-act text-red-600">Remove</button>
            </div>` : ''}
          </div>`).join('') : '<p class="text-slate-500">No reviews yet.</p>'}
      </div>`;

    el.querySelectorAll('.admin-rev-act').forEach((b) => b.onclick = async () => {
      try {
        const r = await fetch('/api/admin/reviews/' + encodeURIComponent(b.dataset.rid), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ status: b.dataset.status }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) throw new Error(j.error || 'Update failed');
        P.portalToast?.(b.dataset.status === 'removed' ? 'Review removed' : 'Review ' + b.dataset.status);
        P.renderAdminReviews(el);
      } catch (e) {
        P.portalToast?.(e.message || 'Review update failed');
      }
    });
  };

  P.renderAdminSupport = async function (el) {
    el.innerHTML = '<p class="text-sm text-slate-500 py-6">Loading support tickets…</p>';
    let tickets = P.get('support_tickets', []);
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const res = await fetch('/api/support', { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) { tickets = await res.json(); P.set('support_tickets', tickets); }
        else throw new Error('Support API ' + res.status);
      } catch (e) {
        el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">Could not load tickets: ${P.esc(e.message)}</div>`;
        return;
      }
    }
    if (!Array.isArray(tickets)) tickets = [];
    const open = tickets.filter((t) => t.status === 'open' || !t.status).length;
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5">
        <h3 class="font-semibold mb-1">Support Tickets (${tickets.length})</h3>
        <p class="text-xs text-slate-500 mb-3">${open} open</p>
        <div class="space-y-2 text-sm">${tickets.length ? tickets.map((t) => `
          <div class="border rounded-2xl p-3 flex flex-wrap justify-between gap-2">
            <div>
              <strong>${P.esc(t.name || t.email || 'Visitor')}</strong>
              <span class="text-slate-500"> — ${P.esc(t.topic || 'General')}</span>
              <span class="text-[10px] ml-2 px-2 py-0.5 rounded ${t.status === 'closed' ? 'bg-slate-100' : 'bg-emerald-100 text-emerald-800'}">${P.esc(t.status || 'open')}</span>
              <div class="text-xs text-slate-500 mt-1">${P.esc(t.message || '')}</div>
              ${t.email ? `<div class="text-[11px] text-slate-400 mt-1">${P.esc(t.email)}</div>` : ''}
            </div>
            ${t.status !== 'closed' ? `<button type="button" data-ticket="${P.esc(t.id)}" class="admin-close-ticket text-xs text-emerald-700 shrink-0 font-medium">Close</button>` : ''}
          </div>`).join('') : '<p class="text-slate-500">No tickets.</p>'}
      </div>`;

    el.querySelectorAll('.admin-close-ticket').forEach((b) => b.onclick = async () => {
      const id = b.dataset.ticket;
      try {
        if (P.apiConfig?.mode === 'remote') {
          const r = await fetch('/api/support/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ status: 'closed' }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Close failed');
          }
        } else {
          const list = P.get('support_tickets', []);
          const t = list.find((x) => x.id === id);
          if (t) { t.status = 'closed'; P.set('support_tickets', list); }
        }
        P.portalToast?.('Ticket closed');
        P.renderAdminSupport(el);
        P.renderAdminQuickStats?.();
      } catch (e) {
        P.portalToast?.(e.message || 'Could not close ticket');
      }
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
    const onProd = typeof window !== 'undefined' && /upperroomdfw\.com|amplifyapp\.com|cloudfront\.net/i.test(window.location.hostname || '');
    let hooks = P.get('webhooks', []) || [];
    let hookLog = P.get('webhook_log', []) || [];
    let eventLog = [];
    let platform = null;
    let health = null;
    const token = localStorage.getItem('urdfw_api_token');
    if (P.apiConfig?.mode === 'remote' && token) {
      try {
        const [hookList, wlog, elog, plat, hlth] = await Promise.all([
          P.api.webhooks.list().catch(() => []),
          P.api.webhooks.log().catch(() => []),
          P.api.webhooks.eventsLog().catch(() => []),
          fetch('/api/platform/integrations', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.ok ? r.json() : null),
          fetch('/api/health').then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);
        hooks = Array.isArray(hookList) ? hookList : (hookList?.webhooks || []);
        hookLog = Array.isArray(wlog) ? wlog : (wlog?.entries || []);
        eventLog = Array.isArray(elog) ? elog : (elog?.entries || []);
        platform = plat;
        health = hlth;
        P.set('webhooks', hooks);
      } catch (e) {
        console.warn('[URDFW] API panel load', e);
      }
    }
    const platformRows = platform?.platform ? Object.entries(platform.platform).map(([k, v]) => {
      const on = v && (v.enabled === true || (v.enabled === undefined && v.host));
      return `<div class="flex justify-between py-1 border-b text-xs"><span class="capitalize">${P.esc(k)}</span><span class="${on ? 'text-emerald-600' : 'text-slate-400'}">${on ? 'env ✓' : 'off'}</span></div>`;
    }).join('') : '';
    const envReady = health?.envReady ? Object.entries(health.envReady).map(([k, v]) =>
      `<span class="inline-flex items-center gap-1 mr-2 text-[10px] px-2 py-0.5 rounded-full ${v ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}">${P.esc(k)}: ${v === true ? 'on' : v === false ? 'off' : P.esc(String(v))}</span>`
    ).join('') : '';
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="portal-panel">
          <h3 class="font-semibold mb-3">API Connection</h3>
          <p class="text-xs text-slate-500 mb-4">${onProd ? 'Production is locked to remote API — credentials load from server .env.' : 'Local mode uses browser storage. Switch to remote when your backend is ready.'}</p>
          ${onProd || st.mode === 'remote' ? `<div class="text-sm mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800"><i class="fa-solid fa-link mr-1"></i> Mode: <strong>${P.esc(st.mode)}</strong> → ${P.esc(st.endpoints?.base || location.origin)}${health?.ok ? ' · health OK' : ''}</div>` : `
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
              <input name="base" value="${P.esc(st.endpoints?.base || '')}" placeholder="https://api.yourdomain.com" class="w-full border rounded-xl px-3 py-2 text-sm">
            </div>
            <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl text-sm">Save API Config</button>
          </form>`}
          ${envReady ? `<div class="mt-3 mb-2">${envReady}</div>` : ''}
          ${platformRows ? `<div class="mt-4"><h4 class="text-xs font-semibold mb-2">Platform .env services</h4>${platformRows}</div>` : ''}
          <div class="mt-4 text-xs space-y-1">
            <div><strong>Auth:</strong> ${P.esc(st.endpoints?.auth || '/api/auth')}</div>
            <div><strong>Billing:</strong> ${P.esc(st.endpoints?.billing || '/api/billing')}</div>
            <div><strong>Listings:</strong> ${P.esc(st.endpoints?.listings || '/api/listings')}</div>
            <div><strong>Integrations:</strong> ${P.esc(st.endpoints?.integrations || '/api/integrations')}</div>
          </div>
        </div>
        <div class="portal-panel">
          <h3 class="font-semibold mb-3">Webhooks</h3>
          <form id="admin-webhook-form" class="flex gap-2 text-xs mb-4">
            <input name="url" type="url" placeholder="https://hooks.example.com/urdfw" class="flex-1 border rounded-xl px-3 py-2" required>
            <button type="submit" class="px-3 py-2 bg-slate-800 text-white rounded-xl">Add</button>
          </form>
          <div class="text-xs space-y-2 max-h-36 overflow-auto mb-4">${hooks.length ? hooks.map((h) => `<div class="py-1 border-b font-mono flex justify-between gap-2 items-center">
            <span class="truncate">${P.esc(h.url)}</span>
            <span class="shrink-0 flex gap-2 items-center">
              ${h.active === false ? '<span class="text-red-500">off</span>' : '<span class="text-emerald-600">on</span>'}
              ${h.id ? `<button type="button" data-hook-del="${P.esc(h.id)}" class="text-red-600 hover:underline">Remove</button>` : ''}
            </span>
          </div>`).join('') : '<span class="text-slate-500">No webhooks registered.</span>'}</div>
          <h4 class="font-semibold text-xs mb-2">Recent API Calls</h4>
          <div class="text-[11px] space-y-1 max-h-32 overflow-auto font-mono">${(st.recentCalls || []).map((c) => `<div class="py-1 border-b">${P.esc(c.name)} • ${P.esc(c.source)} • ${c.ms}ms</div>`).join('') || 'No calls yet.'}</div>
          <h4 class="font-semibold text-xs mt-4 mb-2">Webhook Delivery Log</h4>
          <div class="text-[11px] max-h-24 overflow-auto">${hookLog.slice(0, 12).map((l) => `<div class="py-0.5">${P.esc(l.event || l.action || l.event_type || 'event')} → ${P.esc(l.url || l.target || l.webhook_url || '')} <span class="text-slate-400">${P.esc(l.status || l.http_status || '')}</span></div>`).join('') || 'Empty.'}</div>
          <h4 class="font-semibold text-xs mt-4 mb-2">Platform Events</h4>
          <div class="text-[11px] max-h-24 overflow-auto">${eventLog.slice(0, 12).map((e) => `<div class="py-0.5">${P.esc(e.type || e.event || e.name || 'event')} — ${P.esc(e.at || e.created_at || '')}</div>`).join('') || 'No events yet.'}</div>
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
      try {
        await P.api.webhooks.register(url, ['payment.completed', 'user.registered', 'lead.created', 'support.created']);
        P.portalToast?.('Webhook registered.');
        e.target.reset();
        P.renderAdminApi(el);
      } catch (err) {
        P.portalToast?.(err.message || 'Webhook register failed');
      }
    });

    el.querySelectorAll('[data-hook-del]').forEach((b) => b.onclick = async () => {
      try {
        await P.api.webhooks.remove(b.dataset.hookDel);
        P.portalToast?.('Webhook removed');
        P.renderAdminApi(el);
      } catch (err) {
        P.portalToast?.(err.message || 'Remove failed');
      }
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