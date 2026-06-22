/**
 * Sync homepage hero stats with live /api/stats/public
 */
(function () {
  const SELECTORS = {
    churches: '[data-stat="churches"]',
    families: '[data-stat="families"]',
    events: '[data-stat="events"]',
    rating: '[data-stat="rating"]',
    reviews: '[data-stat="reviews"]',
    heroListings: '[data-stat="hero-listings"]',
    heroFamilies: '[data-stat="hero-families"]',
    directoryCount: '[data-stat="directory-count"]',
  };

  function setText(sel, value) {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = value;
    });
  }

  function formatNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  async function loadHomeStats() {
    try {
      const res = await fetch('/api/stats/public', { credentials: 'omit' });
      if (!res.ok) return;
      const s = await res.json();
      if (!s.ok) return;

      const churches = s.churches || 0;
      const families = s.familiesConnected || 0;
      const events = s.eventsThisMonth || 0;
      const rating = (s.averageRating || 4.8).toFixed(1);
      const reviews = s.reviewCount || 0;

      setText(SELECTORS.churches, formatNum(churches));
      setText(SELECTORS.families, formatNum(families));
      setText(SELECTORS.events, formatNum(events));
      setText(SELECTORS.rating, rating);
      setText(SELECTORS.reviews, formatNum(reviews) + '+');
      setText(SELECTORS.heroListings, churches + '+ VERIFIED LISTINGS');
      setText(SELECTORS.heroFamilies, formatNum(families) + '+ families found their home here.');
      setText(SELECTORS.directoryCount, churches + ' verified options');
    } catch {
      /* keep static fallback */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHomeStats);
  } else {
    loadHomeStats();
  }
})();