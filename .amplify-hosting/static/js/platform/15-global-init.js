/**
 * Global platform init — nav tools, seed data, church page enhancer, geolocation
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.seedDemoData = function () {
    if (localStorage.getItem('urdfw_seeded_v2')) return;
    const meta = {};
    [1, 2, 5, 11, 15, 22].forEach((id, i) => {
      meta[id] = {
        rating: 4.2 + (i * 0.1), reviewCount: 3 + i,
        featured: i % 2 === 0, sticky: id === 22, vip: id === 5,
        level: id === 22 ? 'premium' : id === 5 ? 'vip' : 'standard',
      };
    });
    P.set('listing_meta', meta);

    const reviews = {};
    reviews[1] = [{
      id: 'rev-1', author: 'Sarah M.', stars: 5, text: 'Wonderful community and youth programs!',
      criteria: { worship: 5, community: 5, teaching: 4, facilities: 5 }, upvotes: 3,
      createdAt: new Date().toISOString(),
    }];
    P.set('reviews', reviews);

    P.set('coupons', [
      { code: 'DFW10', discount: 10, type: 'percent', limit: 100, used: 0, expires: '2027-12-31' },
      { code: 'CHURCH50', discount: 50, type: 'fixed', limit: 50, used: 0, expires: '2026-12-31' },
    ]);

    localStorage.setItem('urdfw_seeded_v2', 'true');
  };

  /** Dev-only pages — never show the link bar on the public church directory */
  P.isDevPage = function () {
    const path = (location.pathname || '').toLowerCase();
    return path.includes('feature-checklist') || path.includes('admin.html');
  };

  P.injectGlobalToolbar = function () {
    if (!P.isDevPage()) return;
    if (document.getElementById('urdfw-global-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'urdfw-global-toolbar';
    bar.className = 'bg-slate-800 text-slate-200 text-[11px] py-1 px-4 flex flex-wrap gap-x-3 gap-y-1 items-center justify-center';
    bar.innerHTML = `
      <span class="font-semibold text-sky-300">Platform</span>
      <a href="directory.html" class="hover:text-white">Directory</a>
      <a href="submit-listing.html" class="hover:text-white">Submit</a>
      <a href="claim-listing.html?id=1" class="hover:text-white">Claim</a>
      <a href="widgets.html" class="hover:text-white">Widgets</a>
      <a href="shortcode-builder.html" class="hover:text-white">Shortcodes</a>
      <a href="field-builder.html" class="hover:text-white">Fields</a>
      <a href="form-builder.html" class="hover:text-white">Forms</a>
      <a href="page-builder.html" class="hover:text-white">Page Builder</a>
      <a href="templates.html" class="hover:text-white">Templates</a>
      <a href="signup.html" class="hover:text-white">Sign Up</a>
      <a href="billing-hub.html" class="hover:text-white">Billing</a>
      <a href="csv-import.html" class="hover:text-white">CSV</a>
      <a href="collections.html" class="hover:text-white">Collections</a>
      <a href="user-directory.html" class="hover:text-white">Users</a>
      <a href="messages.html" class="hover:text-white">Messages</a>
      <a href="support.html" class="hover:text-white">Support</a>
      <a href="feature-checklist.html" class="hover:text-sky-300 font-semibold">Features ✓</a>
      <select id="urdfw-global-lang" class="bg-slate-700 border-0 rounded px-1 py-0.5 text-[11px] ml-2">
        <option value="en">EN</option><option value="es">ES</option><option value="ar">AR</option>
      </select>`;
    document.body.prepend(bar);
    const sel = document.getElementById('urdfw-global-lang');
    if (sel) {
      sel.value = P.lang || 'en';
      sel.onchange = () => P.setLanguage(sel.value);
    }
  };

  P.useGeolocation = function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      P.searchState.centerLat = pos.coords.latitude;
      P.searchState.centerLng = pos.coords.longitude;
      P.emit('search:change', P.searchState);
    });
  };

  P.enhanceChurchPage = async function () {
    const path = location.pathname;
    if (!path.includes('churches/') && !path.includes('churches\\')) return;
    const slug = path.split('/').pop().replace('.html', '');
    if (!slug || slug === 'index') return;

    let church = null;
    try {
      const res = await fetch(path.includes('../') ? '../data/churches.json' : 'data/churches.json');
      const list = await res.json();
      church = list.find((c) => c.slug === slug);
    } catch {
      try {
        const res = await fetch('../data/churches.json');
        church = (await res.json()).find((c) => c.slug === slug);
      } catch { /* ignore */ }
    }
    if (!church) return;

    church = P.enhanceListing(church);
    const seo = P.autoGenerateSEO(church);
    P.applySEO(seo);

    let panel = document.getElementById('urdfw-church-platform');
    const anchor = document.getElementById('similar-churches')?.closest('.mt-12')
      || document.querySelector('.max-w-4xl');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'urdfw-church-platform';
      panel.className = 'max-w-4xl mx-auto px-6 mt-10 pt-8 border-t space-y-6';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      else document.body.appendChild(panel);
    }

    const badges = [
      church.featured ? '<span class="badge-featured">Featured</span>' : '',
      church.sticky ? '<span class="badge-sticky">Sticky</span>' : '',
      church.vip ? '<span class="badge-vip">VIP</span>' : '',
    ].filter(Boolean).join(' ');

    const prefix = path.includes('churches/') ? '../' : '';
    panel.innerHTML = `
      <h2 class="text-2xl font-semibold tracking-tight">Community Reviews &amp; Engagement</h2>
      <div class="flex flex-wrap gap-2 items-center">${badges} ${P.renderStars(church.rating || 4.5)} <span class="text-sm text-slate-500">(${church.reviewCount || 0} reviews)</span></div>
      <div class="flex flex-wrap gap-2 text-sm">
        <button onclick="URDFWPlatform.toggleBookmark('listings',${church.id},{name:'${church.name.replace(/'/g, '')}'})" class="px-3 py-1.5 border rounded-2xl hover:bg-slate-50"><i class="fa-regular fa-bookmark"></i> Save</button>
        <button id="urdfw-print-btn" class="px-3 py-1.5 border rounded-2xl hover:bg-slate-50">Print / PDF</button>
        <a href="${prefix}claim-listing.html?id=${church.id}&slug=${church.slug}" class="px-3 py-1.5 border rounded-2xl hover:bg-slate-50 text-sky-700">Claim this listing</a>
      </div>
      <div id="urdfw-church-reviews"></div>
      <div id="urdfw-church-comments" class="text-sm"></div>
      <div id="urdfw-church-contact"></div>
      <div id="urdfw-church-media" class="text-sm"></div>`;

    P.renderReviewForm(document.getElementById('urdfw-church-reviews'), church.id);
    P.renderContactForm(document.getElementById('urdfw-church-contact'), church);

    const commentsEl = document.getElementById('urdfw-church-comments');
    const comments = P.getComments(church.id);
    commentsEl.innerHTML = `<div class="font-semibold mb-2">Comments (${comments.length})</div>
      ${comments.map((c) => `<div class="border-b py-2"><strong>${c.author}</strong>: ${c.text}</div>`).join('')}
      <form id="add-comment" class="mt-2 flex gap-2"><input name="author" placeholder="Name" class="border rounded px-2 py-1 text-sm">
      <input name="text" placeholder="Comment..." class="flex-1 border rounded px-2 py-1 text-sm"><button class="px-3 py-1 bg-[#0369a1] text-white rounded text-sm">Post</button></form>`;
    commentsEl.querySelector('#add-comment').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      P.addComment(church.id, fd.get('text'), fd.get('author'));
      P.enhanceChurchPage();
    };

    const reviews = P.getReviews(church.id);
    const revList = document.createElement('div');
    revList.className = 'mt-4 space-y-2 text-sm';
    revList.innerHTML = reviews.map((r) => `
      <div class="border rounded p-3">
        ${P.renderStars(r.stars)} <strong>${r.author}</strong>
        <p class="mt-1">${r.text}</p>
        <div class="mt-1 flex gap-2 text-xs">
          ${['thumbs-up','heart','star','check','fire'].map((ic) =>
            `<button onclick="URDFWPlatform.upvoteReview('${church.id}','${r.id}','${ic}')" class="urdfw-upvote"><i class="fa-solid fa-${ic === 'thumbs-up' ? 'thumbs-up' : ic === 'check' ? 'check' : ic}"></i></button>`).join('')}
          <span>${r.upvotes || 0} upvotes</span>
          <button onclick="URDFWPlatform.toggleBookmark('reviews','${r.id}',{})" class="underline">Save review</button>
        </div>
      </div>`).join('');
    document.getElementById('urdfw-church-reviews').prepend(revList);

    if (church.website) {
      document.getElementById('urdfw-church-media').innerHTML =
        (P.embedMedia(church.customFields?.youtube) || '') +
        `<img src="${P.faviconFromUrl(church.website)}" class="w-8 h-8 inline rounded" alt="favicon">`;
    }

    const printBtn = document.getElementById('urdfw-print-btn');
    if (printBtn) printBtn.onclick = () => P.printListing(church);

    P.on('reviews:refresh', () => P.enhanceChurchPage());
  };

  P.injectPoweredByFooter = function () {
    if (document.querySelector('.urdfw-powered-by, .urdfw-powered-by-footer')) return;
    const html =
      'Powered By <a href="https://tsbrenterprises.com" class="hover:text-white underline" target="_blank" rel="noopener noreferrer">The Stone Builders Rejected</a> Michael K';
    const footer = document.querySelector('footer');
    if (footer) {
      const div = document.createElement('div');
      div.className =
        'text-center text-xs py-3 text-slate-500 border-t border-white/10 urdfw-powered-by';
      div.innerHTML = html;
      footer.appendChild(div);
      return;
    }
    const el = document.createElement('footer');
    el.className =
      'bg-slate-900 text-slate-400 text-xs text-center py-4 urdfw-powered-by-footer';
    el.innerHTML = '<div class="urdfw-powered-by">' + html + '</div>';
    document.body.appendChild(el);
  };

  P.initGlobal = function () {
    P.seedDemoData();
    P.injectGlobalToolbar();
    P.injectPoweredByFooter();
    P.useGeolocation();
    P.enhanceChurchPage();

    const params = new URLSearchParams(location.search);
    if (params.get('lang')) P.setLanguage(params.get('lang'));
  };

  P.on('core:ready', P.initGlobal);
})(window);