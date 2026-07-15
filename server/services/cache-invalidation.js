/**
 * Global CDN cache invalidation — CloudFront (AWS SDK) + Cloudflare.
 * Avoids shelling out to `aws` CLI (not available on Amplify Lambda).
 */
const https = require('https');

let CloudFrontClient;
let CreateInvalidationCommand;

function getCloudFrontClient() {
  if (!CloudFrontClient) {
    ({ CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront'));
  }
  return new CloudFrontClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2',
  });
}

async function invalidateCloudFront(opts = {}) {
  const distId = opts.distributionId || process.env.CLOUDFRONT_DIST_ID || 'EI9QWFII46LGX';
  const paths = (opts.paths && opts.paths.length) ? opts.paths : ['/*'];
  const callerRef = 'urdfw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  try {
    const client = getCloudFrontClient();
    const out = await client.send(new CreateInvalidationCommand({
      DistributionId: distId,
      InvalidationBatch: {
        CallerReference: callerRef,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    }));
    return {
      ok: true,
      provider: 'cloudfront',
      distributionId: distId,
      invalidationId: out?.Invalidation?.Id,
      status: out?.Invalidation?.Status,
      paths,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'cloudfront',
      distributionId: distId,
      error: err.message || String(err),
      paths,
    };
  }
}

function purgeCloudflare(opts = {}) {
  const zoneId = opts.zoneId || process.env.CLOUDFLARE_ZONE_ID;
  const token = opts.apiToken || process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !token) {
    return Promise.resolve({
      ok: true,
      provider: 'cloudflare',
      skipped: true,
      reason: 'CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set',
    });
  }

  const body = JSON.stringify(
    opts.urls?.length
      ? { files: opts.urls }
      : { purge_everything: true }
  );

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${zoneId}/purge_cache`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            ok: !!json.success,
            provider: 'cloudflare',
            result: json.result,
            errors: json.errors,
          });
        } catch (err) {
          resolve({ ok: false, provider: 'cloudflare', error: err.message, raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, provider: 'cloudflare', error: err.message }));
    req.write(body);
    req.end();
  });
}

async function invalidateAll(opts = {}) {
  const results = [];
  results.push(await invalidateCloudFront(opts));
  results.push(await purgeCloudflare(opts));
  const hardFail = results.some((r) => r.ok === false && !r.skipped);
  return {
    ok: !hardFail,
    results,
    at: new Date().toISOString(),
  };
}

module.exports = {
  invalidateCloudFront,
  purgeCloudflare,
  invalidateAll,
};
