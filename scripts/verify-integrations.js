#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { verifyAll } = require('../server/services/integrations');
const { adminEmailList } = require('../server/ensure-admins');

async function main() {
  console.log('Integration verification\n');
  console.log('Admin emails:', adminEmailList().join(', '));

  const report = await verifyAll();
  for (const r of report.results) {
    const icon = r.ok ? '✓' : '✗';
    const detail = r.ok ? (r.message || 'ok') : (r.error || 'failed');
    console.log(`  ${icon} ${r.provider}: ${detail}`);
    if (r.provider === 'stripe' && r.ok && !r.pricesConfigured) {
      console.log('    → Add STRIPE_PRICE_STANDARD and STRIPE_PRICE_PREMIUM in .env for checkout');
    }
  }

  console.log('\n--- RESULT ---');
  console.log(report.ok ? 'All integrations connected' : 'Some integrations need attention');
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});