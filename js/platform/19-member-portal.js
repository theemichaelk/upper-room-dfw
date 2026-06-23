/**
 * Member portal shell — sidebar navigation, quick stats, extended tabs
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.memberTabs = [
    { id: 'overview', label: 'Overview', icon: 'gauge' },
    { id: 'listing', label: 'My Listing', icon: 'church' },
    { id: 'leads', label: 'Leads & CRM', icon: 'envelope-open-text' },
    { id: 'billing', label: 'Billing', icon: 'credit-card' },
    { id: 'training', label: 'Training', icon: 'graduation-cap' },
    { id: 'profile', label: 'Profile', icon: 'user-gear' },
    { id: 'messages', label: 'Messages', icon: 'comments' },
    { id: 'media', label: 'Media & Export', icon: 'photo-film' },
    { id: 'saved', label: 'Saved', icon: 'bookmark' },
    { id: 'reviews', label: 'Reviews', icon: 'star' },
    { id: 'claims', label: 'Claims', icon: 'hand-holding' },
    { id: 'analytics', label: 'Analytics', icon: 'chart-line' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'support', label: 'Support', icon: 'life-ring' },
    { id: 'dns', label: 'DNS', icon: 'globe' },
  ];

  P._memberTabIndex = {
    overview: 0, billing: 1, training: 2, listing: 3, leads: 4,
    profile: 5, messages: 6, media: 7, saved: 8, support: 9,
    notifications: 10, reviews: 11, claims: 12, analytics: 13, dns: 14,
  };

  P._memberShellClientId = null;

  P.initMemberPortalShell = function (client) {
    if (!client) return;
    const sameClient = P._memberShellClientId === client.id;
    P._memberShellClientId = client.id;

    P.renderMemberQuickStats(client);
    P.renderApiStatusPanel?.('member-dash-api-status');

    if (sameClient) {
      const user = P.getMemberUser?.(client);
      P.renderMemberNotifications?.(document.getElementById('member-platform-notifications'), user);
      return;
    }

    const user = P.getMemberUser?.(client);
    P.renderMemberReviews?.(document.getElementById('member-platform-reviews'), client);
    P.renderMemberClaims?.(document.getElementById('member-platform-claims'), client);
    P.renderMemberAnalytics?.(document.getElementById('member-platform-analytics'), client);
    P.renderMemberNotifications?.(document.getElementById('member-platform-notifications'), user);
    P.initMemberDashboard?.(client);
  };

  P.renderMemberQuickStats = function (client) {
    const el = document.getElementById('member-quick-stats');
    if (!el || !client) return;
    const leads = (global.getRelevantLeadsCount?.(client)) ?? 0;
    const training = global.computeTrainingProgress?.(client.email || client.id) ?? 0;
    const plan = client.isPaid ? (client.package || 'Standard') : 'Trial';
    const listing = client.status === 'approved' || client.isPaid ? 'Live' : 'Pending';

    el.className = 'member-metrics';
    el.innerHTML = `
      <div class="member-metric"><div class="member-metric-label">Listing</div><div class="member-metric-value">${listing}</div></div>
      <div class="member-metric"><div class="member-metric-label">Leads</div><div class="member-metric-value">${leads}</div></div>
      <div class="member-metric"><div class="member-metric-label">Training</div><div class="member-metric-value">${training}%</div></div>
      <div class="member-metric"><div class="member-metric-label">Plan</div><div class="member-metric-value" style="font-size:1rem">${plan}</div></div>`;
  };

  P.renderMemberReviews = function (el, client) {
    if (!el) return;
    const listingId = client?.listingId || client?.id;
    const reviews = P.get('reviews', {})[listingId] || [];
    el.innerHTML = `
      <h3 class="font-semibold mb-3 flex items-center gap-2"><i class="fa-solid fa-star text-amber-500"></i> Reviews on Your Listing</h3>
      <p class="text-xs text-slate-500 mb-4">Multi-criteria reviews, star ratings, and upvotes from directory visitors.</p>
      <div class="space-y-3 mb-6 max-h-64 overflow-auto">${reviews.length ? reviews.map((r) => `
        <div class="border rounded-2xl p-3 text-sm">
          <div class="flex justify-between"><span class="font-medium">${r.author || 'Visitor'}</span>${P.renderStars?.(r.stars) || r.stars + '★'}</div>
          <p class="text-slate-600 mt-1 text-xs">${r.text || ''}</p>
          <div class="text-[10px] text-slate-400 mt-1">${r.criteria ? Object.entries(r.criteria).map(([k,v]) => k + ': ' + v).join(' • ') : ''}</div>
        </div>`).join('') : '<p class="text-sm text-slate-500">No reviews yet. Encourage visitors to leave feedback from your church page.</p>'}
      </div>
      <form id="member-demo-review" class="border rounded-2xl p-4 text-sm space-y-2 max-w-lg">
        <div class="font-medium text-xs">Respond / log a testimonial (demo)</div>
        <input name="author" placeholder="Member name" class="w-full border rounded-xl px-3 py-2 text-xs">
        <textarea name="text" rows="2" placeholder="Thank you message or testimonial..." class="w-full border rounded-xl px-3 py-2 text-xs"></textarea>
        <select name="stars" class="border rounded-xl px-3 py-2 text-xs"><option value="5">5 stars</option><option value="4">4 stars</option></select>
        <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl text-xs">Save Response</button>
      </form>`;

    el.querySelector('#member-demo-review')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (P.addReview) {
        P.addReview(listingId, {
          author: fd.get('author') || 'Church Member',
          text: fd.get('text'),
          stars: +fd.get('stars'),
          criteria: { welcome: 5, worship: 5, community: 5 },
        });
        P.portalToast?.('Review logged on your listing.');
        P.renderMemberReviews(el, client);
      }
    });
  };

  P.renderMemberClaims = function (el, client) {
    if (!el) return;
    const claims = P.get('claims', []).filter((c) => c.email === client?.email);
    el.innerHTML = `
      <h3 class="font-semibold mb-3"><i class="fa-solid fa-hand-holding text-sky-600 mr-2"></i>Listing Claims</h3>
      <p class="text-xs text-slate-500 mb-4">Claim an existing directory listing or submit ownership verification.</p>
      <form id="member-claim-form" class="grid md:grid-cols-2 gap-3 text-sm max-w-2xl mb-6">
        <input name="listingId" placeholder="Listing ID or church name" class="border rounded-xl px-3 py-2 text-sm" required>
        <select name="paid" class="border rounded-xl px-3 py-2 text-sm">
          <option value="free">Free claim</option>
          <option value="paid">Paid expedited claim ($19)</option>
        </select>
        <textarea name="proof" rows="2" placeholder="Proof of ownership (email domain, role...)" class="md:col-span-2 border rounded-xl px-3 py-2 text-sm"></textarea>
        <button type="submit" class="md:col-span-2 px-4 py-2 bg-[#0369a1] text-white rounded-xl text-sm w-fit">Submit Claim</button>
      </form>
      <h4 class="font-semibold text-sm mb-2">Your Claims (${claims.length})</h4>
      <div class="space-y-2 text-sm">${claims.length ? claims.map((c) => `
        <div class="border rounded-2xl p-3 flex justify-between">
          <span>Listing #${c.listingId} — <span class="text-xs px-2 py-0.5 rounded ${c.status === 'pending' ? 'bg-amber-100' : 'bg-emerald-100'}">${c.status}</span></span>
          <span class="text-xs text-slate-400">${new Date(c.at || Date.now()).toLocaleDateString()}</span>
        </div>`).join('') : '<p class="text-xs text-slate-500">No claims submitted. <a href="claim-listing.html" class="text-sky-700">Open claim wizard →</a></p>'}</div>
      <a href="claim-listing.html" class="inline-block mt-4 text-xs text-sky-700 font-medium">Full claim listing flow →</a>`;

    el.querySelector('#member-claim-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const paid = fd.get('paid') === 'paid';
      if (P.claimListing) {
        P.claimListing(fd.get('listingId'), {
          email: client.email,
          name: client.name,
          proof: fd.get('proof'),
        }, paid);
        if (paid && P.chargeForClaim) P.chargeForClaim(19, fd.get('listingId'), 'stripe');
        P.portalToast?.('Claim submitted — admin will review shortly.');
        P.renderMemberClaims(el, client);
      }
    });
  };

  P.renderMemberAnalytics = async function (el, client) {
    if (!el) return;
    el.innerHTML = '<div class="text-sm text-slate-500 py-6">Loading your analytics…</div>';
    const A = global.URDFWAnalytics;
    if (P.apiConfig?.mode === 'remote' && A?.fetchMember) {
      try {
        const data = await A.fetchMember();
        el.innerHTML = '<div id="member-analytics-root"></div>';
        A.renderMemberCharts(el.querySelector('#member-analytics-root'), data);
        const links = document.createElement('div');
        links.className = 'mt-4 flex flex-wrap gap-2 text-xs';
        const slug = data.listing?.slug;
        links.innerHTML = `
          <a href="directory.html" class="px-3 py-1.5 border rounded-lg">Directory</a>
          ${slug ? `<a href="churches/${slug}.html" class="px-3 py-1.5 bg-[#0369a1] text-white rounded-lg">View Live Listing</a>` : ''}`;
        el.appendChild(links);
        return;
      } catch { /* fallback */ }
    }
    const stats = P.getClickStats?.() || { total: 0, byType: {}, recent: [] };
    const leads = global.getRelevantLeadsCount?.(client) || 0;
    el.innerHTML = `
      <h3 class="font-semibold mb-4">Listing Analytics (local)</h3>
      <div class="grid md:grid-cols-4 gap-3 mb-6">
        <div class="portal-stat"><div class="portal-stat-label">Your Leads</div><div class="portal-stat-value">${leads}</div></div>
        <div class="portal-stat"><div class="portal-stat-label">Clicks</div><div class="portal-stat-value">${stats.total}</div></div>
      </div>`;
  };
})(window);