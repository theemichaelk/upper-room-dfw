/**
 * Platform loader — asset-base aware, portal-only analytics, sequential deps
 */
(function () {
  function detectAssetBase() {
    const el = document.querySelector('script[src*="platform/loader.js"]');
    if (!el) {
      const parts = (location.pathname || '').split('/').filter(Boolean);
      const depth = Math.max(0, parts.length - 1);
      return depth ? '../'.repeat(depth) : '';
    }
    return (el.getAttribute('src') || '').replace(/js\/platform\/loader\.js(?:\?.*)?$/, '');
  }

  window.__URDFW_ASSET_BASE__ = detectAssetBase();

  function scriptUrl(rel) {
    return window.__URDFW_ASSET_BASE__ + rel;
  }

  const path = (location.pathname || '').toLowerCase();
  const is404 = path.includes('404') || document.body?.classList.contains('urdfw-404-page');
  const isPortal =
    path.includes('admin') ||
    path.includes('member-dashboard') ||
    path.includes('feature-checklist') ||
    path.includes('billing-hub');

  if (is404) {
    const slim = document.createElement('script');
    slim.src = scriptUrl('js/404-loader.js');
    slim.defer = true;
    document.head.appendChild(slim);
    return;
  }

  const core = [
    'js/platform/00-core.js',
    'js/platform/01-display.js',
    'js/platform/02-search.js',
    'js/platform/03-listings.js',
    'js/platform/04-fields.js',
    'js/platform/05-maps.js',
    'js/platform/06-reviews.js',
    'js/platform/07-media.js',
    'js/platform/08-users.js',
    'js/platform/09-billing.js',
    'js/platform/10-admin.js',
    'js/platform/11-integrations.js',
    'js/platform/12-embed.js',
    'js/platform/13-seo.js',
    'js/platform/14-bookmarks.js',
    'js/platform/15-global-init.js',
    'js/platform/21-telemetry.js',
    'js/platform/22-widgets-ui.js',
    'js/platform/23-404-rescue.js',
    'js/platform/24-site-shell.js',
  ];

  const portal = [
    'js/platform/16-dashboards.js',
    'js/platform/25-control-panel.js',
    'js/platform/17-api-bridge.js',
    'js/platform/18-portal.js',
    'js/platform/19-member-portal.js',
    'js/platform/20-dns.js',
  ];

  const scripts = core.concat(portal);
  if (isPortal) {
    scripts.splice(scripts.indexOf('js/platform/15-global-init.js') + 1, 0, 'js/analytics-live.js');
  }

  const failed = [];

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (failed.length) {
        console.warn('[URDFW] Loader completed with failures:', failed);
      }
      if (window.URDFWPlatform) {
        window.URDFWPlatform.initCore();
        if (window.URDFWPlatform.applyBreakpoint) window.URDFWPlatform.applyBreakpoint();
        if (window.URDFWPlatform.initPerformanceHints) window.URDFWPlatform.initPerformanceHints();
        window.dispatchEvent(new CustomEvent('urdfw:ready', { detail: { failed } }));
      }
      return;
    }
    const s = document.createElement('script');
    s.src = scriptUrl(scripts[i]);
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => {
      if (scripts[i] === 'js/analytics-live.js') {
        loadSequential(i + 1);
        return;
      }
      failed.push(scripts[i]);
      console.warn('[URDFW] Failed to load', scriptUrl(scripts[i]));
      loadSequential(i + 1);
    };
    document.head.appendChild(s);
  }

  function start() {
    loadSequential(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();