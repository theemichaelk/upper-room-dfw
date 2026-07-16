const Stripe = require('stripe');

let stripe = null;
let stripeKeyUsed = null;

function stripeMode() {
  if (process.env.STRIPE_MODE) return process.env.STRIPE_MODE.toLowerCase();
  return process.env.NODE_ENV === 'production' ? 'live' : 'test';
}

function resolveStripeSecretKey() {
  const mode = stripeMode();
  if (mode === 'live') {
    return process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
  }
  return process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
}

function resolveStripePublishableKey() {
  const mode = stripeMode();
  if (mode === 'live') {
    return process.env.STRIPE_PUBLISHABLE_KEY_LIVE || process.env.STRIPE_PUBLISHABLE_KEY;
  }
  return process.env.STRIPE_PUBLISHABLE_KEY_TEST || process.env.STRIPE_PUBLISHABLE_KEY;
}

function getStripe() {
  const key = resolveStripeSecretKey();
  if (!key) return null;
  if (!stripe || stripeKeyUsed !== key) {
    stripe = new Stripe(key);
    stripeKeyUsed = key;
  }
  return stripe;
}

function isStripeEnabled() {
  return !!resolveStripeSecretKey();
}

function priceIdForPlan(plan) {
  const p = (plan || 'standard').toLowerCase();
  const isPremium = p === 'premium' || p === '79';
  const mode = stripeMode();
  if (mode === 'live') {
    return isPremium
      ? (process.env.STRIPE_PRICE_PREMIUM_LIVE || process.env.STRIPE_PRICE_PREMIUM)
      : (process.env.STRIPE_PRICE_STANDARD_LIVE || process.env.STRIPE_PRICE_STANDARD);
  }
  return isPremium
    ? (process.env.STRIPE_PRICE_PREMIUM_TEST || process.env.STRIPE_PRICE_PREMIUM)
    : (process.env.STRIPE_PRICE_STANDARD_TEST || process.env.STRIPE_PRICE_STANDARD);
}

async function createCheckoutSession({ client, plan, successUrl, cancelUrl, coupon }) {
  const s = getStripe();
  if (!s) return null;

  const priceId = priceIdForPlan(plan);
  if (!priceId) throw new Error('Stripe price ID not configured for plan: ' + plan);

  let customerId = client.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({
      email: client.email,
      name: client.name,
      metadata: { clientId: client.id },
    });
    customerId = customer.id;
  }

  const sessionOpts = {
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { clientId: client.id, plan: (plan || 'standard').toLowerCase() },
    subscription_data: {
      trial_period_days: client.is_paid ? undefined : 14,
      metadata: { clientId: client.id },
    },
  };

  if (coupon) {
    try {
      const promo = await s.promotionCodes.list({ code: coupon, active: true, limit: 1 });
      if (promo.data[0]) sessionOpts.discounts = [{ promotion_code: promo.data[0].id }];
    } catch { /* ignore invalid coupon */ }
  }

  const session = await s.checkout.sessions.create(sessionOpts);
  return { session, customerId };
}

async function createPortalSession(customerId, returnUrl) {
  const s = getStripe();
  if (!s || !customerId) return null;
  const session = await s.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

module.exports = {
  getStripe,
  isStripeEnabled,
  stripeMode,
  resolveStripeSecretKey,
  resolveStripePublishableKey,
  createCheckoutSession,
  createPortalSession,
  priceIdForPlan,
};