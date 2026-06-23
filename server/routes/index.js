const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, authRequired, adminRequired } = require('../middleware/auth');
const { uuid, uniqueSlug, clientToApi, listingToApi, leadToApi } = require('../utils');
const { sendPasswordReset } = require('../services/email');
const { listCampaigns, sendCampaign } = require('../services/campaigns');
const { shortenUrl } = require('../services/tinyurl');
const { getEvents } = require('../services/events');
const { registerWebhook, listWebhooks, deactivateWebhook } = require('../services/webhook-dispatcher');
const { isProduction } = require('../middleware/security');
const { isStripeEnabled, stripeMode, resolveStripePublishableKey, createCheckoutSession, createPortalSession } = require('../services/stripe');
const { integrationConfig, verifyAll, verifyMailchimp, verifyVbout } = require('../services/integrations');
const { verifyRecaptcha, recaptchaSiteKey } = require('../services/recaptcha');
const { backupNow } = require('../db-persist');
const { buildAdminAnalytics, buildMemberAnalytics, buildPublicStats } = require('../services/analytics');
const { syncEmailToProviders, syncToMailchimp, syncToVbout, syncToAcumbamail } = require('../services/newsletter-sync');
const {
  getIntegrationSettings, setIntegrationSettings, getSocialLinks, setSocialLinks,
} = require('../services/platform-settings');
const { sendEmail } = require('../services/email');

function allowDevBilling() {
  return !isStripeEnabled() && !isProduction();
}

