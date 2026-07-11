/**
 * Global CDN cache invalidation — CloudFront + Cloudflare.
 */
const { execSync } = require('child_process');
const https = require('https');

function invalidateCloudFront(opts = {}) {
  const distId = opts.distributionId || process.env.CLOUDFRONT_DIST_ID || 'EI9QWFII46LGX';
  const region = opts.region || process.env.AWS_REGION || 'us-east-2';
  const paths = opts.paths || ['/*'];
  const pathsArg = paths.map((p) => `"${p}"`).join(' ');

  try {
    const out = execSync(
      `aws cloudfront create-invalidation --distribution-id ${distId} --paths ${pathsArg} --region ${region} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const json = JSON.parse(out);
    return {
      ok: true,
      provider: 'cloudfront',
      distributionId: distId,
      invalidationId: json?.Invalidation?.Id,
      status: json?.Invalidation?.Status,
      paths,
    };
  } catch (err) {
    return { ok: false, provider: 'cloudfront', error: err.stderr?.toString() || err.message };
  }
}

function purgeCloudflare(opts = {}) {
  const zoneId = opts.zoneId || process.env.CLOUDFLARE_ZONE_ID;
  const token = opts.apiToken || process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !token) {
    return { ok: false, provider: 'cloudflare', skipped: true, error: 'CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set' };
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
  results.push(invalidateCloudFront(opts));
  results.push(await purgeCloudflare(opts));
  return {
    ok: results.every((r) => r.ok || r.skipped),
    results,
    at: new Date().toISOString(),
  };
}

module.exports = {
  invalidateCloudFront,
  purgeCloudflare,
  invalidateAll,
};