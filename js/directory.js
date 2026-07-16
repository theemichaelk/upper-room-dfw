// Upper Room DFW - Directory page: search, filters, map, exports, smart ranking

let churchesData = [];
let filteredData = [];
let map = null;
let markers = [];
let currentFilters = { search: '', area: '', category: '', sort: 'relevance' };

async function loadChurchesData() {
  try {
    const apiRes = await fetch('/api/listings');
    if (apiRes.ok) {
      const payload = await apiRes.json();
      churchesData = Array.isArray(payload) ? payload : (payload.listings || payload.data || []);
      if (churchesData.length) return churchesData;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch('data/churches.json');
    churchesData = await res.json();
  } catch (e) {
    console.warn('Using embedded fallback data for local file://');
    churchesData = [
      { id: 1, slug: 'the-grove-community-church', name: 'The Grove Community Church', area: 'Arlington', category: 'Church', address: '1425 S Collins St, Arlington, TX 76010', lat: 32.7357, lng: -97.1081, phone: '(817) 555-0192', email: 'hello@thegrovearlington.org', website: 'https://thegrovearlington.org', times: 'Sundays 9:00am & 11:00am', description: 'A vibrant, multi-generational church with powerful worship and deep community.', fullDescription: '', denomination: 'Non-denominational', size: 'Large', tags: ['Contemporary', 'Multi-ethnic', 'Youth', 'Family'], image: 'images/36.jpg' },
      { id: 2, slug: 'the-sanctuary-worship-center', name: 'The Sanctuary Worship Center', area: 'Dallas', category: 'Church', address: '3100 S Lancaster Rd, Dallas, TX 75216', lat: 32.7157, lng: -96.8089, phone: '(214) 555-8721', email: 'connect@sanctuarydfw.org', website: 'https://sanctuarydfw.org', times: 'Sundays 8:30am & 10:45am', description: 'Historic Dallas congregation focused on authentic worship and prayer.', fullDescription: '', denomination: 'Pentecostal', size: 'Medium', tags: ['Traditional', 'Prayer', 'Outreach'], image: 'images/37.jpg' },
      { id: 3, slug: 'united-faith-chapel', name: 'United Faith Chapel', area: 'Fort Worth', category: 'Church', address: '6100 W 7th St, Fort Worth, TX 76107', lat: 32.7555, lng: -97.3308, phone: '(682) 555-3310', email: 'info@unitedfaithfw.org', website: 'https://unitedfaithfw.org', times: 'Sundays 10:00am', description: 'A warm Fort Worth church with strong small groups and families.', fullDescription: '', denomination: 'Non-denominational', size: 'Medium', tags: ['Family', 'Small Groups', 'Contemporary'], image: 'images/38.jpg' },
      { id: 4, slug: 'hope-and-healing-ministry-center', name: 'Hope & Healing Ministry Center', area: 'Dallas', category: 'Ministry', address: '2500 McKinney Ave, Dallas, TX 75201', lat: 32.7925, lng: -96.8025, phone: '(214) 555-4400', email: 'care@hopeandhealingdfw.org', website: 'https://hopeandhealingdfw.org', times: 'Support groups Tue & Thu', description: 'Christian counseling, recovery programs, and support groups.', fullDescription: '', denomination: 'Interdenominational', size: 'Small', tags: ['Counseling', 'Recovery', 'Support'], image: 'images/4.jpg' }
    ];
  }
  return churchesData;
}

let baseChurchesData = [];

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listingTags(church) {
  return Array.isArray(church.tags) ? church.tags : [];
}

function listingSearchBlob(ch) {
  return [
    ch.name, ch.description, ch.fullDescription, ch.address, ch.area,
    ch.category, ch.denomination, ch.times, ch.phone, ch.website,
    listingTags(ch).join(' ')
  ].filter(Boolean).join(' ').toLowerCase();
}

/** Weighted keyword relevance for smarter ranking */
function scoreListing(ch, keywords) {
  if (!keywords.length) return 0;
  let score = 0;
  const matched = [];
  const name = String(ch.name || '').toLowerCase();
  const area = String(ch.area || '').toLowerCase();
  const category = String(ch.category || '').toLowerCase();
  const denom = String(ch.denomination || '').toLowerCase();
  const tags = listingTags(ch).map((t) => String(t).toLowerCase());
  const desc = String(ch.description || '').toLowerCase();
  const full = String(ch.fullDescription || '').toLowerCase();
  const address = String(ch.address || '').toLowerCase();

  keywords.forEach((kw) => {
    let hit = false;
    if (name === kw) { score += 12; hit = true; }
    else if (name.includes(kw)) { score += 8; hit = true; }
    if (area === kw || area.includes(kw)) { score += 6; hit = true; }
    if (category.includes(kw)) { score += 5; hit = true; }
    if (denom.includes(kw)) { score += 4; hit = true; }
    if (tags.some((t) => t === kw || t.includes(kw))) { score += 4; hit = true; }
    if (address.includes(kw)) { score += 3; hit = true; }
    if (desc.includes(kw)) { score += 2; hit = true; }
    if (full.includes(kw)) { score += 1; hit = true; }
    if (hit) matched.push(kw);
  });
  if (ch.featured) score += 1.5;
  if (ch.sticky) score += 2;
  if (ch.vip) score += 1;
  return { score, matched };
}

function populateAreaFilter(data) {
  const select = document.getElementById('area-filter');
  if (!select) return;
  const current = select.value;
  const areas = [...new Set(data.map((c) => c.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="">All cities</option>' +
    areas.map((a) => `<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('');
  if (current && areas.includes(current)) select.value = current;
}

function updateStatsUI(total, showing) {
  document.querySelectorAll('#total-listings').forEach((el) => { el.textContent = total; });
  const rc = document.getElementById('results-count');
  if (rc) rc.textContent = showing;
  const hero = document.getElementById('hero-listing-count');
  if (hero) hero.textContent = total + '+';
  const summary = document.getElementById('results-summary');
  if (summary) {
    if (showing === 0) summary.textContent = 'No matches — try another city or keyword';
    else if (showing === total) summary.textContent = 'All verified listings in this catalog';
    else summary.textContent = `Filtered · ${total - showing} hidden by your search`;
  }
  if (typeof window.refreshLiveDirectoryMetrics === 'function') {
    try { window.refreshLiveDirectoryMetrics(); } catch { /* ignore */ }
  }
}

function initMap() {
  const mapContainer = document.getElementById('directory-map');
  if (!mapContainer || typeof L === 'undefined') return;

  const P = window.URDFWPlatform;
  if (P && P.createMap) {
    map = P.createMap('directory-map', { center: [32.78, -96.9], zoom: 10 });
    if (map && P.addListingMarkers) markers = P.addListingMarkers(map, churchesData);
    if (P.initMapDraw) P.initMapDraw(map);
    setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    return;
  }

  map = L.map('directory-map', { zoomControl: true }).setView([32.78, -96.9], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', className: 'map-tiles'
  }).addTo(map);

  markers = churchesData.filter((c) => c.lat && c.lng).map((church) => {
    const marker = L.marker([church.lat, church.lng], { title: church.name }).addTo(map);
    marker.bindPopup(
      `<strong>${escHtml(church.name)}</strong><br>${escHtml(church.area || '')}<br>` +
      `<a href="churches/${escHtml(church.slug)}.html">View profile</a>`
    );
    marker.churchId = church.id;
    return marker;
  });
  setTimeout(() => { if (map) map.invalidateSize(); }, 150);
}

function reinitMap() {
  if (map) { map.remove(); map = null; markers = []; }
  initMap();
  updateMapForFilters(filteredData.map((c) => c.id));
}

function updateMapForFilters(filteredIds) {
  if (!map || !markers.length) return;
  const idSet = new Set(filteredIds);
  markers.forEach((marker) => {
    const isVisible = idSet.has(marker.churchId);
    if (isVisible) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
}

function highlightChurch(id) {
  const card = document.querySelector(`[data-church-id="${id}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.style.transition = 'all 0.2s';
  card.style.boxShadow = '0 0 0 4px #0ea5e9';
  setTimeout(() => {
    card.style.boxShadow = '';
  }, 1600);
}

function renderDirectoryGrid(data) {
  const container = document.getElementById('directory-grid');
  if (!container) return;
  container.innerHTML = '';

  updateStatsUI(churchesData.length, data.length);

  if (data.length === 0) {
    container.innerHTML = `
      <div class="dir-empty-state">
        <i class="fa-solid fa-map-location-dot text-4xl text-slate-300 mb-3"></i>
        <p class="text-lg font-semibold text-slate-700">No churches match those filters</p>
        <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">Try a broader keyword, clear the city filter, or browse all listings.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onclick="resetAllFilters()" class="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold">Clear filters</button>
          <button type="button" onclick="quickKeywordSearch('church')" class="px-4 py-2 rounded-xl border text-sm font-semibold">Browse churches</button>
        </div>
      </div>`;
    return;
  }

  data.forEach((church) => {
    const isSaved = window.savedChurches ? window.savedChurches.has(church.id) : false;
    const tags = listingTags(church);
    let badgeHTML = '';
    let matchedHTML = '';
    if (church._relevance > 0 && church._matchedKeywords && church._matchedKeywords.length) {
      badgeHTML = `<span class="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full shadow">Match +${Math.round(church._relevance)}</span>`;
      matchedHTML = `<div class="text-[10px] text-emerald-700 mt-1 font-medium">Matched: ${church._matchedKeywords.map(escHtml).join(', ')}</div>`;
    }

    let desc = church.description || '';
    if (church._matchedKeywords && church._matchedKeywords.length) {
      desc = highlightKeywords(desc, church._matchedKeywords);
    } else {
      desc = escHtml(desc);
    }

    const levelBadges = [
      church.sticky ? '<span class="badge-sticky">Sticky</span>' : '',
      church.featured ? '<span class="badge-featured">Featured</span>' : '',
      church.vip ? '<span class="badge-vip">VIP</span>' : '',
    ].filter(Boolean).join(' ');
    const rating = church.rating != null && !Number.isNaN(Number(church.rating))
      ? Number(church.rating).toFixed(1) : '';
    const cardClasses = ['church-card', 'bg-white', 'border', 'border-slate-200', 'rounded-3xl', 'overflow-hidden', 'flex', 'flex-col', 'shadow-sm'];
    if (church.sticky) cardClasses.push('sticky-listing');
    if (church.featured) cardClasses.push('featured-listing');

    const imgSrc = church.image || 'images/36.jpg';
    const cardHTML = `
      <article class="${cardClasses.join(' ')}" data-church-id="${escHtml(church.id)}">
        <div class="relative h-44 bg-slate-200">
          <img src="${escHtml(imgSrc)}" class="w-full h-full object-cover" alt="${escHtml(church.name)} in ${escHtml(church.area || 'DFW')}" loading="lazy" onerror="this.src='images/36.jpg'">
          <div class="absolute top-3 right-3 flex flex-col gap-1 items-end">
            <span class="px-3 py-px text-[10px] font-bold rounded-full bg-white/95 shadow text-slate-700">${escHtml(church.area || 'DFW')}</span>
            ${levelBadges}
          </div>
          <div class="absolute top-3 left-3">
            <span class="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/95 shadow text-sky-800">${escHtml(church.category || 'Listing')}</span>
          </div>
          ${rating ? `<span class="absolute bottom-3 left-3 px-2 py-0.5 text-[10px] font-bold bg-white/95 rounded-full">★ ${rating}</span>` : ''}
          ${badgeHTML}
        </div>
        <div class="p-5 flex-1 flex flex-col">
          <div>
            <h3 class="font-semibold text-xl tracking-tight text-slate-900">${escHtml(church.name)}</h3>
            <div class="text-sky-700 text-xs flex items-center gap-1.5 mt-0.5">
              <i class="fa-solid fa-map-marker-alt shrink-0"></i>
              <span class="line-clamp-1">${escHtml(church.address || church.area || '')}</span>
            </div>
            ${church.times ? `<div class="text-[11px] text-slate-500 mt-1"><i class="fa-regular fa-clock mr-1"></i>${escHtml(church.times)}</div>` : ''}
          </div>
          <p class="text-sm text-slate-600 mt-3 line-clamp-3 flex-1">${desc}</p>
          ${matchedHTML}
          <div class="mt-4 flex flex-wrap gap-1.5">
            ${tags.slice(0, 4).map((t) => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-px rounded-full">${escHtml(t)}</span>`).join('')}
          </div>
          <div class="flex items-center justify-between gap-2 mt-auto pt-5 border-t border-slate-100">
            <div class="flex flex-col gap-1">
              <a href="churches/${escHtml(church.slug)}.html" class="text-sm font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1">
                View profile <i class="fa-solid fa-arrow-right text-xs ml-0.5"></i>
              </a>
              <a href="claim-listing.html?id=${escHtml(church.id)}&slug=${escHtml(church.slug)}" class="text-[10px] text-slate-500 hover:underline">Claim listing</a>
            </div>
            <button type="button" onclick="window.toggleSaveChurch && window.toggleSaveChurch(${JSON.stringify(church.id)}, event)" data-church-id="${escHtml(church.id)}"
              class="text-sm px-3 py-1.5 rounded-2xl flex items-center gap-1 transition-colors ${isSaved ? 'text-amber-600 bg-amber-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}"
              aria-label="${isSaved ? 'Unsave' : 'Save'} ${escHtml(church.name)}">
              <i class="fa-solid fa-bookmark"></i>
            </button>
          </div>
        </div>
      </article>`;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

function highlightKeywords(text, keywords) {
  if (!keywords || !keywords.length) return escHtml(text);
  let highlighted = escHtml(text);
  keywords.forEach((kw) => {
    if (!kw || kw.length < 2) return;
    const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="bg-amber-100 text-amber-900 px-0.5 rounded">$1</mark>');
  });
  return highlighted;
}

function applyFilters() {
  const searchInput = document.getElementById('search-input');
  const areaSelect = document.getElementById('area-filter');
  const sortSelect = document.getElementById('sort-filter');
  const activeCategoryBtn = document.querySelector('#category-filters .filter-chip.active, #category-filters .active');

  currentFilters.search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  currentFilters.area = areaSelect ? areaSelect.value : '';
  currentFilters.category = activeCategoryBtn ? (activeCategoryBtn.dataset.category || '') : '';
  currentFilters.sort = sortSelect ? sortSelect.value : 'relevance';

  const keywords = currentFilters.search
    ? currentFilters.search.split(/[\s,]+/).filter((k) => k.length > 1)
    : [];

  filteredData = churchesData.filter((ch) => {
    const { score, matched } = scoreListing(ch, keywords);
    if (keywords.length > 0 && score <= 0) return false;

    const matchesArea = !currentFilters.area || ch.area === currentFilters.area;
    const matchesCategory = !currentFilters.category || ch.category === currentFilters.category;

    ch._relevance = score;
    ch._matchedKeywords = matched;
    return matchesArea && matchesCategory;
  });

  sortFilteredData(keywords);
  renderDirectoryGrid(filteredData);
  updateMapForFilters(filteredData.map((c) => c.id));
}

function sortFilteredData(keywords) {
  const mode = currentFilters.sort || 'relevance';
  const tier = (c) => (c.sticky ? 3 : 0) + (c.featured ? 2 : 0) + (c.vip ? 1 : 0);

  filteredData.sort((a, b) => {
    if (mode === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
    if (mode === 'area') {
      const byArea = String(a.area || '').localeCompare(String(b.area || ''));
      return byArea || String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (mode === 'featured') {
      const d = tier(b) - tier(a);
      return d || String(a.name || '').localeCompare(String(b.name || ''));
    }
    // relevance (default)
    if (keywords && keywords.length) {
      const d = (b._relevance || 0) - (a._relevance || 0);
      if (d) return d;
    }
    const dTier = tier(b) - tier(a);
    if (dTier) return dTier;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function setCategoryFilter(btn) {
  document.querySelectorAll('#category-filters .filter-chip, #category-filters button').forEach((b) => {
    b.classList.remove('active', 'bg-[#0369a1]', 'bg-indigo-900', 'text-white');
  });
  btn.classList.add('active');

  if (window.URDFWPlatform?.filterListings) platformFilterAndRender();
  else applyFilters();
}

function resetAllFilters() {
  const search = document.getElementById('search-input');
  const area = document.getElementById('area-filter');
  const sort = document.getElementById('sort-filter');

  if (search) search.value = '';
  if (area) area.value = '';
  if (sort) sort.value = 'relevance';

  document.querySelectorAll('#category-filters button').forEach((b) => {
    b.classList.remove('active', 'bg-indigo-900', 'bg-[#0369a1]', 'text-white');
  });
  const allBtn = document.querySelector('#category-filters button[data-category=""]');
  if (allBtn) allBtn.classList.add('active');

  document.querySelectorAll('#dir-quick-chips button').forEach((b) => b.classList.remove('active'));

  currentFilters = { search: '', area: '', category: '', sort: 'relevance' };
  filteredData = [...churchesData];
  sortFilteredData([]);
  renderDirectoryGrid(filteredData);
  updateMapForFilters(churchesData.map((c) => c.id));
  try {
    const url = new URL(window.location.href);
    url.search = '';
    history.replaceState({}, '', url.pathname);
  } catch { /* ignore */ }
}

function exportDirectory(format = 'json') {
  const dataToExport = filteredData.length ? filteredData : churchesData;

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upper-room-dfw-directory-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast(`Exported ${dataToExport.length} listings as JSON`);
  } else if (format === 'csv') {
    const headers = ['id', 'slug', 'name', 'area', 'category', 'address', 'phone', 'website', 'times', 'description'];
    const rows = dataToExport.map((ch) => headers.map((h) => {
      let val = ch[h] || '';
      if (typeof val === 'object') val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    }));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upper-room-dfw-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast(`Exported ${dataToExport.length} listings as CSV`);
  }
}

function filterToSaved() {
  const savedIds = Array.from(window.savedChurches || []);
  filteredData = churchesData.filter((ch) => savedIds.includes(ch.id));
  renderDirectoryGrid(filteredData);
  updateMapForFilters(savedIds);

  const grid = document.getElementById('directory-grid');
  if (grid) {
    const banner = document.createElement('div');
    banner.className = 'dir-empty-state !py-3 mb-3';
    banner.innerHTML = `<i class="fa-solid fa-bookmark text-amber-500 mr-2"></i> Showing your saved churches only.
      <button type="button" class="underline ml-2 font-semibold text-sky-700" onclick="this.closest('.dir-empty-state').remove(); resetAllFilters()">Show all</button>`;
    grid.prepend(banner);
  }
}

function waitForPlatform() {
  return new Promise((resolve) => {
    if (window.URDFWPlatform && window.URDFWPlatform.config) return resolve(window.URDFWPlatform);
    const check = setInterval(() => {
      if (window.URDFWPlatform && window.URDFWPlatform.config) {
        clearInterval(check);
        resolve(window.URDFWPlatform);
      }
    }, 50);
    setTimeout(() => { clearInterval(check); resolve(window.URDFWPlatform || {}); }, 5000);
  });
}

function platformFilterAndRender() {
  const P = window.URDFWPlatform;
  if (!P || !P.filterListings) {
    applyFilters();
    return;
  }
  const searchInput = document.getElementById('search-input');
  if (searchInput) P.searchState.keywords = searchInput.value.trim();
  const areaSelect = document.getElementById('area-filter');
  if (areaSelect) P.searchState.facets.area = areaSelect.value;
  const activeCategoryBtn = document.querySelector('#category-filters .filter-chip.active, #category-filters .active');
  P.searchState.facets.category = activeCategoryBtn ? (activeCategoryBtn.dataset.category || '') : '';
  let base = P.mergeListings ? P.mergeListings(churchesData) : churchesData;
  if (P.filterByDirectory) base = P.filterByDirectory(base, P.activeDirectory);
  filteredData = P.filterListings(base, P.searchState);

  // Overlay weighted scores for UI badges when keywords present
  const keywords = (searchInput?.value || '').toLowerCase().trim().split(/[\s,]+/).filter((k) => k.length > 1);
  filteredData.forEach((ch) => {
    const { score, matched } = scoreListing(ch, keywords);
    ch._relevance = score;
    ch._matchedKeywords = matched;
  });
  currentFilters.sort = document.getElementById('sort-filter')?.value || 'relevance';
  sortFilteredData(keywords);
  renderDirectoryGrid(filteredData);
  updateMapForFilters(filteredData.map((c) => c.id));
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || params.get('search') || '';
  const area = params.get('area') || params.get('city') || '';
  const cat = params.get('cat') || params.get('category') || '';
  const saved = params.get('saved') === 'true';

  const searchInput = document.getElementById('search-input');
  const areaSelect = document.getElementById('area-filter');

  if (q && searchInput) searchInput.value = q;
  if (area && areaSelect) {
    // case-insensitive match to option
    const opts = [...areaSelect.options];
    const match = opts.find((o) => o.value.toLowerCase() === area.toLowerCase());
    if (match) areaSelect.value = match.value;
    else {
      const opt = document.createElement('option');
      opt.value = area;
      opt.textContent = area;
      areaSelect.appendChild(opt);
      areaSelect.value = area;
    }
  }

  if (cat) {
    const catMap = {
      church: 'Church', churches: 'Church',
      ministry: 'Ministry', ministries: 'Ministry',
      youth: 'Youth', family: 'Youth',
      outreach: 'Outreach',
      event: 'Event', events: 'Event',
      'non-denominational': '', baptist: '', pentecostal: '', methodist: '', catholic: ''
    };
    const denomKeywords = {
      'non-denominational': 'non-denominational',
      baptist: 'baptist',
      pentecostal: 'pentecostal',
      methodist: 'methodist',
      catholic: 'catholic'
    };
    const key = cat.toLowerCase();
    if (denomKeywords[key]) {
      if (searchInput && !searchInput.value) searchInput.value = denomKeywords[key];
    } else {
      const mapped = catMap[key] != null ? catMap[key] : (cat.charAt(0).toUpperCase() + cat.slice(1));
      const btn = document.querySelector(`#category-filters button[data-category="${mapped}"]`);
      if (btn) {
        document.querySelectorAll('#category-filters button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
  }

  if (saved) {
    setTimeout(() => filterToSaved(), 500);
    return true;
  }
  return false;
}

function scrollToResults() {
  const el = document.getElementById('directory-results-anchor') || document.getElementById('directory-grid');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function initDirectory() {
  await loadChurchesData();
  if (!Array.isArray(churchesData)) churchesData = [];
  baseChurchesData = [...churchesData];
  const P = await waitForPlatform();

  if (P.mergeListings) churchesData = P.mergeListings(churchesData);
  if (P.filterByDirectory) churchesData = P.filterByDirectory(churchesData, P.activeDirectory);

  window.churchesData = churchesData;
  if (P.initGoogleTranslate) P.initGoogleTranslate();
  window.savedChurches = window.savedChurches || new Set();

  populateAreaFilter(churchesData);

  const skippedFilter = applyUrlParams();

  if (!skippedFilter) {
    if (P.filterListings) {
      platformFilterAndRender();
    } else {
      filteredData = [...churchesData];
      sortFilteredData([]);
      renderDirectoryGrid(filteredData);
    }
  }

  if (P.renderFacetBar) P.renderFacetBar(document.getElementById('urdfw-facet-container'), churchesData);
  if (P.setupInstantSearch) P.setupInstantSearch(document.getElementById('search-input'), platformFilterAndRender);
  if (P.on) {
    P.on('search:change', platformFilterAndRender);
    P.on('displayMode', () => renderDirectoryGrid(filteredData));
  }

  document.querySelectorAll('.urdfw-display-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.urdfw-display-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (P.applyDisplayMode) P.applyDisplayMode(btn.dataset.display);
    };
  });

  const dirSel = document.getElementById('urdfw-directory-select');
  if (dirSel && P) {
    dirSel.value = P.activeDirectory || 'dfw-churches';
    dirSel.onchange = () => {
      P.activeDirectory = dirSel.value;
      localStorage.setItem('urdfw_active_directory', dirSel.value);
      churchesData = P.mergeListings ? P.mergeListings([...baseChurchesData]) : [...baseChurchesData];
      if (P.filterByDirectory) churchesData = P.filterByDirectory(churchesData, dirSel.value);
      window.churchesData = churchesData;
      populateAreaFilter(churchesData);
      platformFilterAndRender();
    };
  }

  const mapProv = document.getElementById('urdfw-map-provider');
  if (mapProv && P) {
    mapProv.value = P.mapProvider || 'openstreetmap';
    mapProv.onchange = () => {
      P.mapProvider = mapProv.value;
      if (P.emit) P.emit('map:provider', mapProv.value);
      reinitMap();
    };
  }

  const printBtn = document.getElementById('export-pdf-list');
  if (printBtn && P && P.printListing) {
    printBtn.onclick = () => {
      if (filteredData[0]) P.printListing(filteredData[0]);
    };
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput && !P.setupInstantSearch) {
    let t;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => applyFilters(), 180);
    });
  }
  const areaFilter = document.getElementById('area-filter');
  if (areaFilter) {
    areaFilter.addEventListener('change', () => (P.filterListings ? platformFilterAndRender() : applyFilters()));
  }
  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', () => (P.filterListings ? platformFilterAndRender() : applyFilters()));
  }

  document.querySelectorAll('#category-filters button').forEach((btn) => {
    btn.addEventListener('click', () => setCategoryFilter(btn));
  });

  const exportJsonBtn = document.getElementById('export-json');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => exportDirectory('json'));
  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportDirectory('csv'));

  setTimeout(() => {
    initMap();
    updateMapForFilters((filteredData.length ? filteredData : churchesData).map((c) => c.id));
  }, 400);

  window.applyFilters = applyFilters;
  window.resetAllFilters = resetAllFilters;
  window.filterToSaved = filterToSaved;
  window.exportDirectory = exportDirectory;
  window.highlightChurch = highlightChurch;

  window.quickKeywordSearch = function (kw) {
    const input = document.getElementById('search-input');
    if (input) {
      input.value = kw;
      if (P.filterListings) platformFilterAndRender();
      else applyFilters();
      scrollToResults();
    }
  };

  window.runDirectorySearch = function () {
    if (P.filterListings) platformFilterAndRender();
    else applyFilters();
    scrollToResults();
  };

  updateStatsUI(churchesData.length, (filteredData.length || churchesData.length));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDirectory);
} else {
  initDirectory();
}
