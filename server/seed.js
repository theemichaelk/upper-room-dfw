const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { uuid, uniqueSlug } = require('./utils');

function seedIfNeeded(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM listings').get().c;
  if (count > 0) return;

  const churchesPath = path.join(__dirname, '..', 'data', 'churches.json');
  const churches = JSON.parse(fs.readFileSync(churchesPath, 'utf8'));

  const insertListing = db.prepare(`
    INSERT INTO listings (id, slug, name, area, category, description, full_description, phone, email, website, times, address, lat, lng, denomination, size, tags_json, image, status, featured, sticky, level, source, updated_at)
    VALUES (@id, @slug, @name, @area, @category, @description, @full_description, @phone, @email, @website, @times, @address, @lat, @lng, @denomination, @size, @tags_json, @image, @status, @featured, @sticky, @level, @source, @updated_at)
  `);

  const tx = db.transaction((items) => {
    for (const c of items) {
      insertListing.run({
        id: String(c.id),
        slug: c.slug || uniqueSlug(db, c.name),
        name: c.name,
        area: c.area,
        category: c.category,
        description: c.description,
        full_description: c.fullDescription || c.description,
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        times: c.times || '',
        address: c.address || '',
        lat: c.lat || null,
        lng: c.lng || null,
        denomination: c.denomination || '',
        size: c.size || '',
        tags_json: JSON.stringify(c.tags || []),
        image: c.image || 'images/10.jpg',
        status: 'live',
        featured: c.featured ? 1 : 0,
        sticky: 0,
        level: 'standard',
        source: 'seed',
        updated_at: new Date().toISOString(),
      });
    }
  });
  tx(churches);

  const coupons = db.prepare('SELECT COUNT(*) AS c FROM coupons').get().c;
  if (coupons === 0) {
    db.prepare('INSERT INTO coupons (code, discount, type, limit_count, used, expires) VALUES (?, ?, ?, ?, ?, ?)').run('DFW10', 10, 'percent', 100, 0, '2027-12-31');
    db.prepare('INSERT INTO coupons (code, discount, type, limit_count, used, expires) VALUES (?, ?, ?, ?, ?, ?)').run('CHURCH50', 50, 'fixed', 50, 0, '2026-12-31');
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@upperroomdfw.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), adminEmail, hash, 'Platform Admin', 'admin', 1, new Date().toISOString()
    );
  }

  const demoEmail = 'hello@thegrovearlington.org';
  const demoClient = db.prepare('SELECT id FROM clients WHERE email = ?').get(demoEmail);
  if (!demoClient) {
    const userId = uuid();
    const clientId = uuid();
    const hash = bcrypt.hashSync('demo1234', 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      userId, demoEmail, hash, 'The Grove Community Church', 'church-owner', 1, new Date().toISOString()
    );
    const listing = db.prepare('SELECT id FROM listings WHERE slug = ?').get('the-grove-community-church');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO clients (id, user_id, email, name, area, category, description, phone, website, times, package, status, trial_start, is_paid, listing_id, registered_at, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId, userId, demoEmail, 'The Grove Community Church', 'Arlington', 'Church',
      'A vibrant multi-generational church in Arlington.', '(817) 555-0192', 'https://thegrovearlington.org',
      'Sundays 9:00am & 11:00am', 'Premium', 'approved', now, 1, listing?.id || '1', now, JSON.stringify({ payments: [] })
    );
    if (listing) {
      db.prepare('UPDATE listings SET client_id = ?, email = ? WHERE id = ?').run(clientId, demoEmail, listing.id);
    }
  }

  console.log('[seed] Database seeded with', churches.length, 'listings');
}

/** Upsert new entries from churches.json (after bulk import or JSON updates). */
function syncListingsFromJson(db) {
  const churchesPath = path.join(__dirname, '..', 'data', 'churches.json');
  if (!fs.existsSync(churchesPath)) return 0;

  const churches = JSON.parse(fs.readFileSync(churchesPath, 'utf8'));
  const insertListing = db.prepare(`
    INSERT INTO listings (id, slug, name, area, category, description, full_description, phone, email, website, times, address, lat, lng, denomination, size, tags_json, image, status, featured, sticky, level, source, updated_at)
    VALUES (@id, @slug, @name, @area, @category, @description, @full_description, @phone, @email, @website, @times, @address, @lat, @lng, @denomination, @size, @tags_json, @image, @status, @featured, @sticky, @level, @source, @updated_at)
  `);
  const updateListing = db.prepare(`
    UPDATE listings SET name=@name, area=@area, category=@category, description=@description, full_description=@full_description,
      phone=@phone, email=@email, website=@website, times=@times, address=@address, lat=@lat, lng=@lng,
      denomination=@denomination, size=@size, tags_json=@tags_json, image=@image, featured=@featured, updated_at=@updated_at
    WHERE slug=@slug
  `);

  let added = 0;
  let updated = 0;
  const tx = db.transaction((items) => {
    for (const c of items) {
      const row = {
        id: String(c.id),
        slug: c.slug || uniqueSlug(db, c.name),
        name: c.name,
        area: c.area,
        category: c.category,
        description: c.description,
        full_description: c.fullDescription || c.description,
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        times: c.times || '',
        address: c.address || '',
        lat: c.lat || null,
        lng: c.lng || null,
        denomination: c.denomination || '',
        size: c.size || '',
        tags_json: JSON.stringify(c.tags || []),
        image: c.image || 'images/10.jpg',
        status: 'live',
        featured: c.featured ? 1 : 0,
        sticky: 0,
        level: 'standard',
        source: 'seed',
        updated_at: new Date().toISOString(),
      };
      const exists = db.prepare('SELECT id FROM listings WHERE slug = ?').get(row.slug);
      if (exists) {
        updateListing.run(row);
        updated++;
      } else {
        insertListing.run(row);
        added++;
      }
    }
  });
  tx(churches);
  if (added || updated) console.log('[seed] Synced listings: +' + added + ' new, ~' + updated + ' updated');
  return added;
}

module.exports = { seedIfNeeded, syncListingsFromJson };