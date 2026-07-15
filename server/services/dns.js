const crypto = require('crypto');
const {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  GetHostedZoneCommand,
  CreateHostedZoneCommand,
  ListHostedZonesCommand,
} = require('@aws-sdk/client-route-53');

const VALID_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']);

function platformRoot() {
  if (process.env.PLATFORM_DOMAIN) return process.env.PLATFORM_DOMAIN.replace(/^www\./, '');
  try {
    const url = process.env.APP_URL || 'https://upperroomdfw.com';
    const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
    if (host.includes('localhost') || host.includes('127.0.0.1')) return 'upperroomdfw.com';
    return host;
  } catch {
    return 'upperroomdfw.com';
  }
}

function normalizeDomain(domain) {
  return (domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function fqdn(name, domain) {
  const n = (name || '@').trim();
  if (n === '@' || n === '' || n === domain) return domain + '.';
  if (n.endsWith('.')) return n;
  if (n.includes('.')) return n.endsWith(domain) ? n + '.' : n + '.' + domain + '.';
  return `${n}.${domain}.`;
}

function getRoute53() {
  return new Route53Client({ region: process.env.AWS_REGION || 'us-east-1' });
}

function route53Ready() {
  return !!(process.env.ROUTE53_HOSTED_ZONE_ID || process.env.AWS_ACCESS_KEY_ID);
}

function defaultCloudfront() {
  return process.env.CLOUDFRONT_DOMAIN || 'd4lzb9pq4mfuf.cloudfront.net';
}

function defaultAmplify() {
  return process.env.AMPLIFY_DOMAIN || 'main.dbtc2f3y8pyam.amplifyapp.com';
}

function siteToApi(row, records = []) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    domain: row.domain,
    type: row.type,
    hostedZoneId: row.hosted_zone_id,
    status: row.status,
    cloudfrontDomain: row.cloudfront_domain,
    amplifyDomain: row.amplify_domain,
    source: row.source,
    recordCount: records.length || row.record_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    type: row.record_type,
    name: row.name,
    value: row.value,
    ttl: row.ttl,
    priority: row.priority,
    route53Synced: !!row.route53_synced,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveHostedZoneId(site) {
  if (site.hosted_zone_id) return site.hosted_zone_id;
  const root = platformRoot();
  if (site.domain === root || site.domain.endsWith('.' + root)) {
    return process.env.ROUTE53_HOSTED_ZONE_ID || null;
  }
  return null;
}

async function upsertRoute53Record(hostedZoneId, { type, name, value, ttl, priority }) {
  const client = getRoute53();
  const recordType = type.toUpperCase();
  let resourceRecordSet = {
    Name: name,
    Type: recordType,
    TTL: ttl || 300,
    ResourceRecords: [],
  };

  if (recordType === 'MX') {
    const pri = priority != null ? priority : 10;
    resourceRecordSet.ResourceRecords = [{ Value: `${pri} ${value.replace(/^\d+\s+/, '')}` }];
  } else if (recordType === 'TXT') {
    const txt = value.startsWith('"') ? value : `"${value}"`;
    resourceRecordSet.ResourceRecords = [{ Value: txt }];
  } else if (recordType === 'CNAME' || recordType === 'NS') {
    const v = value.endsWith('.') ? value : value + '.';
    resourceRecordSet.ResourceRecords = [{ Value: v }];
  } else {
    resourceRecordSet.ResourceRecords = [{ Value: value }];
  }

  // CloudFront / ALB alias on apex
  if (recordType === 'A' && (value.includes('cloudfront.net') || value.startsWith('alias:'))) {
    const target = value.replace(/^alias:/, '');
    resourceRecordSet = {
      Name: name,
      Type: 'A',
      AliasTarget: {
        HostedZoneId: process.env.CLOUDFRONT_HOSTED_ZONE_ID || 'Z2FDTNDATAQYW2',
        DNSName: target.endsWith('.') ? target : target + '.',
        EvaluateTargetHealth: false,
      },
    };
    delete resourceRecordSet.TTL;
    delete resourceRecordSet.ResourceRecords;
  }

  await client.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [{ Action: 'UPSERT', ResourceRecordSet: resourceRecordSet }],
    },
  }));
  return true;
}

