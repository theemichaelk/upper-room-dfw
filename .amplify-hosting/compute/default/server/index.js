require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb, DB_PATH } = require('./db');
const { seedIfNeeded, syncListingsFromJson } = require('./seed');
const { ensureAdmins } = require('./ensure-admins');
const { ensureIntegrations } = require('./ensure-integrations');
const { ensureDnsSites } = require('./ensure-dns');
const { createRouter } = require('./routes');
const { createRedirectMiddleware } = require('./middleware/redirects');
const { getRedirects } = require('./services/duplicate-pages');
const { handleStripeWebhook } = require('./webhooks');
const { restoreDbIfNeeded, scheduleBackup, wrapDbForAutoBackup } = require('./db-persist');
const { securityHeaders, assertProductionSecrets } = require('./middleware/security');
const { authLimiter, formLimiter, apiLimiter } = require('./middleware/rate-limit');
const { initEvents } = require('./services/events');

const PORT = parseInt(process.env.PORT || '8000', 10);
const ROOT = path.join(__dirname, '..');

async function bootstrap() {
  assertProductionSecrets();
  await restoreDbIfNeeded(DB_PATH);

  let db = initDb();
  db = wrapDbForAutoBackup(db, DB_PATH);

  seedIfNeeded(db);
  syncListingsFromJson(db);
  ensureAdmins(db);
  ensureIntegrations(db);
  ensureDnsSites(db).catch((err) => console.warn('DNS seed:', err.message));
  scheduleBackup(DB_PATH);
  initEvents(db);

  const app = express();
  app.set('trust proxy', 1);
  app.use(securityHeaders);

  const ALLOWED_ORIGINS = [
    process.env.APP_URL,
    'https://upperroomdfw.com',
    'https://www.upperroomdfw.com',
    'https://quantumpages.ai',
    'https://www.quantumpages.ai',
    'https://d4lzb9pq4mfuf.cloudfront.net',
    'https://main.dbtc2f3y8pyam.amplifyapp.com',
    'https://dbtc2f3y8pyam.amplifyapp.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  const isProd = process.env.NODE_ENV === 'production'
    || (process.env.APP_URL || '').includes('upperroomdfw.com');

  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.some((o) => origin === o)) return cb(null, true);
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      return cb(new Error('CORS blocked: ' + origin), false);
    },
    credentials: true,
  }));

  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    handleStripeWebhook(db, req, res);
  });

  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiLimiter);

  const api = createRouter(db, { authLimiter, formLimiter });
  app.use('/api', api);

  app.use(createRedirectMiddleware(() => getRedirects(db, ROOT)));

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

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    const notFoundPage = path.join(ROOT, '404.html');
    if (require('fs').existsSync(notFoundPage)) {
      return res.status(404).sendFile(notFoundPage);
    }
    res.status(404).send('Not found');
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