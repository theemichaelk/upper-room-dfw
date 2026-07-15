/**
 * Runtime telemetry — supplements build-time head injection via API settings.
 * Ensures GTM dataLayer, GA4, verification metas, and custom scripts register.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const MARKER_ID = 'urdfw-telemetry-runtime';

  function ensureMeta(name, content) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    if (el.getAttribute('content') !== content) el.setAttribute('content', content);
  }

  function injectGtm(gtmId) {
    if (!gtmId || document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) return;
    global.dataLayer = global.dataLayer || [];
    global.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId);
    document.head.appendChild(s);
    if (!document.querySelector('noscript iframe[src*="googletagmanager.com/ns.html"]')) {
      const ns = document.createElement('noscript');
      ns.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=' + gtmId + '" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
      document.body.insertBefore(ns, document.body.firstChild);
    }
  }

  function injectGa4(ga4Id) {
    if (!ga4Id || document.querySelector('script[src*="gtag/js"]')) return;
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id);
    document.head.appendChild(s);
    s.onload = () => {
      global.gtag('js', new Date());
      global.gtag('config', ga4Id);
    };
  }

  function injectHeadScript(entry) {
    if (!entry) return;
    const id = entry.id || entry.src || 'inline';
    if (document.getElementById(MARKER_ID + '-' + id)) return;
    const s = document.createElement('script');
    s.id = MARKER_ID + '-' + id;
    if (entry.src) {
      s.src = entry.src;
      if (entry.async) s.async = true;
      if (entry.defer) s.defer = true;
    } else if (entry.inline) {
      s.textContent = entry.inline;
    } else return;
    document.head.appendChild(s);
  }

  function injectCustomHead(html) {
    if (!html || document.getElementById(MARKER_ID + '-custom')) return;
    const wrap = document.createElement('div');
    wrap.id = MARKER_ID + '-custom';
    wrap.innerHTML = html;
    while (wrap.firstChild) {
      const node = wrap.firstChild;
      if (node.tagName === 'SCRIPT') {
        const s = document.createElement('script');
        if (node.src) s.src = node.src;
        else s.textContent = node.textContent;
        document.head.appendChild(s);
      } else if (node.tagName === 'META' || node.tagName === 'LINK') {
        document.head.appendChild(node);
      } else {
        document.head.appendChild(node);
      }
    }
  }

  function normalizeVerificationToken(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const m = s.match(/content\s*=\s*["']([^"']+)["']/i);
    return m ? m[1].trim() : s;
  }

  /** Runtime layer — supplements build-time injection; scrapers still need baked HTML. */
  P.applySiteTelemetry = function (settings) {
    if (!settings) return;
    const sc = settings.searchConsole || {};
    ensureMeta('google-site-verification', normalizeVerificationToken(sc.google));
    ensureMeta('msvalidate.01', normalizeVerificationToken(sc.bing));
    ensureMeta('y_key', normalizeVerificationToken(sc.yahoo));

    const gtmOk = settings.gtmId && /^GTM-[A-Z0-9]+$/i.test(settings.gtmId) && !/GTM-(TEST|REBUILD|XXX|EXAMPLE)/i.test(settings.gtmId);
    const ga4Ok = settings.ga4Id && /^G-[A-Z0-9]+$/i.test(settings.ga4Id) && !/G-(TEST|REBUILD|XXX|EXAMPLE)/i.test(settings.ga4Id);
    if (gtmOk) injectGtm(settings.gtmId);
    else if (ga4Ok) injectGa4(settings.ga4Id);

    injectCustomHead(settings.customHeadHtml);
    (settings.headInjectionScripts || []).forEach(injectHeadScript);
    (settings.footerScripts || []).forEach((entry) => {
      if (!entry) return;
      const s = document.createElement('script');
      if (entry.src) s.src = entry.src;
      else if (entry.inline) s.textContent = entry.inline;
      else return;
      document.body.appendChild(s);
    });

    P._siteSettings = settings;
    global.dispatchEvent(new CustomEvent('urdfw:telemetry:ready', { detail: settings }));
  };

  P.loadSiteTelemetry = async function () {
    let settings = null;
    try {
      const staticRes = await fetch(P.resolveAsset('data/site-settings.json'));
      if (staticRes.ok) settings = await staticRes.json();
    } catch { /* ignore */ }

    if (P.apiConfig?.mode === 'remote' || global.location?.hostname?.includes('upperroomdfw')) {
      try {
        const apiRes = await fetch('/api/platform/site-settings/public');
        if (apiRes.ok) {
          const live = await apiRes.json();
          settings = { ...(settings || {}), ...live };
        }
      } catch { /* static CDN */ }
    }

    P.applySiteTelemetry(settings);
    return settings;
  };

  P.verifyTelemetryLocal = function () {
    const s = P._siteSettings || {};
    return {
      marker: !!document.querySelector('meta[name="google-site-verification"], meta[name="msvalidate.01"]') || document.documentElement.innerHTML.includes('urdfw-telemetry'),
      gtm: !s.gtmId || !!document.querySelector('script[src*="gtm.js"]'),
      ga4: !s.ga4Id || s.gtmId || !!document.querySelector('script[src*="gtag/js"]'),
      dataLayer: typeof global.dataLayer !== 'undefined',
    };
  };

  P.on('core:ready', () => {
    P.loadSiteTelemetry();
  });
})(window);