async function deleteRoute53Record(hostedZoneId, { type, name, value, ttl, priority }) {
  const client = getRoute53();
  const recordType = type.toUpperCase();
  let resourceRecordSet = {
    Name: name,
    Type: recordType,
    TTL: ttl || 300,
    ResourceRecords: [],
  };

  if (recordType === 'A' && (String(value).includes('cloudfront.net') || String(value).startsWith('alias:'))) {
    const target = String(value).replace(/^alias:/, '');
    resourceRecordSet = {
      Name: name,
      Type: 'A',
      AliasTarget: {
        HostedZoneId: process.env.CLOUDFRONT_HOSTED_ZONE_ID || 'Z2FDTNDATAQYW2',
        DNSName: target.endsWith('.') ? target : target + '.',
        EvaluateTargetHealth: false,
      },
    };
  } else if (recordType === 'MX') {
    const pri = priority != null ? priority : 10;
    resourceRecordSet.ResourceRecords = [{ Value: `${pri} ${String(value).replace(/^\d+\s+/, '')}` }];
  } else if (recordType === 'TXT') {
    const txt = String(value).startsWith('"') ? value : `"${value}"`;
    resourceRecordSet.ResourceRecords = [{ Value: txt }];
  } else if (recordType === 'CNAME' || recordType === 'NS') {
    const v = String(value).endsWith('.') ? value : value + '.';
    resourceRecordSet.ResourceRecords = [{ Value: v }];
  } else {
    resourceRecordSet.ResourceRecords = [{ Value: value }];
  }

  await client.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [{ Action: 'DELETE', ResourceRecordSet: resourceRecordSet }],
    },
  }));
}

async function getNameservers(hostedZoneId) {
  if (!hostedZoneId || !route53Ready()) return [];
  try {
    const res = await getRoute53().send(new GetHostedZoneCommand({ Id: hostedZoneId }));
    return res.DelegationSet?.NameServers || [];
  } catch {
    return [];
  }
}

async function createHostedZone(domain) {
  const client = getRoute53();
  const res = await client.send(new CreateHostedZoneCommand({
    Name: domain + '.',
    CallerReference: 'urdfw-' + Date.now(),
  }));
  return {
    hostedZoneId: res.HostedZone?.Id?.replace('/hostedzone/', ''),
    nameservers: res.DelegationSet?.NameServers || [],
  };
}

function listSites(db, opts = {}) {
  let sql = 'SELECT s.*, (SELECT COUNT(*) FROM dns_records r WHERE r.site_id = s.id) AS record_count FROM sites s';
  const params = [];
  if (opts.clientId) {
    sql += ' WHERE s.client_id = ?';
    params.push(opts.clientId);
  } else if (opts.type) {
    sql += ' WHERE s.type = ?';
    params.push(opts.type);
  }
  sql += ' ORDER BY s.type ASC, s.domain ASC';
  return db.prepare(sql).all(...params).map((r) => siteToApi(r));
}

function getSite(db, id) {
  const row = db.prepare('SELECT * FROM sites WHERE id = ? OR domain = ?').get(id, id);
  return row ? siteToApi(row) : null;
}

function getSiteRow(db, id) {
  return db.prepare('SELECT * FROM sites WHERE id = ? OR domain = ?').get(id, id);
}

function listRecords(db, siteId) {
  return db.prepare('SELECT * FROM dns_records WHERE site_id = ? ORDER BY name, record_type').all(siteId)
    .map(recordToApi);
}

