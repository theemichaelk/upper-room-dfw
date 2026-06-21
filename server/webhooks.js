const { getStripe, isStripeEnabled } = require('./services/stripe');
const { sendPaymentReceipt } = require('./services/email');

function handleStripeWebhook(db, req, res) {
  if (!isStripeEnabled()) return res.status(400).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[stripe webhook]', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  const now = new Date().toISOString();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clientId = session.metadata?.clientId;
      const plan = (session.metadata?.plan || 'standard').toLowerCase();
      if (clientId) {
        const amount = plan === 'premium' ? 79 : 29;
        const orderId = require('crypto').randomUUID();
        db.prepare('UPDATE clients SET is_paid = 1, package = ?, stripe_customer_id = ?, stripe_subscription_id = ?, subscription_status = ? WHERE id = ?').run(
          plan.charAt(0).toUpperCase() + plan.slice(1),
          session.customer,
          session.subscription,
          'active',
          clientId
        );
        const client = db.prepare('SELECT email, listing_id FROM clients WHERE id = ?').get(clientId);
        db.prepare('INSERT INTO orders (id, client_id, email, gateway, amount, plan, status, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          orderId, clientId, client?.email, 'stripe', amount, plan, 'success', session.id, now
        );
        db.prepare('INSERT INTO invoices (id, order_id, client_id, amount, plan, gateway, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          'INV-' + Date.now(), orderId, clientId, amount, plan, 'stripe', 'paid', now
        );
        if (client?.listing_id) {
          db.prepare('UPDATE listings SET featured = 1, sticky = ?, level = ?, status = ? WHERE id = ?').run(
            plan === 'premium' ? 1 : 0, plan, 'live', client.listing_id
          );
        }
        if (client?.email) sendPaymentReceipt(client.email, amount, plan).catch(() => {});
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const clientId = sub.metadata?.clientId;
      if (clientId) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        db.prepare('UPDATE clients SET subscription_status = ?, is_paid = ? WHERE id = ?').run(
          sub.status, active ? 1 : 0, clientId
        );
        if (!active) {
          const client = db.prepare('SELECT listing_id FROM clients WHERE id = ?').get(clientId);
          if (client?.listing_id) {
            db.prepare('UPDATE listings SET featured = 0, sticky = 0, level = ? WHERE id = ?').run('standard', client.listing_id);
          }
        }
      }
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      const customerId = inv.customer;
      const client = db.prepare('SELECT id, email FROM clients WHERE stripe_customer_id = ?').get(customerId);
      if (client) {
        db.prepare('UPDATE clients SET subscription_status = ? WHERE id = ?').run('past_due', client.id);
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}

module.exports = { handleStripeWebhook };