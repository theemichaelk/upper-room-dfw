/**
 * Category 14: Bookmarks, collections, saved reviews/photos
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.getBookmarks = function (type) {
    const all = P.get('bookmarks', { listings: [], reviews: [], photos: [], links: [], authors: [] });
    return type ? all[type] || [] : all;
  };

  P.toggleBookmark = function (type, id, meta) {
    const all = P.get('bookmarks', { listings: [], reviews: [], photos: [], links: [], authors: [] });
    all[type] = all[type] || [];
    const idx = all[type].findIndex((b) => b.id === id);
    if (idx >= 0) {
      all[type].splice(idx, 1);
      P.set('bookmarks', all);
      P.emit('bookmark:removed', { type, id });
      return false;
    }
    all[type].push({ id, ...meta, savedAt: Date.now() });
    P.set('bookmarks', all);
    P.trackClick('bookmark', id, { type });
    P.emit('bookmark:added', { type, id });
    return true;
  };

  P.getCollections = function () {
    return P.get('collections', [{ id: 'default', name: 'My Collection', items: [] }]);
  };

  P.createCollection = function (name) {
    const cols = P.getCollections();
    const col = { id: P.uuid(), name, items: [], createdAt: Date.now() };
    cols.push(col);
    P.set('collections', cols);
    return col;
  };

  P.addToCollection = function (collectionId, item) {
    const cols = P.getCollections();
    const col = cols.find((c) => c.id === collectionId);
    if (col) {
      col.items.push({ ...item, addedAt: Date.now() });
      P.set('collections', cols);
    }
  };

  P.buildBookmarkLinks = function () {
    const links = P.getBookmarks('links');
    return links.map((l) => `<a href="${l.url}" class="block text-sm py-1">${l.title || l.url}</a>`).join('');
  };

  P.syncLegacySaved = function () {
    const legacy = localStorage.getItem('urdfw_saved');
    if (!legacy) return;
    try {
      const ids = JSON.parse(legacy);
      ids.forEach((id) => {
        if (!P.getBookmarks('listings').find((b) => b.id === id)) {
          P.toggleBookmark('listings', id, { source: 'legacy' });
        }
      });
    } catch { /* ignore */ }
  };

  P.on('core:ready', P.syncLegacySaved);
})(window);