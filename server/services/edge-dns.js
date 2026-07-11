/**
 * Edge DNS Integrity Monitor — public resolver probes for NS, A, and CNAME propagation.
 * Complements Route53 admin API with what the internet actually sees at the edge.
 */
const dns = require('dns').promises;
const dnsService = require('./dns');

function apexDomain(domain) {
  return (domain || dnsService.platformRoot())
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase();
}

function normalizeValues(values) {
  return (values || []).map((v) => String(v).replace(/\.$/, '').toLowerCase()).sort();
}

function arraysMatch(a, b) {
  const x = normalizeValues(a);
  const y = normalizeValues(b);
  if (!x.length && !y.length) return true;
  if (!x.length || !y.length) return false;
  return x.join('|') === y.join('|');
}

function arraysOverlap(a, b) {
  const x = new Set(normalizeValues(a));
  return normalizeValues(b).some((v) => x.has(v));
}

async function safeResolve(fn, label) {
  try {
    const values = await fn();
    return { ok: true, values: normalizeValues(values), error: null, label };
  } catch (err) {
    return { ok: false, values: [], error: err.code || err.message, label };
  }
}

/**
 * Probe authoritative + recursive DNS for apex NS, apex A, www A/CNAME, api CNAME.
 */
async function probeEdgeDns(domain) {
  const apex = apexDomain(domain);
  const cf = (process.env.CLOUDFRONT_DOMAIN || 'd4lzb9pq4mfuf.cloudfront.net').toLowerCase();
  const amp = (process.env.AMPLIFY_DOMAIN || 'main.dbtc2f3y8pyam.amplifyapp.com').toLowerCase();

  const [nsApex, aApex, aWww, cnameWww, cnameApi] = await Promise.all([
    safeResolve(() => dns.resolveNs(apex), 'NS'),
    safeResolve(() => dns.resolve4(apex), 'A@apex'),
    safeResolve(() => dns.resolve4('www.' + apex), 'A@www'),
    safeResolve(() => dns.resolveCname('www.' + apex), 'CNAME@www'),
    safeResolve(() => dns.resolveCname('api.' + apex), 'CNAME@api'),
  ]);

  let route53Ns = [];
  if (dnsService.route53Ready() && process.env.ROUTE53_HOSTED_ZONE_ID) {
    try {
      route53Ns = normalizeValues(await dnsService.getNameservers(process.env.ROUTE53_HOSTED_ZONE_ID));
    } catch { /* best effort */ }
  }

  const wwwPointsToCloudfront = arraysOverlap(cnameWww.values, [cf, apex])
    || (aWww.ok && aWww.values.length > 0);
  const apiPointsToAmplify = arraysOverlap(cnameApi.values, [amp]);
  const apexResolves = aApex.ok && aApex.values.length > 0;
  const nsPropagated = route53Ns.length
    ? arraysOverlap(nsApex.values, route53Ns)
    : nsApex.ok && nsApex.values.length > 0;

  const checks = [
    { id: 'nameservers', label: 'Nameservers', ok: nsPropagated, detail: nsApex.values },
    { id: 'apexA', label: 'A @ apex', ok: apexResolves, detail: aApex.values },
    { id: 'www', label: 'www → apex/CDN', ok: wwwPointsToCloudfront, detail: cnameWww.values.length ? cnameWww.values : aWww.values },
    { id: 'apiCname', label: 'api → Amplify', ok: apiPointsToAmplify, detail: cnameApi.values },
  ];

  const failed = checks.filter((c) => !c.ok).map((c) => c.id);
  const score = checks.filter((c) => c.ok).length;

  return {
    ok: failed.length === 0,
    domain: apex,
    checkedAt: new Date().toISOString(),
    expected: {
      cloudfront: cf,
      amplify: amp,
      route53Nameservers: route53Ns,
    },
    nameservers: {
      resolved: nsApex.values,
      expected: route53Ns,
      propagated: nsPropagated,
      error: nsApex.error,
    },
    aRecords: {
      apex: { resolved: aApex.values, ok: apexResolves, error: aApex.error },
      www: { resolved: aWww.values, ok: aWww.ok, error: aWww.error },
    },
    cnames: {
      www: { resolved: cnameWww.values, ok: cnameWww.ok, pointsToCdn: wwwPointsToCloudfront, error: cnameWww.error },
      api: { resolved: cnameApi.values, ok: cnameApi.ok, pointsToAmplify: apiPointsToAmplify, error: cnameApi.error },
    },
    checks,
    propagation: {
      status: score === checks.length ? 'healthy' : score >= 2 ? 'partial' : 'degraded',
      score: `${score}/${checks.length}`,
      failures: failed,
    },
    route53Ready: dnsService.route53Ready(),
  };
}

module.exports = { probeEdgeDns, apexDomain, normalizeValues };