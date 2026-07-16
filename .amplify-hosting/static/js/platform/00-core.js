/**
 * Upper Room DFW Platform Core
 * Storage, config, i18n, events, utilities
 */
(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'urdfw_';

  function assetBase() {
    if (typeof window !== 'undefined' && window.__URDFW_ASSET_BASE__ != null) {
      return window.__URDFW_ASSET_BASE__;
    }
    const parts = (typeof location !== 'undefined' ? location.pathname : '').split('/').filter(Boolean);
    const depth = Math.max(0, parts.length - 1);
    return depth ? '../'.repeat(depth) : '';
  }

  const Platform = {
    version: '2.0.0',
    config: null,
    i18n: {},
    lang: localStorage.getItem(STORAGE_PREFIX + 'lang') || 'en',
    rtl: localStorage.getItem(STORAGE_PREFIX + 'rtl') === 'true',
    displayMode: localStorage.getItem(STORAGE_PREFIX + 'display_mode') || 'grid',
    mapProvider: localStorage.getItem(STORAGE_PREFIX + 'map_provider') || 'openstreetmap',
    activeDirectory: localStorage.getItem(STORAGE_PREFIX + 'active_directory') || 'dfw-churches',
    theme: JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'theme') || '{}'),
    listeners: {},
  };

  Platform.on = function (event, fn) {
    (Platform.listeners[event] = Platform.listeners[event] || []).push(fn);
  };
  Platform.emit = function (event, data) {
    (Platform.listeners[event] || []).forEach((fn) => fn(data));
  };

  Platform.get = function (key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  Platform.set = function (key, value) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    Platform.emit('storage:' + key, value);
  };

  Platform.t = function (key, fallback) {
    return Platform.i18n[key] || fallback || key;
  };

  Platform.assetBase = assetBase;
  Platform.resolveAsset = function (rel) {
    return assetBase() + String(rel).replace(/^\//, '');
  };

  Platform.loadConfig = async function () {
    try {
      const res = await fetch(Platform.resolveAsset('data/platform-config.json'));
      Platform.config = await res.json();
    } catch {
      Platform.config = { displayModes: ['grid', 'list', 'map', 'compact'], packages: [] };
    }
    return Platform.config;
  };

  Platform.loadI18n = async function (lang) {
    Platform.lang = lang || Platform.lang;
    try {
      const res = await fetch(Platform.resolveAsset('data/i18n/' + Platform.lang + '.json'));
      Platform.i18n = await res.json();
    } catch {
      Platform.i18n = {};
    }
    document.documentElement.lang = Platform.lang;
    document.documentElement.dir = Platform.rtl || Platform.lang === 'ar' ? 'rtl' : 'ltr';
    Platform.applyTranslations();
    return Platform.i18n;
  };

  Platform.applyTranslations = function () {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const t = Platform.t(key);
      if (t && t !== key) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t;
        else el.textContent = t;
      }
    });
  };

  Platform.applyTheme = function () {
    const t = Platform.theme;
    if (t.primary) document.documentElement.style.setProperty('--primary', t.primary);
    if (t.font) document.documentElement.style.setProperty('--urdfw-custom-font', t.font);
    if (t.radius) document.documentElement.style.setProperty('--urdfw-custom-radius', t.radius);
    document.body.classList.add('urdfw-platform');
  };

  Platform.applyDisplayMode = function (mode) {
    Platform.displayMode = mode;
    localStorage.setItem(STORAGE_PREFIX + 'display_mode', mode);
    document.body.classList.remove('urdfw-mode-grid', 'urdfw-mode-list', 'urdfw-mode-map', 'urdfw-mode-compact');
    document.body.classList.add('urdfw-mode-' + mode);
    Platform.emit('displayMode', mode);
  };

  Platform.haversine = function (lat1, lng1, lat2, lng2) {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  Platform.debounce = function (fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  Platform.trackClick = function (type, id, meta) {
    const stats = Platform.get('click_stats', []);
    stats.push({ type, id, meta, ts: Date.now(), page: location.pathname });
    if (stats.length > 5000) stats.splice(0, stats.length - 5000);
    Platform.set('click_stats', stats);
  };

  Platform.uuid = function () {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  };

  Platform.getBreakpoint = function () {
    const w = window.innerWidth;
    const bp = Platform.config?.breakpoints || {};
    if (w >= (bp.desktop?.min || 1440)) return 'desktop';
    if (w >= (bp.laptop?.min || 1024)) return 'laptop';
    if (w >= (bp.tablet?.min || 768)) return 'tablet';
    if (w >= (bp.mobileLg?.min || 480)) return 'mobile-lg';
    return 'mobile';
  };

  Platform.applyBreakpoint = function () {
    const bp = Platform.getBreakpoint();
    const classes = ['urdfw-bp-mobile', 'urdfw-bp-mobile-lg', 'urdfw-bp-tablet', 'urdfw-bp-laptop', 'urdfw-bp-desktop'];
    document.body.classList.remove(...classes);
    document.body.classList.add('urdfw-bp-' + bp);
    document.body.dataset.urdfwBp = bp;
    Platform.emit('breakpoint', bp);
  };

  Platform.initPerformanceHints = function () {
    const perf = Platform.config?.performance || {};
    if (perf.lazyBelowFoldImages !== false) {
      document.querySelectorAll('main img, section img, .church-card img').forEach((img, i) => {
        if (i > 2 && !img.loading) img.loading = 'lazy';
        if (!img.decoding) img.decoding = 'async';
      });
    }
    if (perf.contentVisibilityLists !== false) {
      document.querySelectorAll('section:not(:first-of-type), footer').forEach((el) => {
        el.classList.add('urdfw-below-fold');
      });
    }
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => Platform.applyBreakpoint(), 150);
    });
  };

  Platform.initCore = async function () {
    await Platform.loadConfig();
    await Platform.loadI18n(Platform.lang);
    Platform.applyTheme();
    Platform.applyDisplayMode(Platform.displayMode);
    Platform.applyBreakpoint();
    Platform.emit('core:ready', Platform);
  };

  global.URDFWPlatform = Platform;
})(typeof window !== 'undefined' ? window : global);