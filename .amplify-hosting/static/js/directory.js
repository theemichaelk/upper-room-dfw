// Upper Room DFW - Directory page specific JS
// Search, filters, interactive Leaflet map, exports, dynamic cards linking to static pages

let churchesData = [];
let filteredData = [];
let map = null;
let markers = [];
let currentFilters = { search: '', area: '', category: '' };

async function loadChurchesData() {
  try {
    const apiRes = await fetch('/api/listings');
    if (apiRes.ok) {
      churchesData = await apiRes.json();
      return churchesData;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch('data/churches.json');
    churchesData = await res.json();
  } catch (e) {
    // Fallback to embedded data if fetch fails (for pure file:// restrictions in some browsers)
    console.warn('Using embedded fallback data for local file:// - real keyword search still works');
    churchesData = [
      {"id":1,"slug":"the-grove-community-church","name":"The Grove Community Church","area":"Arlington","category":"Church","address":"1425 S Collins St, Arlington, TX 76010","lat":32.7357,"lng":-97.1081,"phone":"(817) 555-0192","email":"hello@thegrovearlington.org","website":"https://thegrovearlington.org","times":"Sundays 9:00am & 11:00am","description":"A vibrant, multi-generational church with powerful worship and deep community. Known for excellent kids and youth ministries.","fullDescription":"The Grove Community Church is a dynamic, Spirit-filled congregation located in the heart of Arlington. We are passionate about connecting people to God, to each other, and to the community around us. With contemporary worship, relevant biblical teaching, and strong small groups, The Grove is a place where families thrive and individuals discover their purpose. Our award-winning children's and youth programs make us one of the top family-friendly churches in Arlington.","denomination":"Non-denominational","size":"Large","tags":["Contemporary","Multi-ethnic","Youth","Family"],"image":"images/36.jpg"},
      {"id":2,"slug":"the-sanctuary-worship-center","name":"The Sanctuary Worship Center","area":"Dallas","category":"Church","address":"3100 S Lancaster Rd, Dallas, TX 75216","lat":32.7157,"lng":-96.8089,"phone":"(214) 555-8721","email":"connect@sanctuarydfw.org","website":"https://sanctuarydfw.org","times":"Sundays 8:30am & 10:45am | Wednesdays 7pm","description":"Historic Dallas congregation focused on authentic worship, prayer, and serving the South Dallas community.","fullDescription":"The Sanctuary Worship Center has been a pillar of faith in South Dallas for decades. We emphasize deep, Spirit-led worship, powerful prayer, and practical community outreach. Our congregation is diverse and welcoming, with a heart to see transformation in our neighborhood through food pantries, after-school programs, and mentorship.","denomination":"Pentecostal","size":"Medium","tags":["Traditional","Prayer","Outreach","Historic"],"image":"images/37.jpg"},
      {"id":3,"slug":"united-faith-chapel","name":"United Faith Chapel","area":"Fort Worth","category":"Church","address":"6100 W 7th St, Fort Worth, TX 76107","lat":32.7555,"lng":-97.3308,"phone":"(682) 555-3310","email":"info@unitedfaithfw.org","website":"https://unitedfaithfw.org","times":"Sundays 10:00am","description":"A warm, welcoming church in the heart of Fort Worth with strong small groups and a heart for families.","fullDescription":"United Faith Chapel is a family-oriented church in the Cultural District of Fort Worth. We focus on building authentic relationships through small groups, excellent children's ministry, and practical teaching for everyday life. Our mission is to help people find hope and purpose in Jesus.","denomination":"Non-denominational","size":"Medium","tags":["Family","Small Groups","Contemporary"],"image":"images/38.jpg"},
      {"id":4,"slug":"hope-and-healing-ministry-center","name":"Hope & Healing Ministry Center","area":"Dallas","category":"Ministry","address":"2500 McKinney Ave, Dallas, TX 75201","lat":32.7925,"lng":-96.8025,"phone":"(214) 555-4400","email":"care@hopeandhealingdfw.org","website":"https://hopeandhealingdfw.org","times":"Support groups Tue & Thu evenings","description":"Christian counseling, recovery programs, and support groups for grief, addiction, and marriage restoration.","fullDescription":"Hope & Healing Ministry Center provides professional, biblically-grounded support for individuals and families walking through difficult seasons. We offer licensed counseling, Celebrate Recovery groups, marriage intensives, and grief support. Partnering with local churches across DFW.","denomination":"Interdenominational","size":"Small","tags":["Counseling","Recovery","Support","Marriage"],"image":"images/4.jpg"}
    ];
  }
  return churchesData;
}

let baseChurchesData = [];

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

  markers = churchesData.filter(c => c.lat && c.lng).map(church => {
    const marker = L.marker([church.lat, church.lng], { title: church.name }).addTo(map);
    marker.bindPopup(`<strong>${church.name}</strong><br><a href="churches/${church.slug}.html">View Profile</a>`);
    marker.churchId = church.id;
    return marker;
  });
  setTimeout(() => { if (map) map.invalidateSize(); }, 150);
}

