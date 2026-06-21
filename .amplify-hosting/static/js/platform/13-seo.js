/**
 * Category 13: SEO, translation, Polylang/Loco/Google Translate, reCAPTCHA
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.applySEO = function (meta) {
    if (meta.title) document.title = meta.title;
    const setMeta = (name, content, prop) => {
      if (!content) return;
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement('meta'); if (prop) el.setAttribute('property', name); else el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('description', meta.description);
    setMeta('keywords', meta.keywords);
    setMeta('og:title', meta.title, true);
    setMeta('og:description', meta.description, true);
    if (meta.canonical) {
      let link = document.querySelector('link[rel=canonical]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = meta.canonical;
    }
  };

  P.initGoogleTranslate = function () {
    if (document.getElementById('google-translate-element')) return;
    const div = document.createElement('div');
    div.id = 'google-translate-element';
    div.className = 'fixed top-20 right-4 z-[9998] text-xs';
    document.body.appendChild(div);
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: 'en,es,ar,fr,ko' }, 'google-translate-element');
    };
    const s = document.createElement('script');
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(s);
  };

  P.initRecaptcha = function (container) {
    if (!container) return;
    container.innerHTML = `<div class="urdfw-recaptcha border rounded px-3 py-2 text-xs bg-slate-50 flex items-center gap-2">
      <input type="checkbox" id="recaptcha-demo"> <label for="recaptcha-demo">I'm not a robot (demo reCAPTCHA)</label></div>`;
    return container.querySelector('#recaptcha-demo');
  };

  P.verifyRecaptcha = function () {
    const cb = document.getElementById('recaptcha-demo');
    return !cb || cb.checked;
  };

  P.polylangGetUrl = function (lang, path) {
    const base = path || location.pathname;
    return base + (base.includes('?') ? '&' : '?') + 'lang=' + lang;
  };

  P.locoExport = function () {
    return JSON.stringify({ en: P.i18n, source: 'urdfw-platform' }, null, 2);
  };

  P.on('lang:change', () => {
    document.querySelectorAll('[data-polylang]').forEach((el) => {
      const key = el.getAttribute('data-polylang');
      el.textContent = P.t(key, el.textContent);
    });
  });
})(window);