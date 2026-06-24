require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb, DB_PATH } = require('./db');
const { seedIfNeeded, syncListingsFromJson } = require('./seed');
const { ensureAdmins } = require('./ensure-admins');
const { createRouter } = require('./routes');
const { handleStripeWebhook } = require('./webhooks');
const { restoreDbIfNeeded, scheduleBackup, wrapDbForAutoBackup } = require('./db-persist');

const PORT = parseInt(process.env.PORT || '8000', 10);
const ROOT = path.join(__dirname, '..');

async function bootstrap() {
  await restoreDbIfNeeded(DB_PATH);

  let db = initDb();
  db = wrapDbForAutoBackup(db, DB_PATH);

  seedIfNeeded(db);
  syncListingsFromJson(db);
  ensureAdmins(db);
  scheduleBackup(DB_PATH);

  const app = express();

  const ALLOWED_ORIGINS = [
    process.env.APP_URL,
    'https://upperroomdfw.com',
    'https://www.upperroomdfw.com',
    'https://d4lzb9pq4mfuf.cloudfront.net',
    'https://main.dbtc2f3y8pyam.amplifyapp.com',
    'https://dbtc2f3y8pyam.amplifyapp.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ].filter(Boolean);

  app.use(cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o))) return cb(null, true);
      return cb(null, true);
    },
    credentials: true,
  }));

  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    handleStripeWebhook(db, req, res);
  });

  app.use(express.json({ limit: '2mb' }));

  const api = createRouter(db);
  app.use('/api', api);

  app.use(express.static(ROOT, {
    index: 'index.html',
    extensions: ['html'],
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const file = path.join(ROOT, req.path);
    if (req.path.endsWith('.html') || !path.extname(req.path)) {
      const tryPath = req.path.endsWith('.html') ? file : file + '.html';
      if (require('fs').existsSync(tryPath)) return res.sendFile(tryPath);
    }
    next();
  });

  const server = app.listen(PORT, () => {
    console.log('');
    console.log('  Upper Room DFW — Production Server');
    console.log('  ─────────────────────────────────');
    console.log(`  Site + API:  http://localhost:${PORT}`);
    console.log(`  Health:      http://localhost:${PORT}/api/health`);
    console.log(`  Stripe:      ${process.env.STRIPE_SECRET_KEY ? 'enabled' : 'dev billing mode (set STRIPE_SECRET_KEY)'}`);
    console.log(`  DB backup:   ${process.env.DB_BACKUP_BUCKET ? 's3://' + process.env.DB_BACKUP_BUCKET + '/' + (process.env.DB_BACKUP_KEY || 'data/urdfw.db') : 'local only'}`);
    console.log(`  Restart:     npm run restart`);
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${PORT} is already in use.`);
      console.error('  Fix: npm run restart\n');
      process.exit(1);
    }
    throw err;
  });

  return { app, db, server };
}

const ready = bootstrap().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

module.exports = { bootstrap, ready };