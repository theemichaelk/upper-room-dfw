const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

function slugify(name) {
  return (name || 'listing')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'listing';
}

function uniqueSlug(db, base) {
  let slug = slugify(base);
  let n = 0;
  while (db.prepare('SELECT 1 FROM listings WHERE slug = ?').get(slug)) {
    n += 1;
    slug = slugify(base) + '-' + n;
  }
  return slug;
}

function clientToApi(row) {
  if (!row) return null;
  const extra = row.data_json ? JSON.parse(row.data_json) : {};
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    area: row.area,
    category: row.category,
    description: row.description,
    phone: row.phone,
    website: row.website,
    times: row.times,
    denomination: row.denomination,
    package: row.package,
    status: row.status,
    trialStart: row.trial_start,
    isPaid: !!row.is_paid,
    listingId: row.listing_id,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionStatus: row.subscription_status,
    registeredAt: row.registered_at,
    payments: extra.payments || [],
    keywords: extra.keywords || [],
    ...extra,
  };
}

function listingToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    slug: row.slug,
    name: row.name,
    area: row.area,
    category: row.category,
    description: row.description,
    fullDescription: row.full_description || row.description,
    phone: row.phone,
    email: row.email,
    website: row.website,
    times: row.times,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    denomination: row.denomination,
    size: row.size,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    image: row.image,
    status: row.status,
    featured: !!row.featured,
    sticky: !!row.sticky,
    level: row.level,
    source: row.source,
  };
}

function leadToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    listingId: row.listing_id,
    churchEmail: row.church_email,
    church_email: row.church_email,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function claimToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    listingId: row.listing_id,
    listing_id: row.listing_id,
    proof: row.proof,
    paid: !!row.paid,
    status: row.status,
    createdAt: row.created_at,
    at: row.created_at,
  };
}

function reviewToApi(row) {
  if (!row) return null;
  let criteria = {};
  try { criteria = row.criteria_json ? JSON.parse(row.criteria_json) : {}; } catch { /* ignore */ }
  return {
    id: row.id,
    listingId: row.listing_id,
    author: row.author,
    email: row.email,
    stars: row.stars,
    text: row.text,
    criteria,
    status: row.status,
    createdAt: row.created_at,
  };
}

module.exports = { uuid, slugify, uniqueSlug, clientToApi, listingToApi, leadToApi, claimToApi, reviewToApi };