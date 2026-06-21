const bcrypt = require('bcryptjs');
const { uuid } = require('./utils');

function adminEmailList() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@upperroomdfw.com';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function displayName(email) {
  if (email === 'michaelk@tsbrenterprises.com') return 'Michael K — TSB Enterprises';
  if (email === 'theesaintmichael@gmail.com') return 'Michael — Admin';
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensureAdmins(db) {
  const emails = adminEmailList();
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(adminPass, 10);
  const now = new Date().toISOString();

  for (const email of emails) {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare(
        'INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), email, hash, displayName(email), 'admin', 1, now);
      console.log('[admins] Created admin:', email);
      continue;
    }
    db.prepare('UPDATE users SET role = ?, password_hash = ?, name = ? WHERE id = ?').run(
      'admin',
      hash,
      displayName(email),
      existing.id
    );
  }
}

module.exports = { ensureAdmins, adminEmailList };