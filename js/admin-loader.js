/**
 * Admin slim loader — portal-critical scripts only (~10 vs 27+).
 * Cuts admin login time by skipping maps, billing, search, listings modules.
 */
(function () {
  function detectAssetBase() {
    const el = document.querySelector('script[src*="admin-loader.js"]');
    return (el?.getAttribute('src') || 'js/admin-loader.js').replace(/js\/admin-loader\.js(?:\?.*)?$/, '');
  }
  window.__URDFW_ASSET_BASE__ = detectAssetBase();
  function scriptUrl(rel) { return window.__URDFW_ASSET_BASE__ + rel; }

  const scripts = [
    'js/platform/00-core.js',
    'js/platform/17-api-bridge.js',
    'js/platform/10-admin.js',
    'js/platform/13-seo.js',
    'js/platform/16-dashboards.js',
    'js/platform/25-control-panel.js',
    'js/platform/26-blog-admin.js',
    'js/platform/18-portal.js',
    'js/platform/20-dns.js',
    'js/platform/21-telemetry.js',
  ];

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (window.URDFWPlatform) {
        window.URDFWPlatform.initCore();
        window.dispatchEvent(new CustomEvent('urdfw:ready', { detail: { mode: 'admin-slim' } }));
      }
      return;
    }
    const s = document.createElement('script');
    s.src = scriptUrl(scripts[i]);
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => loadSequential(i + 1);
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadSequential(0));
  } else {
    loadSequential(0);
  }
})();