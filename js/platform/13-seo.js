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
    div.className = 'urdfw-translate-widget z-[9998] text-xs';
    document.body.appendChild(div);
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: 'en,es,ar,fr,ko' }, 'google-translate-element');
    };
    const s = document.createElement('script');
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(s);
  };

  P.recaptchaSiteKey = '';
  P._recaptchaConfig = null;

  P.loadRecaptchaConfig = function () {
    if (!P._recaptchaConfig) {
      P._recaptchaConfig = fetch('/api/config')
        .then((r) => r.json())
        .then((cfg) => {
          P.recaptchaSiteKey = cfg.recaptchaSiteKey || '';
          return P.recaptchaSiteKey;
        })
        .catch(() => '');
    }
    return P._recaptchaConfig;
  };

  P.initRecaptcha = function (container) {
    if (!container) return;
    P.loadRecaptchaConfig().then((siteKey) => {
      if (!siteKey) {
        container.innerHTML = `<div class="urdfw-recaptcha border rounded px-3 py-2 text-xs bg-slate-50 flex items-center gap-2">
          <input type="checkbox" id="recaptcha-demo"> <label for="recaptcha-demo">I'm not a robot (demo reCAPTCHA)</label></div>`;
        return;
      }
      container.innerHTML = '<div class="g-recaptcha"></div>';
      const render = () => {
        if (!window.grecaptcha) return;
        const el = container.querySelector('.g-recaptcha');
        if (el && !el.dataset.rendered) {
          grecaptcha.render(el, { sitekey: siteKey });
          el.dataset.rendered = '1';
        }
      };
      if (window.grecaptcha) {
        render();
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    });
  };

  P.getRecaptchaToken = function () {
    if (!P.recaptchaSiteKey) return null;
    return window.grecaptcha ? grecaptcha.getResponse() : null;
  };

  P.verifyRecaptcha = function () {
    if (!P.recaptchaSiteKey) {
      const cb = document.getElementById('recaptcha-demo');
      return !cb || cb.checked;
    }
    return !!P.getRecaptchaToken();
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