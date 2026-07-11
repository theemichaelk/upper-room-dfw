/**
 * Global site shell — responsive nav, footer states, saved count, active links.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  function updateSavedCount() {
    const el = document.getElementById('saved-count');
    if (!el) return;
    let n = 0;
    try {
      const raw = localStorage.getItem('urdfw_saved');
      if (raw) n = JSON.parse(raw).length;
    } catch { /* ignore */ }
    if (!n) {
      const bookmarks = P.get?.('bookmarks', { listings: [] });
      n = bookmarks?.listings?.length || 0;
    }
    el.textContent = String(n);
  }

  function bindMobileNav() {
    const ham = document.getElementById('mobile-hamburger');
    const mob = document.getElementById('mobile-menu');
    if (!ham || !mob || ham.dataset.bound) return;
    ham.dataset.bound = '1';
    ham.setAttribute('aria-expanded', 'false');
    ham.addEventListener('click', () => {
      const open = mob.classList.toggle('hidden') === false;
      ham.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mob.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mob.classList.add('hidden');
        ham.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function markActiveNav() {
    const path = (location.pathname || '').split('/').pop() || 'index.html';
    const current = path === '' ? 'index.html' : path;
    document.querySelectorAll('nav a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').split('?')[0];
      const isActive = href === current || (current === '404.html' && href === 'index.html');
      a.classList.toggle('text-[#0369a1]', isActive);
      a.classList.toggle('font-semibold', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function bindSavedButton() {
    document.querySelectorAll('[data-urdfw-saved-btn]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        if (global.showSavedChurches) global.showSavedChurches();
        else location.href = 'directory.html?saved=true';
      });
    });
  }

  P.initSiteShell = function () {
    bindMobileNav();
    bindSavedButton();
    updateSavedCount();
    markActiveNav();
    P.injectPoweredByFooter?.();
    global.addEventListener('storage', updateSavedCount);
    P.on?.('bookmark:added', updateSavedCount);
    P.on?.('bookmark:removed', updateSavedCount);
  };

  P.on('core:ready', () => {
    const useShell = document.body.dataset.urdfwShell === 'global'
      || document.body.classList.contains('urdfw-404-page')
      || document.querySelector('nav[data-urdfw-shell="global"]');
    if (useShell) P.initSiteShell();
  });
})(window);