#!/usr/bin/env node
/** Build .amplify-hosting bundle for Amplify WEB_COMPUTE (Express) */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.amplify-hosting');
const STATIC = path.join(OUT, 'static');
const COMPUTE = path.join(OUT, 'compute', 'default');

const STATIC_EXCLUDE = new Set([
  'node_modules', '.git', '.amplify-hosting', 'server', 'scripts', 'deploy',
  '.env', '.env.example', '.vscode', 'package-lock.json',
]);
const STATIC_SKIP_FILES = new Set(['deploy-manifest.json']);

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest, filter) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (filter && !filter(path.join(src, name), name)) continue;
      copyRecursive(path.join(src, name), path.join(dest, name), filter);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function staticFilter(fullPath, name) {
  const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
  const top = rel.split('/')[0];
  if (STATIC_EXCLUDE.has(top) || STATIC_EXCLUDE.has(name)) return false;
  if (STATIC_SKIP_FILES.has(name)) return false;
  if (/\.(db|db-shm|db-wal)$/.test(name)) return false;
  return true;
}

console.log('Building Amplify .amplify-hosting bundle...');
rimraf(OUT);
fs.mkdirSync(STATIC, { recursive: true });
fs.mkdirSync(COMPUTE, { recursive: true });

// Static assets (HTML, JS, CSS, images, data, churches, templates, etc.)
for (const name of fs.readdirSync(ROOT)) {
  const full = path.join(ROOT, name);
  if (!staticFilter(full, name)) continue;
  copyRecursive(full, path.join(STATIC, name), staticFilter);
}

// Compute: server + production node_modules + entrypoint
copyRecursive(path.join(ROOT, 'server'), path.join(COMPUTE, 'server'));
copyRecursive(path.join(ROOT, 'data'), path.join(COMPUTE, 'data'));

const computePkg = {
  name: 'upper-room-dfw-compute',
  version: '2.0.0',
  private: true,
  main: 'server.js',
  dependencies: require(path.join(ROOT, 'package.json')).dependencies,
};
fs.writeFileSync(path.join(COMPUTE, 'package.json'), JSON.stringify(computePkg, null, 2));

console.log('Installing compute dependencies...');
execSync('npm install --omit=dev --no-package-lock', { cwd: COMPUTE, stdio: 'inherit' });

// Bake Amplify branch env into compute .env (WEB_COMPUTE runtime injection is unreliable)
const ENV_KEYS = [
  'PORT', 'NODE_ENV', 'APP_URL', 'JWT_SECRET', 'ADMIN_EMAILS', 'ADMIN_PASSWORD',
  'STRIPE_MODE', 'STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY_TEST',
  'STRIPE_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY_LIVE', 'STRIPE_PUBLISHABLE_KEY_TEST',
  'STRIPE_PRICE_STANDARD', 'STRIPE_PRICE_PREMIUM', 'STRIPE_WEBHOOK_SECRET',
  'SMTP_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'EMAIL_FROM',
  'MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER_PREFIX', 'MAILCHIMP_LIST_ID',
  'VBOUT_API_KEY', 'VBOUT_LIST_ID', 'TINYURL_API_TOKEN',
  'ROUTE53_HOSTED_ZONE_ID', 'CLOUDFRONT_DOMAIN', 'AMPLIFY_DOMAIN', 'CLOUDFRONT_HOSTED_ZONE_ID',
  'ACUMBAMAIL_API_KEY', 'ACUMBAMAIL_LIST_ID',
  'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE',
  'PAYPAL_API_USERNAME', 'PAYPAL_API_PASSWORD', 'PAYPAL_API_SIGNATURE',
  'DB_BACKUP_BUCKET', 'DB_BACKUP_KEY', 'DB_BACKUP_INTERVAL_MS',
  'RECAPTCHA_SITE_KEY', 'RECAPTCHA_SECRET_KEY', 'DATABASE_PATH',
];
const envLines = ENV_KEYS.filter((k) => process.env[k]).map((k) => `${k}=${process.env[k]}`);
if (!envLines.some((l) => l.startsWith('DATABASE_PATH='))) {
  envLines.push('DATABASE_PATH=/tmp/urdfw.db');
}
fs.writeFileSync(path.join(COMPUTE, '.env'), envLines.join('\n') + '\n');
console.log('Wrote compute .env with', envLines.length, 'keys');

// Amplify compute must listen on port 3000
const serverJs = `'use strict';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || '/tmp/urdfw.db';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'amplify-production-change-me';
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'Kingme05$';
if (!process.env.ADMIN_EMAILS) {
  process.env.ADMIN_EMAILS = 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com';
}
if (!process.env.DB_BACKUP_BUCKET) process.env.DB_BACKUP_BUCKET = 'upperroomdfw.com';
if (!process.env.DB_BACKUP_KEY) process.env.DB_BACKUP_KEY = 'data/urdfw.db';

const path = require('path');
process.chdir(__dirname);
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
try {
  require('./server/index.js');
} catch (err) {
  console.error('Server failed to start:', err);
  process.exit(1);
}
`;
fs.writeFileSync(path.join(COMPUTE, 'server.js'), serverJs);

fs.copyFileSync(
  path.join(ROOT, 'deploy', 'deploy-manifest.json'),
  path.join(OUT, 'deploy-manifest.json')
);

const sizeMb = (dir) => {
  let bytes = 0;
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) walk(p);
      else bytes += s.size;
    }
  };
  walk(dir);
  return (bytes / 1024 / 1024).toFixed(2);
};

console.log('Static:', sizeMb(STATIC), 'MB');
console.log('Compute:', sizeMb(COMPUTE), 'MB');
console.log('Amplify bundle ready at', OUT);