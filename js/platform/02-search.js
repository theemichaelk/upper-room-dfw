/**
 * Category 2: Advanced search, facets, radius, sorting, map draw
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.searchState = {
    keywords: '',
    facets: {},
    radiusMiles: 25,
    centerLat: 32.78,
    centerLng: -96.9,
    sortBy: 'relevance',
    drawPolygon: null,
    tags: [],
  };

  P.enhanceListing = function (listing) {
    const meta = P.get('listing_meta', {});
    const m = meta[listing.id] || meta[listing.slug] || {};
    return {
      ...listing,
      rating: m.rating || listing.rating || (3.5 + (listing.id % 15) / 10),
      reviewCount: m.reviewCount || 0,
      level: m.level || listing.level || 'free',
      featured: m.featured || listing.featured || false,
      sticky: m.sticky || listing.sticky || false,
      vip: m.vip || listing.vip || false,
      customFields: m.customFields || listing.customFields || {},
      expiresAt: m.expiresAt || null,
    };
  };

  P.filterListings = function (listings, state) {
    state = state || P.searchState;
    let result = listings.map(P.enhanceListing);

    const keywords = state.keywords
      ? state.keywords.toLowerCase().split(/[\s,]+/).filter((k) => k.length > 1)
      : [];

    if (keywords.length) {
      result = result.filter((ch) => {
        const text = [
          ch.name, ch.description, ch.fullDescription, ch.area, ch.category,
          ch.denomination, (ch.tags || []).join(' '), JSON.stringify(ch.customFields || {}),
        ].join(' ').toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      });
      result.forEach((ch) => {
        ch._relevance = keywords.filter((kw) => {
          const text = (ch.name + ch.description + (ch.tags || []).join(' ')).toLowerCase();
          return text.includes(kw);
        }).length;
      });
    }

    Object.entries(state.facets || {}).forEach(([key, val]) => {
      if (!val) return;
      result = result.filter((ch) => {
        if (key === 'category') return ch.category === val;
        if (key === 'area') return ch.area === val;
        if (key === 'denomination') return (ch.denomination || '').includes(val);
        if (key === 'level') return ch.level === val;
        return (ch.customFields && ch.customFields[key] === val) || false;
      });
    });

    if (state.tags && state.tags.length) {
      result = result.filter((ch) => state.tags.some((t) => (ch.tags || []).includes(t)));
    }

    if (state.radiusMiles) {
      result = result
        .filter((ch) => ch.lat && ch.lng)
        .map((ch) => {
          ch._distance = P.haversine(state.centerLat, state.centerLng, ch.lat, ch.lng);
          return ch;
        })
        .filter((ch) => ch._distance <= state.radiusMiles);
    }

    if (state.drawPolygon && state.drawPolygon.length >= 3) {
      result = result.filter((ch) => {
        if (!ch.lat || !ch.lng) return false;
        return P.pointInPolygon(ch.lat, ch.lng, state.drawPolygon);
      });
    }

    const sort = state.sortBy || 'relevance';
    if (sort === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === 'distance') result.sort((a, b) => (a._distance || 999) - (b._distance || 999));
    else if (sort === 'name') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'featured') {
      result.sort((a, b) => {
        const score = (x) => (x.sticky ? 4 : 0) + (x.featured ? 2 : 0) + (x.vip ? 3 : 0) + (x._relevance || 0);
        return score(b) - score(a);
      });
    } else if (keywords.length) {
      result.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
    }

    // Sticky/featured at top
    const sticky = result.filter((x) => x.sticky);
    const featured = result.filter((x) => x.featured && !x.sticky);
    const rest = result.filter((x) => !x.sticky && !x.featured);
    return [...sticky, ...featured, ...rest];
  };

  P.pointInPolygon = function (lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1], yi = polygon[i][0];
      const xj = polygon[j][1], yj = polygon[j][0];
      if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  P.renderFacetBar = function (container, listings) {
    if (!container) return;
    const areas = [...new Set(listings.map((l) => l.area).filter(Boolean))].sort();
    const cats = [...new Set(listings.map((l) => l.category).filter(Boolean))].sort();
    const tags = [...new Set(listings.flatMap((l) => l.tags || []))].slice(0, 12);

    container.innerHTML = `
      <div class="urdfw-facets" id="urdfw-facet-areas">
        <span class="text-xs text-slate-500 w-full">Areas:</span>
        ${areas.map((a) => `<button class="urdfw-facet" data-facet="area" data-val="${a}">${a}</button>`).join('')}
      </div>
      <div class="urdfw-facets" id="urdfw-facet-tags">
        <span class="text-xs text-slate-500 w-full">Tags (instant):</span>
        ${tags.map((t) => `<button class="urdfw-facet" data-facet="tag" data-val="${t}">${t}</button>`).join('')}
      </div>
      <div class="flex flex-wrap gap-2 items-center mt-2 text-sm">
        <label>Radius: <input type="range" id="urdfw-radius" min="5" max="50" value="${P.searchState.radiusMiles}" class="align-middle"> <span id="urdfw-radius-val">${P.searchState.radiusMiles}</span> mi</label>
        <label>Sort: <select id="urdfw-sort" class="border rounded px-2 py-1 text-sm">
          <option value="relevance">Relevance</option><option value="rating">Rating</option>
          <option value="distance">Distance</option><option value="name">Name</option><option value="featured">Featured First</option>
        </select></label>
      </div>`;

    container.querySelectorAll('.urdfw-facet').forEach((btn) => {
      btn.onclick = () => {
        const facet = btn.dataset.facet;
        const val = btn.dataset.val;
        if (facet === 'tag') {
          const idx = P.searchState.tags.indexOf(val);
          if (idx >= 0) P.searchState.tags.splice(idx, 1);
          else P.searchState.tags.push(val);
          btn.classList.toggle('active');
        } else {
          P.searchState.facets[facet] = P.searchState.facets[facet] === val ? '' : val;
          container.querySelectorAll(`[data-facet="${facet}"]`).forEach((b) => b.classList.remove('active'));
          if (P.searchState.facets[facet]) btn.classList.add('active');
        }
        P.emit('search:change', P.searchState);
      };
    });

    const radius = document.getElementById('urdfw-radius');
    if (radius) {
      radius.oninput = () => {
        P.searchState.radiusMiles = +radius.value;
        document.getElementById('urdfw-radius-val').textContent = radius.value;
        P.emit('search:change', P.searchState);
      };
    }
    const sort = document.getElementById('urdfw-sort');
    if (sort) {
      sort.value = P.searchState.sortBy;
      sort.onchange = () => {
        P.searchState.sortBy = sort.value;
        P.emit('search:change', P.searchState);
      };
    }
  };

  P.setupInstantSearch = function (inputEl, onSearch) {
    if (!inputEl) return;
    const handler = P.debounce(() => {
      P.searchState.keywords = inputEl.value.trim();
      P.emit('search:instant', P.searchState.keywords);
      if (onSearch) onSearch(P.searchState);
    }, 180);
    inputEl.addEventListener('input', handler);
    inputEl.setAttribute('autocomplete', 'off');
  };

  P.initMapDraw = function (map) {
    if (!map || !global.L) return;
    let drawMode = false;
    let drawPoints = [];
    let drawLayer = null;

    const toolbar = document.getElementById('urdfw-map-toolbar');
    if (!toolbar) return;

    toolbar.querySelector('[data-action="draw"]')?.addEventListener('click', () => {
      drawMode = !drawMode;
      drawPoints = [];
      if (drawLayer) map.removeLayer(drawLayer);
      toolbar.querySelector('[data-action="draw"]').classList.toggle('active', drawMode);
    });

    toolbar.querySelector('[data-action="clear-draw"]')?.addEventListener('click', () => {
      drawPoints = [];
      P.searchState.drawPolygon = null;
      if (drawLayer) map.removeLayer(drawLayer);
      P.emit('search:change', P.searchState);
    });

    map.on('click', (e) => {
      if (!drawMode) return;
      drawPoints.push([e.latlng.lat, e.latlng.lng]);
      if (drawLayer) map.removeLayer(drawLayer);
      if (drawPoints.length >= 2) {
        drawLayer = L.polygon(drawPoints, { color: '#0369a1', fillOpacity: 0.15 }).addTo(map);
      }
      if (drawPoints.length >= 3) {
        P.searchState.drawPolygon = drawPoints.map((p) => [p[0], p[1]]);
        P.emit('search:change', P.searchState);
      }
    });
  };
})(window);