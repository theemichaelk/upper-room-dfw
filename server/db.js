const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'urdfw.db');

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function initDb() {
  ensureDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'church-owner',
      email_verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      area TEXT,
      category TEXT,
      description TEXT,
      phone TEXT,
      website TEXT,
      times TEXT,
      denomination TEXT,
      package TEXT DEFAULT 'Free',
      status TEXT DEFAULT 'pending',
      trial_start TEXT,
      is_paid INTEGER DEFAULT 0,
      listing_id TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT,
      registered_at TEXT NOT NULL,
      data_json TEXT
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      area TEXT,
      category TEXT,
      description TEXT,
      full_description TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      times TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      denomination TEXT,
      size TEXT,
      tags_json TEXT,
      image TEXT,
      status TEXT DEFAULT 'live',
      featured INTEGER DEFAULT 0,
      sticky INTEGER DEFAULT 0,
      level TEXT DEFAULT 'standard',
      source TEXT DEFAULT 'seed',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      email TEXT,
      gateway TEXT,
      amount REAL,
      plan TEXT,
      status TEXT,
      ref TEXT,
      coupon TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      client_id TEXT,
      amount REAL,
      plan TEXT,
      gateway TEXT,
      status TEXT,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      church_email TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      from_name TEXT,
      subject TEXT,
      body TEXT,
      read_flag INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      topic TEXT,
      message TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      listing_id TEXT,
      proof TEXT,
      paid INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      author TEXT,
      email TEXT,
      stars INTEGER DEFAULT 5,
      text TEXT,
      criteria_json TEXT,
      status TEXT DEFAULT 'published',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_progress (
      user_id TEXT PRIMARY KEY,
      client_id TEXT,
      completed_json TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      listing_id TEXT,
      name TEXT,
      mime_type TEXT,
      s3_key TEXT,
      url TEXT,
      kind TEXT DEFAULT 'image',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount REAL,
      type TEXT,
      limit_count INTEGER,
      used INTEGER DEFAULT 0,
      expires TEXT
    );

    CREATE TABLE IF NOT EXISTS integration_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      provider TEXT,
      status TEXT,
      email TEXT,
      at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      events_json TEXT NOT NULL DEFAULT '["*"]',
      label TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id TEXT,
      event TEXT,
      status TEXT,
      at TEXT NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      payload_json TEXT,
      at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS short_links (
      id TEXT PRIMARY KEY,
      target_url TEXT NOT NULL,
      tiny_url TEXT,
      alias TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      name TEXT NOT NULL,
      domain TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'client',
      hosted_zone_id TEXT,
      status TEXT DEFAULT 'active',
      cloudfront_domain TEXT,
      amplify_domain TEXT,
      source TEXT DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dns_records (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      ttl INTEGER DEFAULT 300,
      priority INTEGER,
      route53_synced INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_devices (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      platform TEXT,
      device_name TEXT,
      app_version TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sites_client ON sites(client_id);
    CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
    CREATE INDEX IF NOT EXISTS idx_dns_site ON dns_records(site_id);
    CREATE INDEX IF NOT EXISTS idx_push_token ON push_devices(token);

    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_leads_church ON leads(church_email);
    CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
  `);

  return db;
}

module.exports = { initDb, DB_PATH };