async function createSite(db, data) {
  const domain = normalizeDomain(data.domain);
  if (!domain) throw new Error('Domain required');

  const existing = db.prepare('SELECT id FROM sites WHERE domain = ?').get(domain);
  if (existing) throw new Error('Domain already registered');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let hostedZoneId = data.hostedZoneId || null;

  if (!hostedZoneId && data.createZone && route53Ready()) {
    const zone = await createHostedZone(domain);
    hostedZoneId = zone.hostedZoneId;
  } else if (!hostedZoneId && (domain === platformRoot() || domain.endsWith('.' + platformRoot()))) {
    hostedZoneId = process.env.ROUTE53_HOSTED_ZONE_ID || null;
  }

  db.prepare(`
    INSERT INTO sites (id, client_id, name, domain, type, hosted_zone_id, status, cloudfront_domain, amplify_domain, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.clientId || null,
    data.name || domain,
    domain,
    data.type || (data.clientId ? 'client' : 'platform'),
    hostedZoneId,
    'active',
    data.cloudfrontDomain || defaultCloudfront(),
    data.amplifyDomain || defaultAmplify(),
    data.source || 'manual',
    now,
    now,
  );

  if (data.autoDefaults) {
    await seedDefaultRecords(db, id);
  }

  return getSite(db, id);
}

async function seedDefaultRecords(db, siteId) {
  const site = getSiteRow(db, siteId);
  if (!site) return;

  const presets = [
    { name: '@', type: 'A', value: 'alias:' + (site.cloudfront_domain || defaultCloudfront()), ttl: 300 },
    { name: 'www', type: 'CNAME', value: site.domain, ttl: 300 },
    { name: 'api', type: 'CNAME', value: site.amplify_domain || defaultAmplify(), ttl: 300 },
  ];

  for (const p of presets) {
    try {
      await addRecord(db, siteId, { ...p, skipDuplicate: true });
    } catch { /* ignore dupes */ }
  }
}

async function addRecord(db, siteId, data) {
  const site = getSiteRow(db, siteId);
  if (!site) throw new Error('Site not found');

  const type = (data.type || 'A').toUpperCase();
  if (!VALID_TYPES.has(type)) throw new Error('Invalid record type: ' + type);

  const name = data.name || '@';
  const value = (data.value || '').trim();
  if (!value) throw new Error('Record value required');

  const recordName = fqdn(name, site.domain);
  const dup = db.prepare('SELECT id FROM dns_records WHERE site_id = ? AND record_type = ? AND name = ? AND value = ?')
    .get(siteId, type, name, value);
  if (dup && data.skipDuplicate) return recordToApi(db.prepare('SELECT * FROM dns_records WHERE id = ?').get(dup.id));

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let status = 'pending';
  let route53Synced = 0;
  let error = null;

  const zoneId = resolveHostedZoneId(site);
  if (zoneId && route53Ready()) {
    try {
      await upsertRoute53Record(zoneId, {
        type,
        name: recordName,
        value,
        ttl: data.ttl || 300,
        priority: data.priority,
      });
      status = 'active';
      route53Synced = 1;
    } catch (err) {
      status = 'error';
      error = err.message;
    }
  } else {
    status = 'external';
  }

  db.prepare(`
    INSERT INTO dns_records (id, site_id, record_type, name, value, ttl, priority, route53_synced, status, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, siteId, type, name, value, data.ttl || 300, data.priority || null, route53Synced, status, error, now, now);

  return recordToApi(db.prepare('SELECT * FROM dns_records WHERE id = ?').get(id));
}

async function removeRecord(db, recordId) {
  const row = db.prepare('SELECT r.*, s.domain, s.hosted_zone_id FROM dns_records r JOIN sites s ON s.id = r.site_id WHERE r.id = ?').get(recordId);
  if (!row) throw new Error('Record not found');

  const zoneId = resolveHostedZoneId(row);
  if (zoneId && row.route53_synced && route53Ready()) {
    try {
      await deleteRoute53Record(zoneId, {
        type: row.record_type,
        name: fqdn(row.name, row.domain),
        value: row.value,
        ttl: row.ttl,
        priority: row.priority,
      });
    } catch { /* best effort — still remove local row */ }
  }

  db.prepare('DELETE FROM dns_records WHERE id = ?').run(recordId);
  return { ok: true };
}

/**
 * Update an existing DNS record (edit name/type/value/TTL).
 * When Route53 is live: DELETE old set then UPSERT new (covers type/name changes).
 */
async function updateRecord(db, recordId, data) {
  const row = db.prepare('SELECT r.*, s.domain, s.hosted_zone_id FROM dns_records r JOIN sites s ON s.id = r.site_id WHERE r.id = ?').get(recordId);
  if (!row) throw new Error('Record not found');

  const type = (data.type || row.record_type || 'A').toUpperCase();
  if (!VALID_TYPES.has(type)) throw new Error('Invalid record type: ' + type);

  const name = (data.name != null ? data.name : row.name) || '@';
  const value = (data.value != null ? String(data.value) : row.value || '').trim();
  if (!value) throw new Error('Record value required');
  const ttl = data.ttl != null ? parseInt(data.ttl, 10) || 300 : (row.ttl || 300);
  const priority = data.priority != null ? parseInt(data.priority, 10) : row.priority;

  const zoneId = resolveHostedZoneId(row);
  let status = row.status || 'pending';
  let route53Synced = row.route53_synced ? 1 : 0;
  let error = null;
  const now = new Date().toISOString();

  if (zoneId && route53Ready()) {
    try {
      /* Remove previous RRset when name/type/value changed and it was synced */
      if (row.route53_synced) {
        try {
          await deleteRoute53Record(zoneId, {
            type: row.record_type,
            name: fqdn(row.name, row.domain),
            value: row.value,
            ttl: row.ttl,
            priority: row.priority,
          });
        } catch { /* may already be gone or alias form */ }
      }
      await upsertRoute53Record(zoneId, {
        type,
        name: fqdn(name, row.domain),
        value,
        ttl,
        priority,
      });
      status = 'active';
      route53Synced = 1;
    } catch (err) {
      status = 'error';
      error = err.message;
    }
  } else {
    status = 'external';
    route53Synced = 0;
  }

  db.prepare(`
    UPDATE dns_records
    SET record_type = ?, name = ?, value = ?, ttl = ?, priority = ?,
        route53_synced = ?, status = ?, error = ?, updated_at = ?
    WHERE id = ?
  `).run(type, name, value, ttl, priority, route53Synced, status, error, now, recordId);

  return recordToApi(db.prepare('SELECT * FROM dns_records WHERE id = ?').get(recordId));
}

async function syncSiteFromRoute53(db, siteId) {
  const site = getSiteRow(db, siteId);
  if (!site) throw new Error('Site not found');
  const zoneId = resolveHostedZoneId(site);
  if (!zoneId || !route53Ready()) throw new Error('Route53 not configured for this site');

  const client = getRoute53();
  const res = await client.send(new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }));
  const sets = res.ResourceRecordSets || [];
  let imported = 0;
  const now = new Date().toISOString();

  for (const rr of sets) {
    /* Import NS (including apex) so SEO/DNS editor can show & manage them; skip SOA only */
    if (rr.Type === 'SOA') continue;
    const shortName = rr.Name.replace(new RegExp('\\.?' + site.domain.replace(/\./g, '\\.') + '\\.?$'), '') || '@';
    const nameKey = shortName === site.domain ? '@' : shortName.replace(/\.$/, '');
    const values = rr.AliasTarget
      ? ['alias:' + rr.AliasTarget.DNSName.replace(/\.$/, '')]
      : (rr.ResourceRecords || []).map((r) => r.Value.replace(/^"|"$/g, '').replace(/\.$/, rr.Type === 'NS' || rr.Type === 'CNAME' ? '' : ''));

    for (const val of values) {
      let normalized = val;
      if ((rr.Type === 'NS' || rr.Type === 'CNAME') && normalized.endsWith('.')) {
        normalized = normalized.slice(0, -1);
      }
      const exists = db.prepare('SELECT id FROM dns_records WHERE site_id = ? AND record_type = ? AND name = ? AND value = ?')
        .get(siteId, rr.Type, nameKey, normalized);
      if (exists) continue;

      db.prepare(`
        INSERT INTO dns_records (id, site_id, record_type, name, value, ttl, route53_synced, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
      `).run(crypto.randomUUID(), siteId, rr.Type, nameKey, normalized, rr.TTL || 300, now, now);
      imported += 1;
    }
  }

  return { ok: true, imported };
}

