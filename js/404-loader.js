/**
 * 404 slim loader — core + telemetry + rescue + shell only (~5 modules vs 24+).
 */
(function () {
  function detectAssetBase() {
    const el = document.querySelector('script[src*="404-loader.js"]');
    if (!el) {
      const parts = (location.pathname || '').split('/').filter(Boolean);
      const depth = Math.max(0, parts.length - 1);
      return depth ? '../'.repeat(depth) : '';
    }
    return (el.getAttribute('src') || '').replace(/js\/404-loader\.js(?:\?.*)?$/, '');
  }

  window.__URDFW_ASSET_BASE__ = detectAssetBase();

  function scriptUrl(rel) {
    return window.__URDFW_ASSET_BASE__ + rel;
  }

  const scripts = [
    'js/platform/00-core.js',
    'js/platform/21-telemetry.js',
    'js/platform/23-404-rescue.js',
    'js/platform/24-site-shell.js',
  ];

  const failed = [];

  function loadSequential(i) {
    if (i >= scripts.length) {
      if (failed.length) console.warn('[URDFW 404] Loader failures:', failed);
      if (window.URDFWPlatform) {
        window.URDFWPlatform.initCore();
        window.dispatchEvent(new CustomEvent('urdfw:ready', { detail: { failed, mode: '404-slim' } }));
      }
      return;
    }
    const s = document.createElement('script');
    s.src = scriptUrl(scripts[i]);
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => {
      failed.push(scripts[i]);
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