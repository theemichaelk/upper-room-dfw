#!/usr/bin/env node
/**
 * Stripe setup helper — verify keys, list products, print webhook URL.
 * Usage: node scripts/setup-stripe.js
 *        STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const APP_URL = process.env.APP_URL || 'https://upperroomdfw.com';

function mask(key) {
  if (!key) return '(not set)';
  return key.slice(0, 7) + '…' + key.slice(-4);
}

async function main() {
  console.log('\n  Upper Room DFW — Stripe Setup\n');
  console.log('  Webhook URL (add in Stripe Dashboard):');
  console.log('  ' + APP_URL + '/api/billing/webhook\n');

  const secret = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
  const pub = process.env.STRIPE_PUBLISHABLE_KEY_LIVE || process.env.STRIPE_PUBLISHABLE_KEY_TEST || process.env.STRIPE_PUBLISHABLE_KEY;
  const std = process.env.STRIPE_PRICE_STANDARD;
  const prem = process.env.STRIPE_PRICE_PREMIUM;
  const wh = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('  Env checklist:');
  console.log('    STRIPE_SECRET_KEY      ', mask(secret), secret ? '✓' : '✗');
  console.log('    STRIPE_PUBLISHABLE_KEY ', mask(pub), pub ? '✓' : '✗');
  console.log('    STRIPE_PRICE_STANDARD  ', std || '(not set)', std ? '✓' : '✗');
  console.log('    STRIPE_PRICE_PREMIUM   ', prem || '(not set)', prem ? '✓' : '✗');
  console.log('    STRIPE_WEBHOOK_SECRET  ', mask(wh), wh ? '✓' : '✗');
  console.log('');

  if (!secret) {
    console.log('  Set STRIPE_SECRET_KEY in Amplify env or .env, then re-run.\n');
    console.log('  Create products in Stripe:');
    console.log('    Standard — $29/month recurring');
    console.log('    Premium  — $79/month recurring');
    console.log('  Copy each Price ID to STRIPE_PRICE_STANDARD / STRIPE_PRICE_PREMIUM.\n');
    process.exit(0);
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(secret);

  try {
    const account = await stripe.accounts.retrieve();
    console.log('  Connected:', account.email || account.id, '| country:', account.country);

    if (std) {
      const p = await stripe.prices.retrieve(std);
      console.log('  Standard price:', p.unit_amount / 100, p.currency, p.recurring?.interval || 'one-time');
    }
    if (prem) {
      const p = await stripe.prices.retrieve(prem);
      console.log('  Premium price:', p.unit_amount / 100, p.currency, p.recurring?.interval || 'one-time');
    }

    const products = await stripe.products.list({ limit: 5, active: true });
    if (products.data.length) {
      console.log('\n  Recent Stripe products:');
      for (const prod of products.data) {
        const prices = await stripe.prices.list({ product: prod.id, limit: 3 });
        console.log('   -', prod.name, '| prices:', prices.data.map((x) => x.id).join(', ') || 'none');
      }
    }
    console.log('\n  Stripe connection OK.\n');
  } catch (err) {
    console.error('  Stripe error:', err.message);
    process.exit(1);
  }
}

main();