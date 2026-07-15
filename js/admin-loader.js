/**
 * Admin slim loader — portal-critical scripts only.
 * Skips public-site modules (maps, search UI, widgets, 404 rescue, site shell).
 * Full platform/loader.js no-ops on admin when this script is present.
 */
(function () {
  if (window.__URDFW_ADMIN_LOADER__) return;
  window.__URDFW_ADMIN_LOADER__ = true;

  function detectAssetBase() {
    const el = document.querySelector('script[src*="admin-loader.js"]');
    return (el?.getAttribute('src') || 'js/admin-loader.js').replace(/js\/admin-loader\.js(?:\?.*)?$/, '');
  }
  window.__URDFW_ASSET_BASE__ = detectAssetBase();
  function scriptUrl(rel) { return window.__URDFW_ASSET_BASE__ + rel; }

  const scripts = [
    'js/platform/00-core.js',
    'js/platform/02-search.js',
    'js/platform/03-listings.js',
    'js/platform/06-reviews.js',
    'js/platform/07-media.js',
    'js/platform/08-users.js',
    'js/platform/10-admin.js',
    'js/platform/11-integrations.js',
    'js/platform/13-seo.js',
    'js/analytics-live.js',
    'js/platform/16-dashboards.js',
    'js/platform/17-api-bridge.js',
    'js/platform/20-dns.js',
    'js/platform/25-control-panel.js',
    'js/platform/26-blog-admin.js',
    'js/platform/18-portal.js',
    'js/platform/21-telemetry.js',
  ];

  const failed = [];

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (failed.length) console.warn('[URDFW] Admin loader failures:', failed);
      if (window.URDFWPlatform) {
        window.URDFWPlatform.initCore();
        window.dispatchEvent(new CustomEvent('urdfw:ready', { detail: { mode: 'admin-slim', failed } }));
      }
      return;
    }
    const s = document.createElement('script');
    s.src = scriptUrl(scripts[i]);
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => {
      failed.push(scripts[i]);
      console.warn('[URDFW] Admin loader failed:', scriptUrl(scripts[i]));
      loadSequential(i + 1);
    };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadSequential(0));
  } else {
    loadSequential(0);
  }
})();
