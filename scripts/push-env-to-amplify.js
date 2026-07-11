#!/usr/bin/env node
/**
 * Push .env variables to Amplify (merges with production essentials).
 * Usage: node scripts/push-env-to-amplify.js [path-to-.env]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_ID = process.env.AMPLIFY_APP_ID || 'dbtc2f3y8pyam';
const REGION = process.env.AWS_REGION || 'us-east-2';

const envPaths = [
  process.argv[2],
  path.join(__dirname, '..', '.env'),
  'E:\\OneDrive\\Documents\\Factory AI.02.20.26\\ai-upper-room-dir\\.env',
].filter(Boolean);

let envFile = envPaths.find((p) => fs.existsSync(p));
if (!envFile) {
  console.error('No .env file found');
  process.exit(1);
}

const vars = {
  APP_URL: 'https://upperroomdfw.com',
  NODE_ENV: 'production',
  ADMIN_EMAILS: 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com',
  ADMIN_PASSWORD: 'Kingme05$',
  JWT_SECRET: 'myviRxs6g0e5-zPiZ9CrBPjQUx6IaDGvNCeIFUOLoZ9wt_MBHNEQHzEKyXA-4nfH',
  DB_BACKUP_BUCKET: 'upperroomdfw.com',
  DB_BACKUP_KEY: 'data/urdfw.db',
  DB_BACKUP_INTERVAL_MS: '90000',
  EMAIL_FROM: 'Upper Room DFW <theesaintmichael@gmail.com>',
  STRIPE_MODE: 'live',
};

for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (key.startsWith('AWS_')) continue;
  vars[key] = val;
}

if (vars.STRIPE_MODE === 'live' && vars.STRIPE_SECRET_KEY_LIVE) {
  vars.STRIPE_SECRET_KEY = vars.STRIPE_SECRET_KEY_LIVE;
  vars.STRIPE_PUBLISHABLE_KEY = vars.STRIPE_PUBLISHABLE_KEY_LIVE || vars.STRIPE_PUBLISHABLE_KEY;
  vars.STRIPE_PRICE_STANDARD = vars.STRIPE_PRICE_STANDARD_LIVE || vars.STRIPE_PRICE_STANDARD;
  vars.STRIPE_PRICE_PREMIUM = vars.STRIPE_PRICE_PREMIUM_LIVE || vars.STRIPE_PRICE_PREMIUM;
}

// Production overrides — always win over local .env
Object.assign(vars, {
  APP_URL: 'https://upperroomdfw.com',
  NODE_ENV: 'production',
  ADMIN_EMAILS: 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com',
  ADMIN_PASSWORD: 'Kingme05$',
  JWT_SECRET: 'myviRxs6g0e5-zPiZ9CrBPjQUx6IaDGvNCeIFUOLoZ9wt_MBHNEQHzEKyXA-4nfH',
  DB_BACKUP_BUCKET: 'upperroomdfw.com',
  DB_BACKUP_KEY: 'data/urdfw.db',
  DB_BACKUP_INTERVAL_MS: '90000',
  EMAIL_FROM: 'Upper Room DFW <theesaintmichael@gmail.com>',
  STRIPE_MODE: 'live',
  STRIPE_SECRET_KEY: vars.STRIPE_SECRET_KEY_LIVE || vars.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: vars.STRIPE_PUBLISHABLE_KEY_LIVE || vars.STRIPE_PUBLISHABLE_KEY,
  STRIPE_PRICE_STANDARD: vars.STRIPE_PRICE_STANDARD_LIVE || vars.STRIPE_PRICE_STANDARD,
  STRIPE_PRICE_PREMIUM: vars.STRIPE_PRICE_PREMIUM_LIVE || vars.STRIPE_PRICE_PREMIUM,
});
delete vars.PORT;
delete vars.ADMIN_EMAIL;

const outPath = path.join(__dirname, '..', 'deploy', 'amplify-env.production.json');
fs.writeFileSync(outPath, JSON.stringify(vars, null, 2));
console.log('Wrote', outPath, '(' + Object.keys(vars).length + ' vars from', envFile + ')');

const tmpEnvPath = path.join(require('os').tmpdir(), 'amplify-env.production.json');
fs.copyFileSync(outPath, tmpEnvPath);
const fileArg = tmpEnvPath.replace(/\\/g, '/');
execSync(`aws amplify update-app --app-id ${APP_ID} --region ${REGION} --environment-variables file://${fileArg}`, { stdio: 'inherit' });
execSync(`aws amplify update-branch --app-id ${APP_ID} --branch-name main --region ${REGION} --environment-variables file://${fileArg}`, { stdio: 'inherit' });
console.log('Amplify app + branch environment updated.');