require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./db');
const { seedIfNeeded } = require('./seed');
const { ensureAdmins } = require('./ensure-admins');
const { createRouter } = require('./routes');
const { handleStripeWebhook } = require('./webhooks');

const PORT = parseInt(process.env.PORT || '8000', 10);
const ROOT = path.join(__dirname, '..');

const db = initDb();
seedIfNeeded(db);
ensureAdmins(db);

const app = express();

app.use(cors({ origin: true, credentials: true }));

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

module.exports = { app, db };