async function ensureClientSite(db, client) {
  const website = normalizeDomain(client.website);
  if (!website || website.includes('upperroomdfw.com')) return null;

  const existing = db.prepare('SELECT id FROM sites WHERE domain = ?').get(website);
  if (existing) {
    if (client.id) db.prepare('UPDATE sites SET client_id = ?, updated_at = ? WHERE id = ?').run(client.id, new Date().toISOString(), existing.id);
    return getSite(db, existing.id);
  }

  return createSite(db, {
    domain: website,
    name: client.name || website,
    clientId: client.id,
    type: 'client',
    createZone: false,
    autoDefaults: true,
    source: 'client-website',
  });
}

async function verifyDns() {
  if (!route53Ready()) {
    return { ok: false, provider: 'route53', error: 'ROUTE53_HOSTED_ZONE_ID or AWS credentials not set' };
  }
  try {
    const zoneId = process.env.ROUTE53_HOSTED_ZONE_ID;
    if (zoneId) {
      const ns = await getNameservers(zoneId);
      return { ok: true, provider: 'route53', hostedZoneId: zoneId, nameservers: ns, message: 'Route53 connected' };
    }
    const zones = await getRoute53().send(new ListHostedZonesCommand({ MaxItems: '5' }));
    return { ok: true, provider: 'route53', zones: (zones.HostedZones || []).length, message: 'Route53 API connected' };
  } catch (err) {
    return { ok: false, provider: 'route53', error: err.message };
  }
}

module.exports = {
  VALID_TYPES,
  normalizeDomain,
  siteToApi,
  recordToApi,
  listSites,
  getSite,
  createSite,
  listRecords,
  addRecord,
  updateRecord,
  removeRecord,
  syncSiteFromRoute53,
  ensureClientSite,
  getNameservers,
  verifyDns,
  route53Ready,
  platformRoot,
};