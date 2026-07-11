/**
 * Platform loader — conditional modules, portal-only analytics, sequential deps
 */
(function () {
  const path = (location.pathname || '').toLowerCase();
  const isPortal =
    path.includes('admin') ||
    path.includes('member-dashboard') ||
    path.includes('feature-checklist') ||
    path.includes('billing-hub');

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
  ];

  const portal = [
    'js/platform/16-dashboards.js',
    'js/platform/17-api-bridge.js',
    'js/platform/18-portal.js',
    'js/platform/19-member-portal.js',
    'js/platform/20-dns.js',
  ];

  const scripts = core.concat(portal);
  if (isPortal) {
    scripts.splice(scripts.indexOf('js/platform/15-global-init.js') + 1, 0, 'js/analytics-live.js');
  }

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (window.URDFWPlatform) {
        window.URDFWPlatform.initCore();
        if (window.URDFWPlatform.applyBreakpoint) window.URDFWPlatform.applyBreakpoint();
        if (window.URDFWPlatform.initPerformanceHints) window.URDFWPlatform.initPerformanceHints();
      }
      return;
    }
    const s = document.createElement('script');
    s.src = scripts[i];
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => {
      if (scripts[i] === 'js/analytics-live.js') {
        loadSequential(i + 1);
        return;
      }
      console.warn('[URDFW] Failed to load', scripts[i]);
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