function createRouter(db, limiters = {}) {
  const router = express.Router();
  const events = getEvents(db);
  const authLimiter = limiters.authLimiter || ((req, res, next) => next());
  const formLimiter = limiters.formLimiter || ((req, res, next) => next());

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'urdfw-api',
      version: '1.0.0',
      stripe: isStripeEnabled(),
      stripeMode: stripeMode(),
      dbBackup: !!(process.env.DB_BACKUP_BUCKET && process.env.DB_BACKUP_KEY),
      mode: process.env.NODE_ENV || 'development',
      envReady: {
        stripe: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_LIVE),
        smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
        mailchimp: !!process.env.MAILCHIMP_API_KEY,
        vbout: !!process.env.VBOUT_API_KEY,
        appUrl: process.env.APP_URL || '',
      },
    });
  });

  router.get('/stats/public', (req, res) => {
    res.json(buildPublicStats(db));
  });

  router.get('/analytics/admin', adminRequired, (req, res) => {
    res.json(buildAdminAnalytics(db));
  });

  router.get('/analytics/member', authRequired, (req, res) => {
    res.json(buildMemberAnalytics(db, req.user.email));
  });

  router.get('/platform/social', (req, res) => {
    res.json({ ok: true, links: getSocialLinks(db) });
  });

  router.patch('/platform/social', adminRequired, (req, res) => {
    const links = setSocialLinks(db, req.body || {});
    res.json({ ok: true, links });
  });

  router.get('/platform/connections', adminRequired, async (req, res) => {
    const checks = await verifyAll();
    res.json({
      ok: true,
      appUrl: process.env.APP_URL || '',
      dbBackup: !!(process.env.DB_BACKUP_BUCKET && process.env.DB_BACKUP_KEY),
      recaptcha: !!process.env.RECAPTCHA_SITE_KEY,
      results: checks.results,
      config: checks.config,
    });
  });

  router.get('/billing/stripe-status', (req, res) => {
    const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
    res.json({
      ok: true,
      enabled: isStripeEnabled(),
      mode: stripeMode(),
      publishableKey: resolveStripePublishableKey() || null,
      webhookUrl: appUrl + '/api/billing/webhook',
      prices: {
        standard: process.env.STRIPE_PRICE_STANDARD || null,
        premium: process.env.STRIPE_PRICE_PREMIUM || null,
      },
      configured: !!(isStripeEnabled() && process.env.STRIPE_PRICE_STANDARD && process.env.STRIPE_PRICE_PREMIUM),
    });
  });

  router.get('/admin/stats', adminRequired, (req, res) => {
    const clients = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c;
    const pending = db.prepare("SELECT COUNT(*) AS c FROM clients WHERE status = 'pending'").get().c;
    const paid = db.prepare('SELECT COUNT(*) AS c FROM clients WHERE is_paid = 1').get().c;
    const listings = db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'live'").get().c;
    const orders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    const revenue = db.prepare('SELECT COALESCE(SUM(amount), 0) AS t FROM orders').get().t;
    const tickets = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'open'").get().c;
    const subscribers = db.prepare('SELECT COUNT(*) AS c FROM subscribers').get().c;
    res.json({ clients, pending, paid, listings, orders, revenue, tickets, subscribers });
  });

  router.get('/admin/orders', adminRequired, (req, res) => {
    res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all());
  });

  router.post('/admin/backup-db', adminRequired, async (req, res) => {
    const dbPath = process.env.DATABASE_PATH || require('path').join(__dirname, '..', 'data', 'urdfw.db');
    const result = await backupNow(dbPath);
    res.json({ ok: !!result.ok, ...result, bucket: process.env.DB_BACKUP_BUCKET, key: process.env.DB_BACKUP_KEY });
  });

  router.get('/admin/campaigns', adminRequired, (req, res) => {
    res.json({ ok: true, campaigns: listCampaigns() });
  });

  router.post('/admin/test-email', adminRequired, async (req, res) => {
    const to = (req.body?.email || req.user.email || '').trim();
    const template = req.body?.template || 'contact_auto_reply';
    if (!to) return res.status(400).json({ ok: false, error: 'Email required' });
    try {
      if (template === 'smtp_ping') {
        await sendEmail({
          to,
          subject: 'Upper Room DFW — SMTP Test',
          html: '<p>Amazon SES SMTP is working. Sent at ' + new Date().toISOString() + '</p>',
          text: 'Amazon SES SMTP is working.',
        });
        return res.json({ ok: true, to, template: 'smtp_ping' });
      }
      const result = await sendCampaign(template, {
        email: to,
        name: req.body?.name || 'Admin Test',
        message: 'This is a test message from the admin panel.',
        amount: 29,
        plan: 'Standard',
        gateway: 'stripe',
        token: 'test-reset-token',
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/config', (req, res) => {
    res.json({
      mode: 'remote',
      stripeEnabled: isStripeEnabled(),
      stripeMode: stripeMode(),
      stripePublishableKey: resolveStripePublishableKey() || '',
      recaptchaSiteKey: recaptchaSiteKey(),
      appUrl: process.env.APP_URL || '',
      trialDays: 14,
      integrations: integrationConfig(),
      plans: [
        { id: 'standard', name: 'Standard', price: 29 },
        { id: 'premium', name: 'Premium', price: 79 },
      ],
    });
  });

  async function requireRecaptcha(req, res) {
    const check = await verifyRecaptcha(req.body?.recaptchaToken);
    if (!check.ok) {
      res.status(400).json({ ok: false, error: check.error || 'reCAPTCHA failed' });
      return false;
    }
    return true;
  }

  /* ─── AUTH ─── */
  router.post('/auth/register', authLimiter, (req, res) => {
    const body = req.body || {};
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || uuid().slice(0, 12);
    const name = body.name || email.split('@')[0];

    if (!email || !body.name) return res.status(400).json({ ok: false, error: 'Name and email required' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const userId = uuid();
    const clientId = uuid();
    const listingId = uuid();
    const slug = uniqueSlug(db, name);
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync(password, 10);
    const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();

    const tx = db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        userId, email, hash, name, 'church-owner', 0, now
      );
      db.prepare(`
        INSERT INTO listings (id, client_id, slug, name, area, category, description, full_description, phone, email, website, times, address, denomination, tags_json, image, status, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        listingId, clientId, slug, name, body.area || 'Dallas', body.category || 'Church',
        body.description || '', body.description || '', body.phone || '', email, body.website || '',
        body.times || '', (body.area || 'Dallas') + ', TX', body.denomination || 'Community',
        JSON.stringify([body.category || 'Church']), 'images/18.jpg', 'pending', 'registered', now
      );
      db.prepare(`
        INSERT INTO clients (id, user_id, email, name, area, category, description, phone, website, times, denomination, package, status, trial_start, is_paid, listing_id, registered_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        clientId, userId, email, name, body.area, body.category, body.description, body.phone || '',
        body.website || '', body.times || '', body.denomination || '', body.package || 'Free',
        'pending', now, 0, listingId, now, JSON.stringify({ keywords: [], payments: [] })
      );
    });
    tx();

    events.emit('user.registered', { email, name, area: body.area, clientId }).catch(() => {});

    const client = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId));
    const token = signToken({ sub: userId, email, role: 'church-owner', clientId });
    res.json({ ok: true, client, user: { id: userId, email, name, role: 'church-owner' }, token });
  });

  router.post('/auth/member', authLimiter, (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid email or password' });

    if (password && !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    let client = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);
    if (!client) {
      const clientId = uuid();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO clients (id, user_id, email, name, area, status, trial_start, is_paid, registered_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(clientId, user.id, email, user.name, 'Dallas', 'approved', now, 0, now, '{}');
      client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    }

    const token = signToken({ sub: user.id, email, role: user.role, clientId: client.id });
    res.json({ ok: true, client: clientToApi(client), user: { id: user.id, email, name: user.name, role: user.role }, token });
  });

  router.post('/auth/admin', authLimiter, (req, res) => {
    const password = req.body?.password || '';
    const email = (req.body?.email || '').trim().toLowerCase();
    const adminPass = isProduction() ? null : (process.env.ADMIN_PASSWORD || 'admin123');

    if (email) {
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, 'admin');
      if (user && password && bcrypt.compareSync(password, user.password_hash)) {
        const token = signToken({ sub: user.id, email: user.email, role: 'admin' });
        return res.json({ ok: true, role: 'admin', email: user.email, token });
      }
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const admins = db.prepare('SELECT * FROM users WHERE role = ?').all('admin');
    const matched = admins.find((u) => password && bcrypt.compareSync(password, u.password_hash));
    if (matched) {
      const token = signToken({ sub: matched.id, email: matched.email, role: 'admin' });
      return res.json({ ok: true, role: 'admin', email: matched.email, token });
    }

    if (adminPass && password === adminPass && admins.length > 0) {
      const user = admins[0];
      const token = signToken({ sub: user.id, email: user.email, role: 'admin' });
      return res.json({ ok: true, role: 'admin', email: user.email, token });
    }

    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  });

  router.post('/auth/forgot', authLimiter, async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT email FROM users WHERE email = ?').get(email);
    if (user) {
      const token = uuid();
      const expires = new Date(Date.now() + 3600000).toISOString();
      db.prepare('INSERT OR REPLACE INTO password_resets (token, email, expires_at) VALUES (?, ?, ?)').run(token, email, expires);
      await sendCampaign('forgot_password', { email, token, name: email.split('@')[0] }).catch(() => sendPasswordReset(email, token));
    }
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  });

  router.post('/auth/reset', (req, res) => {
    const { token, password } = req.body || {};
    const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
    }
    const hash = bcrypt.hashSync(password || uuid(), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, row.email);
    db.prepare('DELETE FROM password_resets WHERE token = ?').run(token);
    res.json({ ok: true, message: 'Password updated' });
  });

  router.get('/auth/me', authRequired, (req, res) => {
    const client = req.user.clientId
      ? clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.clientId))
      : null;
    res.json({ ok: true, user: req.user, client });
  });

  /* ─── CLIENTS ─── */
  router.get('/clients', adminRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM clients ORDER BY registered_at DESC').all();
    res.json(rows.map(clientToApi));
  });

  router.patch('/clients/:id', authRequired, (req, res) => {
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && row.id !== req.user.clientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const patch = req.body || {};
    const fields = [];
    const vals = [];
    const allowed = ['name', 'area', 'category', 'description', 'phone', 'website', 'times', 'package', 'status', 'is_paid'];
    for (const k of allowed) {
      if (patch[k] !== undefined) {
        if (k === 'is_paid') {
          fields.push('is_paid = ?');
          vals.push(patch[k] ? 1 : 0);
        } else {
          fields.push(`${k} = ?`);
          vals.push(patch[k]);
        }
      }
    }
    if (fields.length) {
      vals.push(req.params.id);
      db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    }
    if (patch.status === 'approved' && row.listing_id) {
      db.prepare('UPDATE listings SET status = ? WHERE id = ?').run('live', row.listing_id);
    }
    const updated = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
    if (patch.status === 'approved' && row.status !== 'approved') {
      events.emit('client.approved', { email: updated.email, name: updated.name, clientId: updated.id }).catch(() => {});
    }
    res.json(updated);
  });

  /* ─── LISTINGS ─── */
  router.get('/listings', (req, res) => {
    const status = req.query.status || 'live';
    const rows = status === 'all'
      ? db.prepare('SELECT * FROM listings ORDER BY name').all()
      : db.prepare('SELECT * FROM listings WHERE status = ? OR status = ? ORDER BY featured DESC, name').all(status, 'approved');
    res.json(rows.map(listingToApi));
  });

  router.get('/listings/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM listings WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(listingToApi(row));
  });

  router.post('/listings', authRequired, (req, res) => {
    const { clientId, data } = req.body || {};
    const cid = clientId || req.user.clientId;
    if (!cid) return res.status(400).json({ error: 'clientId required' });
    if (req.user.role !== 'admin' && cid !== req.user.clientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(cid);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const d = data || req.body.data || req.body;
    const listingId = client.listing_id;
    const now = new Date().toISOString();

    if (listingId) {
      db.prepare(`
        UPDATE listings SET name=?, area=?, description=?, full_description=?, phone=?, website=?, times=?, updated_at=?
        WHERE id=?
      `).run(d.name || client.name, d.area || client.area, d.description || d.desc, d.description || d.desc,
        d.phone || client.phone, d.website || client.website, d.times || client.times, now, listingId);
      db.prepare(`
        UPDATE clients SET name=?, area=?, description=?, phone=?, website=?, times=?
        WHERE id=?
      `).run(d.name || client.name, d.area || client.area, d.description || d.desc,
        d.phone || client.phone, d.website || client.website, d.times || client.times, cid);
    }

    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
    res.json(listingToApi(listing));
  });

  /* ─── BILLING ─── */
  router.post('/billing/checkout', authRequired, async (req, res) => {
    const client = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.clientId));
    if (!client) return res.status(404).json({ ok: false, error: 'Client not found' });

    const plan = (req.body?.plan || 'standard').toLowerCase();
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const coupon = req.body?.coupon;

    if (isStripeEnabled()) {
      try {
        const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
        const { session, customerId } = await createCheckoutSession({
          client: { ...client, stripe_customer_id: row.stripe_customer_id, is_paid: row.is_paid },
          plan,
          coupon,
          successUrl: `${appUrl}/member-dashboard.html?billing=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appUrl}/member-dashboard.html?billing=cancel`,
        });
        if (customerId && !row.stripe_customer_id) {
          db.prepare('UPDATE clients SET stripe_customer_id = ? WHERE id = ?').run(customerId, client.id);
        }
        return res.json({ ok: true, checkoutUrl: session.url, sessionId: session.id });
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
      }
    }

    if (!allowDevBilling()) {
      return res.status(503).json({ ok: false, error: 'Billing unavailable — configure Stripe for production.' });
    }
    const amount = plan === 'premium' ? 79 : 29;
    const orderId = uuid();
    const now = new Date().toISOString();
    const ref = 'DEV-' + Date.now();
    db.prepare('INSERT INTO orders (id, client_id, email, gateway, amount, plan, status, ref, coupon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      orderId, client.id, client.email, 'dev', amount, plan, 'success', ref, coupon || null, now
    );
    db.prepare('INSERT INTO invoices (id, order_id, client_id, amount, plan, gateway, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'INV-' + Date.now(), orderId, client.id, amount, plan, 'dev', 'paid', now
    );
    db.prepare('UPDATE clients SET is_paid = 1, package = ?, subscription_status = ? WHERE id = ?').run(
      plan.charAt(0).toUpperCase() + plan.slice(1), 'active', client.id
    );
    if (client.listingId) {
      db.prepare('UPDATE listings SET featured = ?, sticky = ?, level = ? WHERE id = ?').run(
        1, plan === 'premium' ? 1 : 0, plan, client.listingId
      );
    }
    events.emit('payment.completed', { email: client.email, amount, plan, clientId: client.id, gateway: 'dev' }).catch(() => {});
    const updated = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id));
    res.json({ ok: true, order: { ref, amount, plan }, client: updated, devMode: true });
  });

  router.post('/billing/portal', authRequired, async (req, res) => {
    const row = db.prepare('SELECT stripe_customer_id FROM clients WHERE id = ?').get(req.user.clientId);
    if (!row?.stripe_customer_id) return res.status(400).json({ ok: false, error: 'No Stripe customer' });
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const url = await createPortalSession(row.stripe_customer_id, `${appUrl}/member-dashboard.html`);
    res.json({ ok: true, url });
  });

  router.get('/billing/invoices', authRequired, (req, res) => {
    const email = req.user.email;
    const invoices = db.prepare(`
      SELECT i.* FROM invoices i
      JOIN orders o ON o.id = i.order_id
      WHERE o.email = ? OR i.client_id = ?
      ORDER BY i.date DESC LIMIT 50
    `).all(email, req.user.clientId || '');
    res.json(invoices);
  });

  router.post('/billing/charge', authRequired, async (req, res) => {
    const plan = (req.body?.plan || (req.body?.amount >= 79 ? 'premium' : 'standard')).toLowerCase();
    req.body = { ...req.body, plan };
    const client = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.clientId));
    if (!client) return res.status(404).json({ ok: false, error: 'Client not found' });
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    if (isStripeEnabled()) {
      try {
        const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
        const { session, customerId } = await createCheckoutSession({
          client: { ...client, stripe_customer_id: row.stripe_customer_id, is_paid: row.is_paid },
          plan,
          coupon: req.body?.coupon,
          successUrl: `${appUrl}/member-dashboard.html?billing=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appUrl}/member-dashboard.html?billing=cancel`,
        });
        if (customerId && !row.stripe_customer_id) {
          db.prepare('UPDATE clients SET stripe_customer_id = ? WHERE id = ?').run(customerId, client.id);
        }
        return res.json({ ok: true, checkoutUrl: session.url, order: { ref: session.id }, client });
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
      }
    }
    if (!allowDevBilling()) {
      return res.status(503).json({ ok: false, error: 'Billing unavailable — configure Stripe for production.' });
    }
    const amount = plan === 'premium' ? 79 : 29;
    const orderId = uuid();
    const now = new Date().toISOString();
    const ref = 'DEV-' + Date.now();
    db.prepare('INSERT INTO orders (id, client_id, email, gateway, amount, plan, status, ref, coupon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      orderId, client.id, client.email, 'dev', amount, plan, 'success', ref, req.body?.coupon || null, now
    );
    db.prepare('INSERT INTO invoices (id, order_id, client_id, amount, plan, gateway, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'INV-' + Date.now(), orderId, client.id, amount, plan, 'dev', 'paid', now
    );
    db.prepare('UPDATE clients SET is_paid = 1, package = ?, subscription_status = ? WHERE id = ?').run(
      plan.charAt(0).toUpperCase() + plan.slice(1), 'active', client.id
    );
    events.emit('payment.completed', { email: client.email, amount, plan, clientId: client.id, gateway: 'dev' }).catch(() => {});
    const updated = clientToApi(db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id));
    res.json({ ok: true, order: { ref, amount, plan }, client: updated });
  });

  /* ─── LEADS ─── */
  router.post('/leads', formLimiter, (req, res) => {
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    const listing = body.listingId
      ? db.prepare('SELECT email FROM listings WHERE id = ? OR slug = ?').get(body.listingId, body.listingId)
      : null;
    const churchEmail = body.churchEmail || body.church_email || listing?.email || body.targetEmail || '';
    db.prepare('INSERT INTO leads (id, listing_id, church_email, name, email, phone, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, body.listingId || null, churchEmail, body.name || '', body.email || '', body.phone || '', body.message || '', 'new', now
    );
    events.emit('lead.created', { id, listingId: body.listingId, churchEmail, ...body }).catch(() => {});
    res.json({ ok: true, id });
  });

  router.get('/leads', authRequired, (req, res) => {
    const email = req.user.email;
    const rows = db.prepare('SELECT * FROM leads WHERE church_email = ? ORDER BY created_at DESC').all(email);
    res.json(rows.map(leadToApi));
  });

  router.patch('/leads/:id', authRequired, (req, res) => {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });
    if (lead.church_email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const status = req.body?.status || 'contacted';
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ ok: true, id: req.params.id, status });
  });

  /* ─── MESSAGES ─── */
  router.get('/messages', authRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub);
    res.json(rows.map((m) => ({
      id: m.id, from: m.from_name, subject: m.subject, body: m.body, read: !!m.read_flag, at: m.created_at,
    })));
  });

  router.post('/messages', authRequired, (req, res) => {
    const { to, from, subject, body } = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    if (to === 'admin') {
      db.prepare('INSERT INTO support_tickets (id, email, name, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, req.user.email, from || req.user.email, subject || 'Message', body || '', 'open', now
      );
    } else {
      db.prepare('INSERT INTO messages (id, user_id, from_name, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        id, req.user.sub, from || 'Member', subject, body, now
      );
    }
    res.json({ ok: true });
  });

  /* ─── SUPPORT ─── */
  router.post('/support', formLimiter, (req, res) => {
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO support_tickets (id, email, name, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, body.email || '', body.name || '', body.topic || 'General', body.message || body.topic || '', 'open', now
    );
    events.emit('support.created', { id, ...body }).catch(() => {});
    res.json({ ok: true, id });
  });

  router.get('/support', adminRequired, (req, res) => {
    res.json(db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all());
  });

  /* ─── INTEGRATIONS (stubs wired for frontend) ─── */
  router.get('/integrations', adminRequired, (req, res) => {
    res.json({
      providers: ['mailchimp', 'vbout', 'acumbamail'],
      config: integrationConfig(),
      subscribers: db.prepare('SELECT COUNT(*) AS c FROM subscribers').get().c,
    });
  });

  router.get('/integrations/status', adminRequired, async (req, res) => {
    try {
      const report = await verifyAll();
      res.json(report);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/integrations/subscribe', formLimiter, async (req, res) => {
    if (!(await requireRecaptcha(req, res))) return;
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
    const now = new Date().toISOString();
    const inserted = db.prepare('INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)').run(email, now);
    if (inserted.changes > 0) {
      await events.emit('subscriber.added', { email });
    }
    const sync = await syncEmailToProviders(email, db);
    res.json({ ok: true, synced: sync.synced, email, results: sync.results });
  });

  const PROVIDERS = ['mailchimp', 'vbout', 'acumbamail'];

  router.get('/integrations/log', adminRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM integration_log ORDER BY at DESC LIMIT 50').all();
    res.json({ ok: true, entries: rows });
  });

  router.get('/integrations/:provider', adminRequired, (req, res) => {
    const provider = req.params.provider;
    if (!PROVIDERS.includes(provider)) return res.status(404).json({ ok: false, error: 'Unknown provider' });
    const cfg = getIntegrationSettings(db, provider);
    const synced = db.prepare('SELECT COUNT(*) AS c FROM integration_log WHERE provider = ? AND status = ?').get(provider, 'ok').c;
    res.json({ ok: true, provider, config: cfg, syncedCount: synced });
  });

  router.post('/integrations/:provider/config', adminRequired, (req, res) => {
    const provider = req.params.provider;
    if (!PROVIDERS.includes(provider)) return res.status(404).json({ ok: false, error: 'Unknown provider' });
    const body = req.body?.config || req.body || {};
    const cfg = setIntegrationSettings(db, provider, {
      listId: body.listId,
      apiKey: body.apiKey,
      enabled: body.enabled !== false,
    });
    res.json({ ok: true, config: cfg });
  });

  router.post('/integrations/:provider/test', adminRequired, async (req, res) => {
    const provider = req.params.provider;
    const t0 = Date.now();
    let result;
    if (provider === 'mailchimp') result = await verifyMailchimp();
    else if (provider === 'vbout') result = await verifyVbout();
    else if (provider === 'acumbamail') result = { ok: !!process.env.ACUMBAMAIL_API_KEY, provider: 'acumbamail', error: process.env.ACUMBAMAIL_API_KEY ? null : 'ACUMBAMAIL_API_KEY not set' };
    else return res.status(404).json({ ok: false, error: 'Unknown provider' });
    result.latencyMs = Date.now() - t0;
    res.json(result);
  });

  router.post('/integrations/:provider/sync-all', adminRequired, async (req, res) => {
    const provider = req.params.provider;
    if (!PROVIDERS.includes(provider)) return res.status(404).json({ ok: false, error: 'Unknown provider' });
    const emails = db.prepare('SELECT email FROM subscribers').all().map((r) => r.email);
    if (!emails.length) return res.json({ ok: false, error: 'No subscribers to sync' });
    const cfg = getIntegrationSettings(db, provider);
    let synced = 0;
    for (const email of emails) {
      let r;
      if (provider === 'mailchimp') r = await syncToMailchimp(email, cfg.listId);
      else if (provider === 'vbout') r = await syncToVbout(email, cfg.listId);
      else r = await syncToAcumbamail(email, cfg.listId);
      if (r.ok) synced++;
      db.prepare('INSERT INTO integration_log (action, provider, status, email, at) VALUES (?, ?, ?, ?, ?)').run(
        'sync-all', provider, r.ok ? 'ok' : 'error', email, new Date().toISOString()
      );
    }
    res.json({ ok: synced > 0, provider, synced, total: emails.length });
  });

  router.post('/integrations/contact', formLimiter, (req, res) => {
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    const listing = db.prepare('SELECT * FROM listings WHERE id = ? OR slug = ?').get(body.listingId, body.listingId);
    const churchEmail = body.churchEmail || body.church_email || listing?.email || '';
    db.prepare('INSERT INTO leads (id, listing_id, church_email, name, email, phone, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, listing?.id || body.listingId, churchEmail, body.name || '', body.email || '', body.phone || '', body.message || '', 'new', now
    );
    events.emit('lead.created', { id, listingId: listing?.id || body.listingId, churchEmail, ...body }).catch(() => {});
    res.json({ ok: true, lead: { id } });
  });

  router.post('/integrations/support', formLimiter, async (req, res) => {
    if (!(await requireRecaptcha(req, res))) return;
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO support_tickets (id, email, name, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, body.email || '', body.name || '', body.topic || 'Support', body.message || '', 'open', now
    );
    events.emit('support.created', { id, ...body }).catch(() => {});
    res.json({ ok: true, ticket: { id } });
  });

  router.post('/integrations/site-contact', formLimiter, async (req, res) => {
    if (!(await requireRecaptcha(req, res))) return;
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    const message = [
      body.message || '',
      body.phone ? 'Phone: ' + body.phone : '',
    ].filter(Boolean).join('\n');
    db.prepare('INSERT INTO support_tickets (id, email, name, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      body.email || '',
      body.name || '',
      'Site Contact',
      message,
      'open',
      now
    );
    events.emit('support.created', { id, email: body.email, name: body.name, topic: 'Site Contact', message }).catch(() => {});
    res.json({ ok: true, ticket: { id } });
  });

  router.post('/integrations/listing-intake', formLimiter, async (req, res) => {
    if (!(await requireRecaptcha(req, res))) return;
    const body = req.body || {};
    const id = uuid();
    const now = new Date().toISOString();
    const summary = [
      'Listing intake submission',
      'Name: ' + (body.name || ''),
      'Area: ' + (body.area || ''),
      'Category: ' + (body.category || ''),
      'Phone: ' + (body.phone || ''),
      'Website: ' + (body.website || ''),
      'Times: ' + (body.times || ''),
      'Description: ' + (body.description || ''),
    ].join('\n');
    db.prepare('INSERT INTO support_tickets (id, email, name, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      body.email || body.phone || 'intake@upperroomdfw.com',
      body.name || 'Listing Intake',
      'Listing Submission',
      summary,
      'open',
      now
    );
    events.emit('support.created', { id, email: body.email, name: body.name, topic: 'Listing Submission', message: summary }).catch(() => {});
    res.json({ ok: true, ticket: { id }, message: 'Submission received. Our team will review within 1–2 business days.' });
  });

  /* ─── OUTBOUND WEBHOOKS ─── */
  router.get('/webhooks', adminRequired, (req, res) => {
    res.json({ ok: true, webhooks: listWebhooks(db) });
  });

  router.post('/webhooks', adminRequired, (req, res) => {
    const url = (req.body?.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ ok: false, error: 'Valid webhook URL required' });
    }
    const hook = registerWebhook(db, {
      url,
      events: req.body?.events,
      label: req.body?.label,
    });
    res.json({ ok: true, webhook: hook });
  });

  router.delete('/webhooks/:id', adminRequired, (req, res) => {
    const ok = deactivateWebhook(db, req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Webhook not found' });
    res.json({ ok: true });
  });

  router.get('/webhooks/log', adminRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM webhook_log ORDER BY at DESC LIMIT 50').all();
    res.json({ ok: true, entries: rows });
  });

  router.get('/events/log', adminRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM event_log ORDER BY at DESC LIMIT 50').all();
    res.json({ ok: true, entries: rows });
  });

  /* ─── SHORT LINKS (TinyURL) ─── */
  router.post('/links/shorten', async (req, res) => {
    const url = (req.body?.url || '').trim();
    if (!url) return res.status(400).json({ ok: false, error: 'URL required' });
    const result = await shortenUrl(url, { alias: req.body?.alias, tags: req.body?.tags });
    if (!result.ok) return res.status(502).json(result);

    const id = require('crypto').randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    try {
      db.prepare('INSERT INTO short_links (id, target_url, tiny_url, alias, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id, url, result.tinyUrl, result.alias || null, now
      );
    } catch { /* table optional */ }

    res.json({
      ok: true,
      id,
      url,
      tinyUrl: result.tinyUrl,
      goUrl: (process.env.APP_URL || '') + '/go.html?id=' + id,
    });
  });

  router.get('/links/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM short_links WHERE id = ? OR alias = ?').get(req.params.id, req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Link not found' });
    res.json({ ok: true, id: row.id, url: row.target_url, tinyUrl: row.tiny_url });
  });

  return router;
}

module.exports = { createRouter };