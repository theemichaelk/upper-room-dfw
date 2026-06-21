/**
 * Platform loader — initializes all modules
 */
(function () {
  const scripts = [
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
    'js/platform/16-dashboards.js',
    'js/platform/17-api-bridge.js',
    'js/platform/18-portal.js',
    'js/platform/19-member-portal.js',
  ];

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (window.URDFWPlatform) window.URDFWPlatform.initCore();
      return;
    }
    const s = document.createElement('script');
    s.src = scripts[i];
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