/**
 * Category 3: Listings, submissions, claims, packages, levels
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.submitListing = function (data, options) {
    options = options || {};
    const listing = {
      id: P.uuid(),
      slug: (data.name || 'listing').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      ...data,
      status: options.paid ? 'pending-payment' : (options.autoApprove ? 'approved' : 'pending'),
      level: data.package || 'free',
      submittedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (options.durationDays || 365) * 86400000).toISOString(),
      featured: data.featured || false,
      sticky: data.sticky || false,
      vip: data.vip || false,
      paid: options.paid || false,
      linkCount: data.linkCount || 1,
    };
    const customs = P.get('custom_listings', []);
    customs.unshift(listing);
    P.set('custom_listings', customs);
    P.emit('listing:submitted', listing);
    return listing;
  };

  P.claimListing = function (listingId, claimData, paid) {
    const claims = P.get('claims', []);
    const claim = {
      id: P.uuid(),
      listingId,
      ...claimData,
      status: paid ? 'pending-payment' : 'pending',
      paidClaim: !!paid,
      createdAt: new Date().toISOString(),
    };
    claims.push(claim);
    P.set('claims', claims);
    P.emit('listing:claimed', claim);
    return claim;
  };

  P.upgradeListing = function (listingId, newLevel) {
    const meta = P.get('listing_meta', {});
    meta[listingId] = meta[listingId] || {};
    meta[listingId].level = newLevel;
    meta[listingId].featured = ['standard', 'premium', 'vip'].includes(newLevel);
    meta[listingId].sticky = ['premium', 'vip'].includes(newLevel);
    meta[listingId].vip = newLevel === 'vip';
    meta[listingId].upgradedAt = new Date().toISOString();
    P.set('listing_meta', meta);
    P.emit('listing:upgraded', { listingId, newLevel });
  };

  P.renewListing = function (listingId, days) {
    const meta = P.get('listing_meta', {});
    meta[listingId] = meta[listingId] || {};
    meta[listingId].expiresAt = new Date(Date.now() + (days || 30) * 86400000).toISOString();
    P.set('listing_meta', meta);
  };

  P.markFeatured = function (listingId, featured) {
    const meta = P.get('listing_meta', {});
    meta[listingId] = meta[listingId] || {};
    meta[listingId].featured = featured;
    P.set('listing_meta', meta);
  };

  P.getPackage = function (id) {
    return (P.config?.packages || []).find((p) => p.id === id);
  };

  P.canSubmitAtLevel = function (level, linkCount) {
    const pkg = P.getPackage(level);
    if (!pkg) return true;
    return linkCount <= (pkg.maxLinks || 1);
  };

  P.mergeListings = function (baseListings) {
    const customs = P.get('custom_listings', []);
    const seen = new Set(baseListings.map((l) => l.slug || l.id));
    const merged = [...baseListings];
    customs.forEach((c) => {
      if (!seen.has(c.slug) && !seen.has(c.id)) merged.unshift(P.enhanceListing(c));
    });
    return merged;
  };
})(window);