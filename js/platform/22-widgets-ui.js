/**
 * Header banner, sidebar widget HTML, smart newsletter popup.
 * Popup: brand logo, benefits list, email form.
 * Reveal: requestIdleCallback + Intersection Observer (non-blocking).
 * Auto-close: fades unless user engages (mousemove, keydown, touchstart, click).
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const LS_DISMISS = 'urdfw_nl_dismissed_at';
  const LS_SUBSCRIBED = 'urdfw_nl_subscribed';
  const LOGO_PATH = 'images/logo-upper-room-dfw.png';

  function isPortalPage() {
    const path = (location.pathname || '').toLowerCase();
    return path.includes('admin') || path.includes('member-dashboard') || path.includes('billing-hub');
  }

  function scheduleIdle(fn) {
    if (typeof global.requestIdleCallback === 'function') {
      global.requestIdleCallback(fn, { timeout: 2000 });
    } else {
      global.setTimeout(fn, 0);
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Prefer logo already in the nav (works on /blog/ nested pages); else root-absolute path. */
  function resolveBrandLogoSrc(cfg) {
    if (cfg && cfg.logoUrl) return String(cfg.logoUrl);
    const fromDom = document.querySelector('img.urdfw-brand-logo, nav img[src*="logo-upper-room"]');
    if (fromDom) {
      const src = fromDom.getAttribute('src');
      if (src) return src;
    }
    try {
      return new URL('/' + LOGO_PATH, location.origin).pathname;
    } catch (e) {
      return '/' + LOGO_PATH;
    }
  }

  P.injectHeaderBanner = function (html) {
    if (!html || document.getElementById('urdfw-header-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'urdfw-header-banner';
    bar.className = 'urdfw-header-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Site announcement');
    bar.innerHTML = '<div class="urdfw-header-banner__inner">' + html + '</div>';
    const nav = document.querySelector('nav, header');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav);
    else document.body.insertBefore(bar, document.body.firstChild);
  };

  P.injectSidebarWidgets = function (html) {
    if (!html) return;
    let host = document.getElementById('urdfw-sidebar-widgets');
    if (!host) {
      host = document.createElement('aside');
      host.id = 'urdfw-sidebar-widgets';
      host.className = 'urdfw-sidebar-widgets urdfw-sidebar-widgets--multi';
      host.setAttribute('aria-label', 'Sidebar widgets');

      const main = document.querySelector('main, .max-w-screen-2xl, .max-w-6xl, .max-w-4xl');
      if (main && main.parentNode) {
        const wrap = document.createElement('div');
        wrap.className = 'urdfw-page-with-sidebar';
        main.parentNode.insertBefore(wrap, main);
        wrap.appendChild(main);
        wrap.appendChild(host);
      } else {
        document.body.appendChild(host);
      }
    }
    // Append remote widgets; never wipe existing blog sidebar cards
    const card = document.createElement('div');
    card.className = 'urdfw-widget-card urdfw-sidebar-injected';
    card.innerHTML = html;
    host.appendChild(card);
  };

  function daysSince(ts) {
    if (!ts) return Infinity;
    return (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
  }

  function shouldShowPopup(cfg) {
    if (!cfg?.enabled || isPortalPage()) return false;
    if (document.body?.classList.contains('urdfw-404-page')) return false;
    if (localStorage.getItem(LS_SUBSCRIBED)) return false;
    const dismissed = localStorage.getItem(LS_DISMISS);
    if (dismissed && daysSince(dismissed) < (cfg.dismissDays || 7)) return false;
    const lastShown = P.get('nl_popup_shown_at', null);
    if (lastShown && daysSince(lastShown) < (cfg.frequencyDays || 14)) return false;
    return true;
  }

  /**
   * Non-blocking reveal gate: requestIdleCallback schedules async 5s delay,
   * then Intersection Observer on a scroll sentinel (max 2.5s grace if no scroll).
   */
  function waitForRevealSignal(cfg) {
    const showDelayMs = cfg.delayMs ?? 5000;
    const scrollPct = cfg.scrollPercent ?? 40;
    const scrollGraceMs = cfg.scrollGraceMs ?? 2500;

    return new Promise((resolve) => {
      global.setTimeout(() => {
        if (!('IntersectionObserver' in global)) {
          resolve();
          return;
        }

        const sentinel = document.createElement('div');
        sentinel.id = 'urdfw-nl-io-sentinel';
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.className = 'urdfw-nl-io-sentinel';

        let done = false;
        let io = null;
        let graceTimer = null;
        const finish = () => {
          if (done) return;
          done = true;
          if (graceTimer != null) global.clearTimeout(graceTimer);
          io?.disconnect();
          global.removeEventListener('resize', placeSentinel);
          sentinel.remove();
          resolve();
        };

        const placeSentinel = () => {
          const docH = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            1
          );
          sentinel.style.top = Math.round((scrollPct / 100) * docH) + 'px';
          if (!sentinel.parentNode) document.body.appendChild(sentinel);
        };

        placeSentinel();
        global.addEventListener('resize', placeSentinel, { passive: true });

        io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) finish();
        }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0 });

        io.observe(sentinel);

        graceTimer = global.setTimeout(finish, scrollGraceMs);

        requestAnimationFrame(() => {
          const rect = sentinel.getBoundingClientRect();
          if (rect.top <= global.innerHeight * 0.92) finish();
        });
      }, showDelayMs);
    });
  }

  P.initNewsletterPopup = function (cfg) {
    if (!shouldShowPopup(cfg)) return;
    if (document.getElementById('urdfw-nl-popup')) return;

    const autoCloseMs = cfg.autoCloseMs ?? 5000;
    let popup = null;
    let autoCloseTimer = null;
    let engaged = false;
    let teardownEngagement = null;

    function clearAutoCloseTimer() {
      if (autoCloseTimer != null) {
        global.clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
    }

    function markEngaged() {
      if (engaged) return;
      engaged = true;
      clearAutoCloseTimer();
    }

    function bindEngagementListeners(el) {
      const events = ['mousemove', 'keydown', 'touchstart', 'click'];
      const handler = (e) => {
        if (!popup) return;
        if (e.type === 'keydown' && !popup.contains(e.target)) return;
        markEngaged();
      };

      events.forEach((evt) => el.addEventListener(evt, handler, { passive: evt !== 'keydown' }));

      return () => {
        events.forEach((evt) => el.removeEventListener(evt, handler));
      };
    }

    function startAutoCloseTimer() {
      clearAutoCloseTimer();
      autoCloseTimer = global.setTimeout(() => {
        if (!engaged && popup) hide(false);
      }, autoCloseMs);
    }

    function hide(dismiss) {
      if (!popup) return;
      clearAutoCloseTimer();
      teardownEngagement?.();
      teardownEngagement = null;
      popup.classList.remove('is-visible');
      popup.classList.add('is-fading');
      if (dismiss) localStorage.setItem(LS_DISMISS, String(Date.now()));
      global.setTimeout(() => {
        popup?.remove();
        popup = null;
      }, 320);
    }

    function revealPopup() {
      if (!shouldShowPopup(cfg) || popup) return;

      const logoSrc = resolveBrandLogoSrc(cfg);
      const title = escHtml(cfg.title || 'Join the Upper Room list');
      const subtitle = escHtml(
        cfg.subtitle ||
          'Welcome email, weekly DFW faith digest, news, directory updates, and occasional discounts—free, anytime unsubscribe.'
      );

      popup = document.createElement('div');
      popup.id = 'urdfw-nl-popup';
      popup.className = 'urdfw-nl-popup';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-modal', 'true');
      popup.setAttribute('aria-labelledby', 'urdfw-nl-title');
      popup.innerHTML = `
        <div class="urdfw-nl-popup__card">
          <button type="button" class="urdfw-nl-popup__close" aria-label="Close newsletter popup">&times;</button>
          <div class="urdfw-nl-popup__brand">
            <img class="urdfw-nl-popup__logo" src="${escHtml(logoSrc)}" alt="Upper Room DFW" width="72" height="72" decoding="async">
            <p class="urdfw-nl-popup__brand-name">Upper Room DFW</p>
          </div>
          <h2 id="urdfw-nl-title" class="urdfw-nl-popup__title">${title}</h2>
          <p class="urdfw-nl-popup__subtitle">${subtitle}</p>
          <ul class="urdfw-nl-popup__perks">
            <li><span class="urdfw-nl-popup__check" aria-hidden="true">✓</span> Welcome email when you join</li>
            <li><span class="urdfw-nl-popup__check" aria-hidden="true">✓</span> Weekly DFW faith &amp; church digest</li>
            <li><span class="urdfw-nl-popup__check" aria-hidden="true">✓</span> News, updates &amp; directory tips</li>
            <li><span class="urdfw-nl-popup__check" aria-hidden="true">✓</span> Occasional discounts &amp; invites</li>
          </ul>
          <form class="urdfw-nl-popup__form urdfw-nl-popup__form--row" id="urdfw-nl-popup-form">
            <label class="urdfw-nl-popup__sr" for="urdfw-nl-email">Email address</label>
            <input id="urdfw-nl-email" type="email" name="email" required placeholder="you@email.com" autocomplete="email" inputmode="email">
            <button type="submit">Subscribe free</button>
          </form>
          <button type="button" class="urdfw-nl-popup__dismiss">Not now</button>
        </div>`;
      document.body.appendChild(popup);

      const logoImg = popup.querySelector('.urdfw-nl-popup__logo');
      if (logoImg) {
        logoImg.addEventListener('error', () => {
          logoImg.style.display = 'none';
        });
      }

      popup.querySelector('.urdfw-nl-popup__close').addEventListener('click', () => hide(true));
      popup.querySelector('.urdfw-nl-popup__dismiss').addEventListener('click', () => hide(true));
      popup.addEventListener('click', (e) => {
        if (e.target === popup) hide(true);
      });
      popup.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          hide(true);
        }
      });

      popup.querySelector('#urdfw-nl-popup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        markEngaged();
        const email = new FormData(e.target).get('email');
        const btn = e.target.querySelector('button[type="submit"]');
        if (!email || !btn) return;
        btn.disabled = true;
        btn.textContent = 'Subscribing…';
        try {
          if (P.api?.integrations?.subscribe) await P.api.integrations.subscribe(email);
          else if (global.subscribeNewsletter) {
            await global.subscribeNewsletter({ preventDefault() {}, target: e.target });
          } else {
            const res = await fetch('/api/integrations/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error('Subscription failed');
          }
          localStorage.setItem(LS_SUBSCRIBED, '1');
          hide(false);
          if (P.portalToast) P.portalToast('Subscribed — thank you!');
          else if (global.showToast) global.showToast('Subscribed — thank you!');
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Subscribe free';
          const msg = (err && err.message) || 'Subscription failed';
          if (P.portalToast) P.portalToast(msg);
          else alert(msg);
        }
      });

      requestAnimationFrame(() => {
        popup.classList.add('is-visible');
        P.set('nl_popup_shown_at', Date.now());
        teardownEngagement = bindEngagementListeners(popup);
        startAutoCloseTimer();
        const emailInput = popup.querySelector('#urdfw-nl-email');
        if (emailInput) {
          try { emailInput.focus({ preventScroll: true }); } catch (e) { emailInput.focus(); }
        }
      });
    }

    scheduleIdle(() => {
      if (!shouldShowPopup(cfg)) return;
      waitForRevealSignal(cfg).then(() => {
        if (shouldShowPopup(cfg)) revealPopup();
      });
    });
  };

  P.initSiteWidgets = function (settings) {
    if (!settings) return;
    if (settings.headerBannerHtml) P.injectHeaderBanner(settings.headerBannerHtml);
    if (settings.sidebarWidgetHtml) P.injectSidebarWidgets(settings.sidebarWidgetHtml);
    if (settings.newsletterPopup) P.initNewsletterPopup(settings.newsletterPopup);
  };

  global.addEventListener('urdfw:telemetry:ready', (e) => {
    P.initSiteWidgets(e.detail);
  });
})(window);