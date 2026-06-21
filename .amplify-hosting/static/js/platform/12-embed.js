/**
 * Category 12: Widgets, shortcodes, embed, page builder
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.renderWidget = function (type, container, options) {
    options = options || {};
    if (!container) return;
    container.className = 'urdfw-widget';
    const title = type.charAt(0).toUpperCase() + type.slice(1);
    container.innerHTML = `<div class="urdfw-widget-title">${title}</div><div class="urdfw-widget-body"></div>`;
    const body = container.querySelector('.urdfw-widget-body');

    switch (type) {
      case 'search':
        body.innerHTML = `<input type="text" placeholder="Search DFW churches..." class="w-full border rounded px-3 py-2 text-sm" id="widget-search">`;
        P.setupInstantSearch(body.querySelector('#widget-search'), () => {
          if (options.onSearch) options.onSearch(P.searchState);
        });
        break;
      case 'categories':
        body.innerHTML = (P.config?.packages ? ['Church', 'Ministry', 'Youth', 'Outreach', 'Event'] : []).map((c) =>
          `<a href="directory.html?cat=${c}" class="block text-sm py-1 text-[#0369a1]">${c}</a>`).join('');
        break;
      case 'locations':
        body.innerHTML = ['Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Frisco'].map((a) =>
          `<a href="directory.html?area=${a}" class="block text-sm py-1">${a}</a>`).join('');
        break;
      case 'listings':
        const items = (options.listings || []).slice(0, options.count || 5);
        body.innerHTML = items.map((l) =>
          `<a href="churches/${l.slug}.html" class="block text-sm py-1 border-b">${l.name} <span class="text-xs text-slate-400">${l.area}</span></a>`).join('') || '<span class="text-xs text-slate-400">No listings</span>';
        break;
      case 'button':
        body.innerHTML = `<a href="${options.url || 'directory.html'}" class="inline-block px-4 py-2 bg-[#0369a1] text-white rounded-lg text-sm">${options.label || 'Browse Directory'}</a>`;
        break;
      case 'map':
        body.innerHTML = `<div id="widget-map-${Date.now()}" style="height:${options.height || 300}px" class="rounded border"></div>`;
        setTimeout(() => {
          const map = P.createMap(body.querySelector('[id^=widget-map]')?.id, { zoom: 9 });
          if (map && options.listings) P.addListingMarkers(map, options.listings);
        }, 300);
        break;
      case 'slider':
        body.innerHTML = `<div class="flex gap-2 overflow-x-auto">${(options.listings || []).slice(0, 6).map((l) =>
          `<div class="min-w-[140px] border rounded p-2"><img src="${l.image}" class="h-16 w-full object-cover rounded"><div class="text-xs mt-1 font-medium">${l.name}</div></div>`).join('')}</div>`;
        break;
      default:
        body.textContent = 'Widget: ' + type;
    }
  };

  P.parseShortcodes = function (text, listings) {
    return text.replace(/\[urdfw_(\w+)([^\]]*)\]/g, (match, type, attrs) => {
      const params = {};
      attrs.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { params[k] = v; });
      const div = `<div data-urdfw-widget="${type}" data-params='${JSON.stringify(params)}'></div>`;
      return div;
    });
  };

  P.initWidgetsOnPage = function (listings) {
    document.querySelectorAll('[data-urdfw-widget]').forEach((el) => {
      const type = el.dataset.urdfwWidget;
      const params = JSON.parse(el.dataset.params || '{}');
      P.renderWidget(type, el, { ...params, listings, count: +params.count || 5 });
    });
    document.querySelectorAll('[data-urdfw-embed]').forEach((el) => {
      P.renderEmbed(el, listings);
    });
  };

  P.renderEmbed = function (container, listings) {
    const mode = container.dataset.mode || 'grid';
    const count = +(container.dataset.count || 6);
    const items = (listings || []).slice(0, count);
    container.innerHTML = `<div class="urdfw-embed urdfw-mode-${mode}"><div class="directory-grid"></div></div>`;
    const grid = container.querySelector('.directory-grid');
    items.forEach((l) => {
      grid.insertAdjacentHTML('beforeend', `
        <div class="church-card border rounded p-3 text-sm">
          <img src="${l.image}" class="h-24 w-full object-cover rounded mb-2" alt="">
          <a href="churches/${l.slug}.html" class="font-semibold text-[#0369a1]">${l.name}</a>
          <div class="text-xs text-slate-500">${l.area}</div>
        </div>`);
    });
  };

  P.getEmbedCode = function (options) {
    options = options || {};
    const src = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}embed.html?mode=${options.mode || 'grid'}&count=${options.count || 6}`;
    return `<iframe src="${src}" width="${options.width || '100%'}" height="${options.height || 400}" frameborder="0" title="Upper Room DFW Directory"></iframe>`;
  };

  P.initPageBuilder = function (dropzoneId) {
    const blocks = ['hero', 'search', 'listings', 'map', 'testimonials', 'cta'];
    const palette = document.getElementById('pb-palette');
    const zone = document.getElementById(dropzoneId);
    if (!palette || !zone) return;
    palette.innerHTML = blocks.map((b) => `<div class="dd-item" draggable="true" data-id="${b}">${b} block</div>`).join('');
    P.initDragDrop('pb-palette');
    P.initDragDrop(dropzoneId, (order) => P.set('page_layout', order));
  };
})(window);