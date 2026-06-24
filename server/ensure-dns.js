const { createSite, platformRoot } = require('./services/dns');

async function ensureDnsSites(db) {
  db.prepare("DELETE FROM sites WHERE domain LIKE '%localhost%' OR domain LIKE '%127.0.0.1%'").run();

  let root = process.env.PLATFORM_DOMAIN || platformRoot();
  if (root.includes('localhost') || root.includes('127.0.0.1')) root = 'upperroomdfw.com';
  const zoneId = process.env.ROUTE53_HOSTED_ZONE_ID || 'Z03688642MOTFG2SPA0LU';
  const cloudfront = process.env.CLOUDFRONT_DOMAIN || 'd4lzb9pq4mfuf.cloudfront.net';
  const amplify = process.env.AMPLIFY_DOMAIN || 'main.dbtc2f3y8pyam.amplifyapp.com';

  const platformSites = [
    { domain: root, name: 'Upper Room DFW', type: 'platform', source: 'seed' },
    { domain: 'tsbrenterprises.com', name: 'TSB Enterprises', type: 'platform', source: 'seed' },
    { domain: 'quantumpages.ai', name: 'Quantum Pages AI', type: 'quantum', source: 'seed' },
  ];

  for (const s of platformSites) {
    const exists = db.prepare('SELECT id FROM sites WHERE domain = ?').get(s.domain);
    if (exists) continue;
    try {
      await createSite(db, {
        domain: s.domain,
        name: s.name,
        type: s.type,
        hostedZoneId: s.domain === root ? zoneId : null,
        cloudfrontDomain: cloudfront,
        amplifyDomain: amplify,
        source: s.source,
        autoDefaults: s.domain === root,
        createZone: false,
      });
      console.log(`  DNS: seeded site ${s.domain}`);
    } catch (err) {
      console.warn(`  DNS: could not seed ${s.domain}:`, err.message);
    }
  }

  const clients = db.prepare("SELECT id, name, website, email FROM clients WHERE website IS NOT NULL AND website != ''").all();
  for (const c of clients) {
    try {
      const { ensureClientSite } = require('./services/dns');
      await ensureClientSite(db, c);
    } catch { /* skip */ }
  }
}

module.exports = { ensureDnsSites };