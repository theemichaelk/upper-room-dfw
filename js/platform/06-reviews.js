/**
 * Category 6: Reviews, ratings, voting, comments
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.getReviews = function (listingId) {
    const all = P.get('reviews', {});
    return all[listingId] || [];
  };

  P.addReview = function (listingId, review) {
    const all = P.get('reviews', {});
    all[listingId] = all[listingId] || [];
    const r = {
      id: P.uuid(),
      listingId,
      author: review.author || 'Guest',
      email: review.email || '',
      stars: Math.min(5, Math.max(1, review.stars || 5)),
      criteria: review.criteria || {
        worship: review.criteria?.worship || review.stars || 5,
        community: review.criteria?.community || review.stars || 5,
        teaching: review.criteria?.teaching || review.stars || 5,
        facilities: review.criteria?.facilities || review.stars || 5,
      },
      text: review.text || '',
      photos: review.photos || [],
      upvotes: 0,
      createdAt: new Date().toISOString(),
    };
    all[listingId].unshift(r);
    P.set('reviews', all);
    P.updateListingRating(listingId);
    P.emit('review:added', r);
    return r;
  };

  P.updateListingRating = function (listingId) {
    const reviews = P.getReviews(listingId);
    const meta = P.get('listing_meta', {});
    meta[listingId] = meta[listingId] || {};
    if (reviews.length) {
      meta[listingId].rating = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
      meta[listingId].reviewCount = reviews.length;
    }
    P.set('listing_meta', meta);
  };

  P.upvoteReview = function (listingId, reviewId, icon) {
    const votes = P.get('review_votes', {});
    const key = listingId + ':' + reviewId;
    if (votes[key]) return false;
    votes[key] = { icon: icon || 'thumbs-up', at: Date.now() };
    P.set('review_votes', votes);
    const all = P.get('reviews', {});
    const rev = (all[listingId] || []).find((r) => r.id === reviewId);
    if (rev) { rev.upvotes = (rev.upvotes || 0) + 1; P.set('reviews', all); }
    return true;
  };

  P.getComments = function (listingId) {
    const all = P.get('comments', {});
    return all[listingId] || [];
  };

  P.addComment = function (listingId, text, author) {
    const all = P.get('comments', {});
    all[listingId] = all[listingId] || [];
    const c = { id: P.uuid(), text, author: author || 'Guest', createdAt: new Date().toISOString() };
    all[listingId].push(c);
    P.set('comments', all);
    return c;
  };

  P.renderStars = function (rating, max) {
    max = max || 5;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let html = '';
    for (let i = 0; i < max; i++) {
      if (i < full) html += '<i class="fa-solid fa-star"></i>';
      else if (i === full && half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
      else html += '<i class="fa-regular fa-star"></i>';
    }
    return `<span class="urdfw-stars">${html}</span>`;
  };

  P.renderReviewForm = function (container, listingId) {
    if (!container) return;
    container.innerHTML = `
      <form id="urdfw-review-form" class="space-y-3 text-sm border rounded-xl p-4 bg-white">
        <div class="font-semibold">Write a Review</div>
        <div class="grid grid-cols-2 gap-2 urdfw-review-criteria">
          ${['worship', 'community', 'teaching', 'facilities'].map((c) => `
            <label>${c}: <select name="${c}" class="border rounded px-1"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>`).join('')}
        </div>
        <input name="author" placeholder="Your name" class="w-full border rounded px-3 py-2" required>
        <textarea name="text" rows="3" placeholder="Your review..." class="w-full border rounded px-3 py-2" required></textarea>
        <label class="text-xs">Add photo URL: <input name="photo" class="w-full border rounded px-2 py-1 mt-1"></label>
        <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-lg text-sm">Submit Review</button>
      </form>`;
    container.querySelector('#urdfw-review-form').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const criteria = {};
      ['worship', 'community', 'teaching', 'facilities'].forEach((c) => { criteria[c] = +fd.get(c); });
      const stars = Math.round(Object.values(criteria).reduce((a, b) => a + b, 0) / 4);
      P.addReview(listingId, {
        author: fd.get('author'),
        text: fd.get('text'),
        stars,
        criteria,
        photos: fd.get('photo') ? [fd.get('photo')] : [],
      });
      e.target.reset();
      P.emit('reviews:refresh', listingId);
      if (global.showToast) global.showToast('Review submitted!');
    };
  };
})(window);