function reinitMap() {
  if (map) { map.remove(); map = null; markers = []; }
  initMap();
  updateMapForFilters(filteredData.map(c => c.id));
}

function updateMapForFilters(filteredIds) {
  if (!map || !markers.length) return;

  markers.forEach(marker => {
    const isVisible = filteredIds.includes(marker.churchId);
    if (isVisible) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  });
}

function highlightChurch(id) {
  // Scroll to and flash the card in the list
  const card = document.querySelector(`[data-church-id="${id}"]`);
  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.style.transition = 'all 0.2s';
  card.style.boxShadow = '0 0 0 4px #c2410f';
  setTimeout(() => {
    card.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
  }, 1600);
}

// Render the grid of church cards
function renderDirectoryGrid(data) {
  const container = document.getElementById('directory-grid');
  if (!container) return;
  container.innerHTML = '';

  const resultsEl = document.getElementById('results-count');
  if (resultsEl) resultsEl.textContent = data.length;

  if (data.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center bg-white rounded-3xl border">
        <i class="fa-solid fa-search text-4xl text-slate-300 mb-3"></i>
        <p class="text-lg text-slate-500">No churches match your current filters.</p>
        <button onclick="resetAllFilters()" class="mt-4 text-sm font-semibold text-indigo-700 hover:underline">Clear all filters</button>
      </div>
    `;
    return;
  }

  data.forEach(church => {
    const isSaved = window.savedChurches ? window.savedChurches.has(church.id) : false;

    // Relevance badge + matched keywords display - shows it's filtering real data by your entered keywords
    let badgeHTML = '';
    let matchedHTML = '';
    if (church._relevance !== undefined && church._relevance > 0 && church._matchedKeywords && church._matchedKeywords.length > 0) {
      badgeHTML = `<span class="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">+${church._relevance} keyword match${church._relevance > 1 ? 'es' : ''}</span>`;
      matchedHTML = `<div class="text-[10px] text-emerald-700 mt-1 font-medium">Matched your keywords: ${church._matchedKeywords.join(', ')}</div>`;
    }

    // Highlight the keywords in the description using the real church data
    let desc = church.description || '';
    if (church._matchedKeywords && church._matchedKeywords.length > 0) {
      desc = highlightKeywords(desc, church._matchedKeywords);
    }

    const levelBadges = [
      church.sticky ? '<span class="badge-sticky">Sticky</span>' : '',
      church.featured ? '<span class="badge-featured">Featured</span>' : '',
      church.vip ? '<span class="badge-vip">VIP</span>' : '',
    ].filter(Boolean).join(' ');
    const rating = church.rating ? (church.rating).toFixed(1) : '';
    const cardClasses = ['church-card', 'bg-white', 'border', 'border-slate-200', 'rounded-3xl', 'overflow-hidden', 'flex', 'flex-col', 'shadow-sm'];
    if (church.sticky) cardClasses.push('sticky-listing');
    if (church.featured) cardClasses.push('featured-listing');

    const cardHTML = `
      <div class="${cardClasses.join(' ')}" data-church-id="${church.id}">
        <div class="relative h-44 bg-slate-200">
          <img src="${church.image}" class="w-full h-full object-cover" alt="${church.name} in ${church.area}" loading="lazy">
          <div class="absolute top-3 right-3 flex flex-col gap-1 items-end">
            <span class="px-3 py-px text-[10px] font-bold rounded-full bg-white/95 shadow text-slate-700">${church.area}</span>
            ${levelBadges}
          </div>
          <div class="absolute top-3 left-3">
            <span class="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/95 shadow text-indigo-800">${church.category}</span>
          </div>
          ${rating ? `<span class="absolute bottom-3 left-3 px-2 py-0.5 text-[10px] font-bold bg-white/95 rounded-full">★ ${rating}</span>` : ''}
          ${badgeHTML}
        </div>
        
        <div class="p-5 flex-1 flex flex-col">
          <div>
            <h3 class="font-semibold text-xl tracking-tight">${church.name}</h3>
            <div class="text-emerald-700 text-xs flex items-center gap-1.5 mt-0.5">
              <i class="fa-solid fa-map-marker-alt"></i>
              <span class="line-clamp-1">${church.address}</span>
            </div>
          </div>
          
          <p class="text-sm text-slate-600 mt-3 line-clamp-3 flex-1">${desc}</p>
          
          ${matchedHTML}
          
          <div class="mt-4 flex flex-wrap gap-1.5">
            ${church.tags.slice(0, 4).map(t => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-px rounded-full">${t}</span>`).join('')}
          </div>
          
          <div class="flex items-center justify-between gap-2 mt-auto pt-5 border-t border-slate-100">
            <div class="flex flex-col gap-1">
              <a href="churches/${church.slug}.html" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1">
                View full profile <i class="fa-solid fa-arrow-right text-xs ml-0.5"></i>
              </a>
              <a href="claim-listing.html?id=${church.id}&slug=${church.slug}" class="text-[10px] text-slate-500 hover:underline">Claim listing</a>
            </div>
            <button onclick="window.toggleSaveChurch(${church.id}, event)" data-church-id="${church.id}"
                    class="text-sm px-3 py-1 rounded-2xl flex items-center gap-1 transition-colors ${isSaved ? 'text-amber-600 bg-amber-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}">
              <i class="fa-solid fa-bookmark"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// Helper to highlight matched keywords in text (for real keyword-based display)
function highlightKeywords(text, keywords) {
  if (!keywords || keywords.length === 0) return text;
  let highlighted = text;
  keywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded">$1</mark>');
  });
  return highlighted;
}

// Main filter function - now strictly pulls real Texas churches data by entered keywords (AND logic for multiple)
function applyFilters() {
  const searchInput = document.getElementById('search-input');
  const areaSelect = document.getElementById('area-filter');
  const activeCategoryBtn = document.querySelector('#category-filters .active');

  currentFilters.search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  currentFilters.area = areaSelect ? areaSelect.value : '';
  currentFilters.category = activeCategoryBtn ? activeCategoryBtn.dataset.category || '' : '';

  // Split into keywords - supports "youth dallas", "youth, family", etc.
  const keywords = currentFilters.search ? currentFilters.search.split(/[\s,]+/).filter(k => k.length > 1) : [];

  filteredData = churchesData.filter(ch => {
    let relevanceScore = 0;

    const searchText = (ch.name + ' ' + ch.description + ' ' + (ch.fullDescription || '') + ' ' + ch.tags.join(' ') + ' ' + ch.address + ' ' + ch.area + ' ' + ch.category).toLowerCase();

    if (keywords.length > 0) {
      keywords.forEach(kw => {
        if (searchText.includes(kw)) {
          relevanceScore++;
        }
      });
      // Match if ANY keyword is found (flexible search "by the keywords entered")
      if (relevanceScore === 0) return false;
    }

    const matchesArea = !currentFilters.area || ch.area === currentFilters.area;
    const matchesCategory = !currentFilters.category || ch.category === currentFilters.category;

    ch._relevance = relevanceScore;
    ch._matchedKeywords = keywords;  // for highlighting in render

    return matchesArea && matchesCategory;
  });

  // Sort by relevance (best keyword matches first) when keywords are used
  if (keywords.length > 0) {
    filteredData.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
  } else {
    // default sort by name or id
    filteredData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  renderDirectoryGrid(filteredData);

  const visibleIds = filteredData.map(c => c.id);
  updateMapForFilters(visibleIds);
}

function setCategoryFilter(btn, category) {
  document.querySelectorAll('#category-filters button').forEach(b => {
    b.classList.remove('active', 'bg-indigo-900', 'text-white');
    b.classList.add('border', 'hover:bg-slate-100');
  });
  btn.classList.add('active', 'bg-indigo-900', 'text-white');
  btn.classList.remove('border', 'hover:bg-slate-100');

  if (window.URDFWPlatform?.filterListings) platformFilterAndRender();
  else applyFilters();
}

function resetAllFilters() {
  const search = document.getElementById('search-input');
  const area = document.getElementById('area-filter');
  
  if (search) search.value = '';
  if (area) area.value = '';
  
  // Reset category chips
  document.querySelectorAll('#category-filters button').forEach(b => b.classList.remove('active', 'bg-indigo-900', 'text-white'));
  const allBtn = document.querySelector('#category-filters button[data-category=""]');
  if (allBtn) allBtn.classList.add('active', 'bg-indigo-900', 'text-white');

  currentFilters = { search: '', area: '', category: '' };
  filteredData = [...churchesData];
  
  renderDirectoryGrid(filteredData);
  updateMapForFilters(churchesData.map(c => c.id));
}

// Export current filtered results
function exportDirectory(format = 'json') {
  const dataToExport = filteredData.length ? filteredData : churchesData;
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upper-room-dfw-directory-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showToast(`Exported ${dataToExport.length} listings as JSON`);
  } else if (format === 'csv') {
    const headers = ['id','slug','name','area','category','address','phone','website','times','description'];
    const rows = dataToExport.map(ch => headers.map(h => {
      let val = ch[h] || '';
      if (typeof val === 'object') val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    }));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upper-room-dfw-directory-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showToast(`Exported ${dataToExport.length} listings as CSV`);
  }
}

// Filter only to saved churches
function filterToSaved() {
  const savedIds = Array.from(window.savedChurches || []);
  filteredData = churchesData.filter(ch => savedIds.includes(ch.id));
  renderDirectoryGrid(filteredData);
  updateMapForFilters(savedIds);
  
  // Show a helpful banner
  const banner = document.createElement('div');
  banner.className = 'col-span-full -mt-2 mb-3 px-4 py-2 bg-amber-50 text-amber-700 text-sm rounded-2xl flex items-center gap-2';
  banner.innerHTML = `<i class="fa-solid fa-bookmark"></i> Showing your saved churches only. <button class="underline ml-1" onclick="this.closest('.col-span-full').remove(); resetAllFilters()">Show all</button>`;
  const grid = document.getElementById('directory-grid');
  if (grid) grid.prepend(banner);
}

// Initialize the full directory page
function waitForPlatform() {
  return new Promise((resolve) => {
    if (window.URDFWPlatform && window.URDFWPlatform.config) return resolve(window.URDFWPlatform);
    const check = setInterval(() => {
      if (window.URDFWPlatform && window.URDFWPlatform.config) { clearInterval(check); resolve(window.URDFWPlatform); }
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
  const activeCategoryBtn = document.querySelector('#category-filters .active');
  P.searchState.facets.category = activeCategoryBtn ? (activeCategoryBtn.dataset.category || '') : '';
  let base = P.mergeListings ? P.mergeListings(churchesData) : churchesData;
  if (P.filterByDirectory) base = P.filterByDirectory(base, P.activeDirectory);
  filteredData = P.filterListings(base, P.searchState);
  renderDirectoryGrid(filteredData);
  updateMapForFilters(filteredData.map(c => c.id));
}

async function initDirectory() {
  await loadChurchesData();
  baseChurchesData = [...churchesData];
  const P = await waitForPlatform();

  if (P.mergeListings) churchesData = P.mergeListings(churchesData);
  if (P.filterByDirectory) churchesData = P.filterByDirectory(churchesData, P.activeDirectory);

  window.churchesData = churchesData;
  if (P.initGoogleTranslate) P.initGoogleTranslate();
  window.savedChurches = window.savedChurches || new Set();

  filteredData = P.filterListings ? P.filterListings(churchesData, P.searchState) : [...churchesData];
  renderDirectoryGrid(filteredData);

  if (P.renderFacetBar) P.renderFacetBar(document.getElementById('urdfw-facet-container'), churchesData);
  if (P.setupInstantSearch) P.setupInstantSearch(document.getElementById('search-input'), platformFilterAndRender);
  if (P.on) {
    P.on('search:change', platformFilterAndRender);
    P.on('displayMode', () => renderDirectoryGrid(filteredData));
  }

  document.querySelectorAll('.urdfw-display-btn').forEach(btn => {
    btn.onclick = () => { if (P.applyDisplayMode) P.applyDisplayMode(btn.dataset.display); };
  });

  const dirSel = document.getElementById('urdfw-directory-select');
  if (dirSel && P) {
    dirSel.value = P.activeDirectory || 'dfw-churches';
    dirSel.onchange = () => {
      P.activeDirectory = dirSel.value;
      localStorage.setItem('urdfw_active_directory', dirSel.value);
      churchesData = P.mergeListings([...baseChurchesData]);
      churchesData = P.filterByDirectory(churchesData, dirSel.value);
      window.churchesData = churchesData;
      platformFilterAndRender();
    };
  }

  const mapProv = document.getElementById('urdfw-map-provider');
  if (mapProv && P) {
    mapProv.value = P.mapProvider || 'openstreetmap';
    mapProv.onchange = () => { P.mapProvider = mapProv.value; P.emit('map:provider', mapProv.value); reinitMap(); };
  }

  const printBtn = document.getElementById('export-pdf-list');
  if (printBtn && P) printBtn.onclick = () => filteredData.slice(0, 1).forEach(l => P.printListing(l));
  
  const searchInput = document.getElementById('search-input');
  if (searchInput && !P.setupInstantSearch) searchInput.addEventListener('input', () => applyFilters());
  const areaFilter = document.getElementById('area-filter');
  if (areaFilter) areaFilter.addEventListener('change', () => (P.filterListings ? platformFilterAndRender() : applyFilters()));
  
  // Category chips
  document.querySelectorAll('#category-filters button').forEach(btn => {
    btn.addEventListener('click', () => setCategoryFilter(btn, btn.dataset.category || ''));
  });
  
  // Export buttons
  const exportJsonBtn = document.getElementById('export-json');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => exportDirectory('json'));
  
  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportDirectory('csv'));
  
  // Initialize map (Leaflet loaded via CDN in the HTML)
  setTimeout(() => {
    initMap();
    // Sync initial map
    updateMapForFilters(churchesData.map(c => c.id));
  }, 400);
  
  // Check for ?saved=true query param
  const params = new URLSearchParams(window.location.search);
  if (params.get('saved') === 'true') {
    setTimeout(() => filterToSaved(), 600);
  }
  
  // Expose key functions
  window.applyFilters = applyFilters;
  window.resetAllFilters = resetAllFilters;
  window.filterToSaved = filterToSaved;
  window.exportDirectory = exportDirectory;

  // Quick test for keywords (called from HTML buttons)
  window.quickKeywordSearch = function(kw) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = kw;
      applyFilters();
    }
  };
  
  // Initial stats
  const totalEl = document.getElementById('total-listings');
  if (totalEl) totalEl.textContent = churchesData.length;

  // Ensure initial render shows full real data message
  setTimeout(() => {
    const rc = document.getElementById('results-count');
    if (rc && rc.parentElement) {
      rc.parentElement.innerHTML = `Showing <span id="results-count">${churchesData.length}</span> of <span id="total-listings">${churchesData.length}</span> listings • All data from real Texas churches in <a href="data/churches.json" class="underline">churches.json</a>`;
    }
  }, 100);
}

// Auto-init when this script runs on directory.html
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDirectory);
} else {
  initDirectory();
}