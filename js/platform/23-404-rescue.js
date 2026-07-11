/**
 * Intent-Driven 404 Rescue — path analysis, live filter search, category matrix.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'for', 'to', 'html', 'page', 'www']);

  function tokenize(path) {
    return (path || '')
      .toLowerCase()
      .replace(/\.html?$/i, '')
      .split(/[/\-_.?&#=+%]+/)
      .filter((t) => t.length > 1 && !STOP.has(t));
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function scoreDestination(dest, tokens, fullPath) {
    let score = 0;
    const path = fullPath.toLowerCase();
    for (const kw of dest.keywords || []) {
      if (path.includes(kw)) score += 12;
      for (const t of tokens) {
        if (t === kw) score += 18;
        else if (t.includes(kw) || kw.includes(t)) score += 8;
        else if (levenshtein(t, kw) <= 2 && kw.length > 4) score += 6;
      }
    }
    if (path.includes((dest.href || '').replace('.html', ''))) score += 25;
    return score;
  }

  function matchChurches(churches, tokens, fullPath) {
    const slugHint = fullPath.split('/').pop().replace(/\.html?$/i, '');
    const results = [];
    for (const c of churches) {
      let score = 0;
      const slug = (c.slug || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const area = (c.area || '').toLowerCase();
      if (slug && fullPath.includes(slug)) score += 40;
      if (slugHint && slug) {
        const dist = levenshtein(slugHint, slug);
        if (dist <= 3) score += 35 - dist * 8;
      }
      for (const t of tokens) {
        if (slug.includes(t)) score += 10;
        if (name.includes(t)) score += 8;
        if (area.includes(t)) score += 14;
        (c.tags || []).forEach((tag) => {
          if (String(tag).toLowerCase().includes(t)) score += 6;
        });
      }
      if (score > 0) results.push({ church: c, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 4);
  }

  function detectArea(tokens, areas) {
    for (const area of areas || []) {
      const key = area.toLowerCase().replace(/\s+/g, '-');
      for (const t of tokens) {
        if (t === key || t === area.toLowerCase() || area.toLowerCase().includes(t)) return area;
      }
    }
    return null;
  }

  function itemSearchText(item) {
    return [
      item.label, item.desc, item.href, ...(item.keywords || []),
      item.church?.name, item.church?.area, item.church?.category,
      ...(item.church?.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function renderCategoryCard(cat, prefix, opts) {
    const href = cat.href.startsWith('http') ? cat.href : prefix + cat.href;
    const primary = opts?.primary ? ' is-primary' : '';
    const hidden = opts?.hidden ? ' is-filtered-out' : '';
    return `<a href="${href}" class="urdfw-404-category-card${primary}${hidden}" data-filter-item data-filter-text="${itemSearchText(cat).replace(/"/g, '')}">
      <i class="fa-solid ${cat.icon || 'fa-arrow-right'}"></i>
      <span class="urdfw-404-category-label">${cat.label}</span>
      <small>${cat.desc || ''}</small>
    </a>`;
  }

  function applyLiveFilter(query) {
    const q = (query || '').trim().toLowerCase();
    const resultsEl = document.getElementById('urdfw-404-search-results');
    let visible = 0;

    document.querySelectorAll('[data-filter-item]').forEach((el) => {
      const text = el.getAttribute('data-filter-text') || el.textContent.toLowerCase();
      const match = !q || text.includes(q);
      el.classList.toggle('is-filtered-out', !match);
      if (match) visible += 1;
    });

    if (resultsEl) {
      if (!q) {
        resultsEl.innerHTML = '';
        resultsEl.classList.add('hidden');
      } else {
        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = visible
          ? `<span class="text-emerald-700"><i class="fa-solid fa-check mr-1"></i> ${visible} destination${visible === 1 ? '' : 's'} match "${query}"</span>`
          : `<span class="text-amber-700"><i class="fa-solid fa-compass mr-1"></i> No exact match — try "directory", "events", or a city name</span>`;
      }
    }
  }

  function bindLiveSearch(input, form) {
    if (!input) return;
    let timer;
    const run = () => applyLiveFilter(input.value);
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    });
    input.addEventListener('search', run);
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const prefix = (location.pathname || '').includes('/churches/') ? '../' : '';
        const visible = document.querySelector('[data-filter-item]:not(.is-filtered-out)');
        if (visible && q.length < 20) {
          visible.click();
          return;
        }
        location.href = prefix + 'directory.html?q=' + encodeURIComponent(q);
      });
    }
  }

  P.run404Rescue = async function () {
    const pathEl = document.getElementById('urdfw-404-path');
    const titleEl = document.getElementById('urdfw-404-title');
    const subtitleEl = document.getElementById('urdfw-404-subtitle');
    const searchHint = document.getElementById('urdfw-404-search-hint');
    const intentGrid = document.getElementById('urdfw-404-intents');
    const categoryGrid = document.getElementById('urdfw-404-categories');
    const churchGrid = document.getElementById('urdfw-404-churches');
    const searchForm = document.getElementById('urdfw-404-search-form');
    const searchInput = document.getElementById('urdfw-404-search-input');

    if (!categoryGrid && !intentGrid) return;

    const attempted = location.pathname + location.search;
    const tokens = tokenize(attempted);
    const prefix = attempted.includes('/churches/') ? '../' : '';

    if (pathEl) pathEl.textContent = attempted;

    let config = { destinations: [], coreCategories: [], areas: [], humanCopy: {} };
    try {
      const res = await fetch(P.resolveAsset('data/404-intents.json'));
      if (res.ok) config = await res.json();
    } catch { /* defaults */ }

    const human = config.humanCopy || {};
    if (titleEl && human.title) titleEl.textContent = human.title;
    if (subtitleEl && human.subtitle) subtitleEl.textContent = human.subtitle;
    if (searchHint && human.searchHint) searchHint.textContent = human.searchHint;

    let churches = [];
    try {
      const res = await fetch(P.resolveAsset('data/churches.json'));
      if (res.ok) churches = await res.json();
    } catch { /* ignore */ }

    const ranked = (config.destinations || [])
      .map((dest) => ({ dest, score: scoreDestination(dest, tokens, attempted) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
      (config.destinations || []).slice(0, 4).forEach((dest) => ranked.push({ dest, score: 1 }));
    }

    const area = detectArea(tokens, config.areas);
    const churchMatches = matchChurches(churches, tokens, attempted);

    if (categoryGrid) {
      categoryGrid.innerHTML = (config.coreCategories || []).map((cat) => {
        const catItem = { ...cat, keywords: cat.keywords || [] };
        return renderCategoryCard(catItem, prefix, {});
      }).join('');
    }

    if (intentGrid) {
      intentGrid.innerHTML = ranked.slice(0, 6).map((r, i) => {
        const href = r.dest.href.startsWith('http') ? r.dest.href : prefix + r.dest.href;
        const q = area && r.dest.id === 'directory' ? `?area=${encodeURIComponent(area)}` : '';
        const text = [r.dest.label, ...(r.dest.keywords || [])].join(' ').toLowerCase();
        return `<a href="${href}${q}" class="urdfw-404-intent-card${i === 0 ? ' is-primary' : ''}" data-filter-item data-filter-text="${text}">
          <i class="fa-solid ${r.dest.icon || 'fa-arrow-right'}"></i>
          <span>${r.dest.label}</span>
          ${i === 0 && r.score >= 15 ? '<small>Best match for your link</small>' : ''}
        </a>`;
      }).join('');
    }

    if (churchGrid && churchMatches.length) {
      churchGrid.innerHTML = churchMatches.map(({ church }) => {
        const img = church.image ? (prefix + church.image) : (prefix + 'images/10.jpg');
        const href = prefix + 'churches/' + church.slug + '.html';
        const text = [church.name, church.area, church.category, ...(church.tags || [])].join(' ').toLowerCase();
        return `<a href="${href}" class="urdfw-404-church-card" data-filter-item data-filter-text="${text}">
          <img src="${img}" alt="" loading="lazy" decoding="async">
          <div><strong>${church.name}</strong><em>${church.area} · ${church.category || 'Church'}</em></div>
        </a>`;
      }).join('');
      churchGrid.closest('section')?.classList.remove('hidden');
    }

    const defaultQ = tokens.join(' ') || (area || '');
    if (searchInput && defaultQ) searchInput.value = defaultQ;

    bindLiveSearch(searchInput, searchForm);
    applyLiveFilter(searchInput?.value || '');

    P.trackClick?.('404_rescue', attempted, {
      topIntent: ranked[0]?.dest?.id,
      area,
      churchMatches: churchMatches.length,
    });

    fetch('/api/platform/404-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: attempted, referrer: document.referrer || null, topIntent: ranked[0]?.dest?.id, area }),
    }).catch(() => {});
  };

  if (document.body?.classList.contains('urdfw-404-page')) {
    P.on('core:ready', () => P.run404Rescue());
  }
})(window);