/**
 * Category 1: Display modes, templates, customization, RTL
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.templates = {
    single: [
      'classic', 'modern', 'minimal', 'magazine', 'card', 'hero',
      'sidebar', 'fullwidth', 'dark', 'light', 'event', 'ministry',
      'youth', 'outreach', 'catholic', 'network'
    ],
    multi: ['standard-multipage', 'premium-multipage'],
  };

  P.setLanguage = async function (lang) {
    P.lang = lang;
    P.rtl = lang === 'ar';
    localStorage.setItem('urdfw_lang', lang);
    localStorage.setItem('urdfw_rtl', P.rtl ? 'true' : 'false');
    await P.loadI18n(lang);
    P.emit('lang:change', lang);
  };

  P.setThemeOption = function (key, value) {
    P.theme[key] = value;
    localStorage.setItem('urdfw_theme', JSON.stringify(P.theme));
    P.applyTheme();
  };

  P.renderCustomizePanel = function () {
    if (document.getElementById('urdfw-customize-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'urdfw-customize-panel';
    if (P.rtl) panel.classList.add('rtl-panel');
    panel.innerHTML = `
      <div id="urdfw-customize-drawer">
        <div class="text-sm font-semibold mb-2">Customize</div>
        <label class="text-xs block mb-1">Display Mode</label>
        <select id="urdfw-cfg-mode" class="w-full border rounded px-2 py-1 text-sm mb-2">
          <option value="grid">Grid</option><option value="list">List</option>
          <option value="map">Map Only</option><option value="compact">Compact</option>
        </select>
        <label class="text-xs block mb-1">Language</label>
        <select id="urdfw-cfg-lang" class="w-full border rounded px-2 py-1 text-sm mb-2">
          <option value="en">English</option><option value="es">Español</option><option value="ar">العربية (RTL)</option>
        </select>
        <label class="text-xs block mb-1">Primary Color</label>
        <input type="color" id="urdfw-cfg-color" value="${P.theme.primary || '#0369a1'}" class="w-full mb-2">
        <label class="text-xs block mb-1">Font Family</label>
        <select id="urdfw-cfg-font" class="w-full border rounded px-2 py-1 text-sm mb-2">
          <option value="Inter, system-ui, sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Playfair Display', Georgia, serif">Playfair Display</option>
          <option value="system-ui, sans-serif">System UI</option>
        </select>
        <label class="text-xs block mb-1">Single-Page Template</label>
        <select id="urdfw-cfg-tpl" class="w-full border rounded px-2 py-1 text-sm mb-2">
          ${P.templates.single.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <label class="text-xs block mb-1">Map Provider</label>
        <select id="urdfw-cfg-map" class="w-full border rounded px-2 py-1 text-sm">
          <option value="openstreetmap">OpenStreetMap</option>
          <option value="google">Google Maps</option>
          <option value="mapbox">MapBox</option>
        </select>
      </div>
      <button id="urdfw-customize-toggle" title="Customize"><i class="fa-solid fa-palette"></i></button>`;
    document.body.appendChild(panel);

    document.getElementById('urdfw-customize-toggle').onclick = () => {
      document.getElementById('urdfw-customize-drawer').classList.toggle('open');
    };
    document.getElementById('urdfw-cfg-mode').value = P.displayMode;
    document.getElementById('urdfw-cfg-mode').onchange = (e) => P.applyDisplayMode(e.target.value);
    document.getElementById('urdfw-cfg-lang').value = P.lang;
    document.getElementById('urdfw-cfg-lang').onchange = (e) => P.setLanguage(e.target.value);
    document.getElementById('urdfw-cfg-color').onchange = (e) => P.setThemeOption('primary', e.target.value);
    document.getElementById('urdfw-cfg-font').onchange = (e) => P.setThemeOption('font', e.target.value);
    document.getElementById('urdfw-cfg-tpl').onchange = (e) => {
      localStorage.setItem('urdfw_template', e.target.value);
      P.emit('template:change', e.target.value);
    };
    document.getElementById('urdfw-cfg-map').value = P.mapProvider;
    document.getElementById('urdfw-cfg-map').onchange = (e) => {
      P.mapProvider = e.target.value;
      localStorage.setItem('urdfw_map_provider', e.target.value);
      P.emit('map:provider', e.target.value);
    };
  };

  P.getTemplatePath = function (slug, type) {
    const tpl = localStorage.getItem('urdfw_template') || 'classic';
    const multi = localStorage.getItem('urdfw_multi_template') || 'standard-multipage';
    if (type === 'multi') return `templates/multi/${multi}.html?slug=${slug}`;
    return `templates/single/${tpl}.html?slug=${slug}`;
  };

  P.initDisplay = function () {
    if ((location.pathname || '').includes('directory.html')) {
      P.renderCustomizePanel();
    }
  };

  P.on('core:ready', P.initDisplay);
})(window);