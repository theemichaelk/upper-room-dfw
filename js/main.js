// Upper Room DFW - Shared JS for multi-file static site
// Handles global nav, saved churches (localStorage), toasts, and common utilities

window.URDFW = window.URDFW || {};

let savedChurches = new Set();

function loadSavedChurches() {
  const saved = localStorage.getItem('urdfw_saved');
  if (saved) {
    savedChurches = new Set(JSON.parse(saved));
  }
  updateSavedCount();
}

function saveSavedChurches() {
  localStorage.setItem('urdfw_saved', JSON.stringify(Array.from(savedChurches)));
  updateSavedCount();
}

function updateSavedCount() {
  const countEl = document.getElementById('saved-count');
  if (countEl) {
    countEl.textContent = savedChurches.size;
  }
}

function toggleSaveChurch(id, event) {
  if (event) event.stopImmediatePropagation();
  
  if (savedChurches.has(id)) {
    savedChurches.delete(id);
  } else {
    savedChurches.add(id);
  }
  saveSavedChurches();
  
  // Update any visible bookmark icons on the page
  document.querySelectorAll(`[data-church-id="${id}"]`).forEach(el => {
    const isSaved = savedChurches.has(id);
    el.classList.toggle('text-amber-600', isSaved);
    el.classList.toggle('bg-amber-50', isSaved);
    el.classList.toggle('text-slate-500', !isSaved);
    el.classList.toggle('hover:bg-slate-100', !isSaved);
    const icon = el.querySelector('i');
    if (icon) icon.classList.toggle('fa-bookmark', true);
  });
}

function showSavedChurches() {
  // Navigate to directory page with saved filter
  if (window.location.pathname.includes('directory.html')) {
    // Already on directory - trigger filter
    if (typeof window.filterToSaved === 'function') {
      window.filterToSaved();
    }
  } else {
    window.location.href = 'directory.html?saved=true';
  }
}

function showToast(message, duration = 3800) {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-5 right-5 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm shadow-2xl flex items-center gap-x-2 z-[200]`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.parentNode && toast.parentNode.removeChild(toast), 300);
  }, duration);
}

function fakeAction(title, detail) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-6';
  modal.innerHTML = `
    <div class="bg-white max-w-sm w-full rounded-3xl p-7 shadow">
      <div class="text-xl font-semibold mb-2">${title}</div>
      <p class="text-sm text-slate-600">${detail}</p>
      <button onclick="this.closest('.fixed').remove()" class="mt-6 w-full py-3 bg-indigo-900 text-white text-sm font-semibold rounded-2xl">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function subscribeNewsletter(e) {
  e.preventDefault();
  const input = document.getElementById('newsletter-email');
  if (!input) return;
  const email = input.value.trim();
  if (!email) return;

  const syncIntegrations = () => {
    if (window.URDFWPlatform?.api?.integrations?.subscribe) {
      window.URDFWPlatform.api.integrations.subscribe(email);
    } else {
      let subs = JSON.parse(localStorage.getItem('urdfw_subscribers') || '[]');
      if (!subs.includes(email)) subs.push(email);
      localStorage.setItem('urdfw_subscribers', JSON.stringify(subs));
    }
  };
  syncIntegrations();
  setTimeout(syncIntegrations, 1200);

  const form = e.target;
  const originalText = form.innerHTML;
  form.innerHTML = `<span class="font-semibold">Thank you! You're subscribed.</span>`;
  
  setTimeout(() => {
    showToast(`Welcome! We'll send the next DFW faith digest to ${email}.`);
    input.value = '';
    form.innerHTML = originalText;
  }, 1400);
}

// Login dropdown: click to choose Member vs Admin (hover-only was broken on click/touch)
function initLoginDropdowns() {
  const closeAll = () => {
    document.querySelectorAll('.login-dropdown.login-open').forEach((wrapper) => {
      wrapper.classList.remove('login-open');
      const trigger = wrapper.querySelector(':scope > a, :scope > button.login-dropdown-btn');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  };

  document.querySelectorAll('.relative.group').forEach((wrapper) => {
    const trigger = wrapper.querySelector(':scope > a, :scope > button.login-dropdown-btn');
    const menu = wrapper.querySelector(':scope > .absolute');
    if (!trigger || !menu) return;
    if (!/login/i.test(trigger.textContent)) return;
    const menuLinks = menu.querySelectorAll('a[href]');
    if (menuLinks.length < 2) return;

    wrapper.classList.add('login-dropdown');
    const loginHref =
      (trigger.tagName === 'A' && trigger.getAttribute('href') && trigger.getAttribute('href') !== '#')
        ? trigger.getAttribute('href')
        : 'member-dashboard.html';
    if (trigger.tagName === 'A') {
      trigger.dataset.loginHref = loginHref;
      trigger.setAttribute('href', '#');
    }
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !wrapper.classList.contains('login-open');
      closeAll();
      if (willOpen) {
        wrapper.classList.add('login-open');
        trigger.setAttribute('aria-expanded', 'true');
      } else if (loginHref && loginHref !== '#') {
        window.location.href = loginHref;
      }
    });

    menuLinks.forEach((link) => {
      link.addEventListener('click', () => closeAll());
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.login-dropdown')) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}

// Global mobile menu (works on all pages)
function initMobileMenu() {
  const hamburger = document.getElementById('mobile-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

// Keyboard shortcut "/" to focus search if present
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName === 'BODY') {
      const search = document.getElementById('search-input');
      if (search) {
        e.preventDefault();
        search.focus();
        search.select();
      }
    }
  });
}

function initGlobal() {
  loadSavedChurches();
  initLoginDropdowns();
  initMobileMenu();
  initKeyboardShortcuts();
  
  // Update any initial saved counts
  updateSavedCount();
  
  // Make helpers globally available
  window.toggleSaveChurch = toggleSaveChurch;
  window.showSavedChurches = showSavedChurches;
  window.showToast = showToast;
  window.fakeAction = fakeAction;
  window.subscribeNewsletter = subscribeNewsletter;
  
  // Console helper
  console.log('%c[Upper Room DFW] Multi-file static site loaded. Data in data/churches.json', 'color:#64748b');
}

document.addEventListener('DOMContentLoaded', initGlobal);