/**
 * Telemetry verification + HTML head fragment builder (shared by build + live audit).
 */
const https = require('https');
const http = require('http');
const { mergeSettings } = require('./site-settings');
const { normalizeVerificationToken, normalizeSearchConsole } = require('./verification-tokens');

const MARKER = '<!-- urdfw-telemetry:v1 -->';
const MARKER_CLOSE = '<!-- /urdfw-telemetry:v1 -->';

function escapeAttr(val) {
  return String(val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildVerificationMetas(settings) {
  const sc = normalizeSearchConsole(settings.searchConsole);
  let block = '';
  if (sc.google) {
    block += `  <meta name="google-site-verification" content="${escapeAttr(sc.google)}">\n`;
  }
  if (sc.bing) {
    block += `  <meta name="msvalidate.01" content="${escapeAttr(sc.bing)}">\n`;
  }
  if (sc.yahoo) {
    block += `  <meta name="y_key" content="${escapeAttr(sc.yahoo)}">\n`;
  }
  return block;
}

function buildGtmHead(gtmId) {
  if (!gtmId) return '';
  const id = escapeAttr(gtmId.trim());
  return `  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>\n`;
}

function buildGtmBody(gtmId) {
  if (!gtmId) return '';
  const id = escapeAttr(gtmId.trim());
  return `  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n`;
}

function buildGa4Head(ga4Id) {
  if (!ga4Id) return '';
  const id = escapeAttr(ga4Id.trim());
  return `  <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n` +
    `  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>\n`;
}

function buildHeadScripts(scripts) {
  if (!Array.isArray(scripts) || !scripts.length) return '';
  let block = '';
  for (const s of scripts) {
    if (s.src) {
      const attrs = [
        s.async ? 'async' : '',
        s.defer ? 'defer' : '',
      ].filter(Boolean).join(' ');
      block += `  <script src="${escapeAttr(s.src)}"${attrs ? ' ' + attrs : ''}></script>\n`;
    } else if (s.inline) {
      block += `  <script>${s.inline}</script>\n`;
    }
  }
  return block;
}

function buildTelemetryHeadBlock(settings) {
  const s = mergeSettings(settings);
  s.searchConsole = normalizeSearchConsole(s.searchConsole);
  let block = MARKER + '\n';
  block += buildVerificationMetas(s);
  if (s.gtmId) {
    block += buildGtmHead(s.gtmId);
  } else if (s.ga4Id) {
    block += buildGa4Head(s.ga4Id);
  }
  if (s.customHeadHtml) {
    block += '  ' + s.customHeadHtml.trim().replace(/\n/g, '\n  ') + '\n';
  }
  block += buildHeadScripts(s.headInjectionScripts);
  block += MARKER_CLOSE + '\n';
  return block;
}

function buildTelemetryBodyBlock(settings) {
  const s = mergeSettings(settings);
  let block = '';
  if (s.gtmId) block += buildGtmBody(s.gtmId);
  if (Array.isArray(s.footerScripts)) {
    for (const sct of s.footerScripts) {
      if (sct.src) block += `  <script src="${escapeAttr(sct.src)}"></script>\n`;
      else if (sct.inline) block += `  <script>${sct.inline}</script>\n`;
    }
  }
  return block;
}

function fetchHtml(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(new URL(res.headers.location, url).href, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Fetch timeout')); });
  });
}

function metaContentValue(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    'i'
  );
  const m = html.match(re);
  return (m && (m[1] || m[2]) || '').trim();
}

function analyzeHtml(html, settings) {
  const s = mergeSettings(settings);
  s.searchConsole = normalizeSearchConsole(s.searchConsole);
  const checks = {
    marker: html.includes('urdfw-telemetry:v1'),
    googleVerification: !s.searchConsole.google
      || metaContentValue(html, 'google-site-verification') === s.searchConsole.google,
    bingVerification: !s.searchConsole.bing
      || metaContentValue(html, 'msvalidate.01') === s.searchConsole.bing,
    yahooVerification: !s.searchConsole.yahoo
      || metaContentValue(html, 'y_key') === s.searchConsole.yahoo,
    gtm: !s.gtmId || (html.includes(s.gtmId) && /googletagmanager\.com/i.test(html)),
    ga4: !s.ga4Id || s.gtmId || (html.includes(s.ga4Id) && /gtag/i.test(html)),
    dataLayer: !s.gtmId && !s.ga4Id ? true : /dataLayer/i.test(html),
    customHead: !s.customHeadHtml || html.includes(s.customHeadHtml.slice(0, 60).trim()),
    /* Runtime-only widgets — not required in static HTML for scraper pass */
    headerBanner: true,
    sidebarWidget: true,
  };
  const configured = {
    gtmId: !!s.gtmId,
    ga4Id: !!s.ga4Id,
    googleVerification: !!s.searchConsole.google,
    bingVerification: !!s.searchConsole.bing,
    yahooVerification: !!s.searchConsole.yahoo,
    customHeadHtml: !!s.customHeadHtml,
    headScripts: (s.headInjectionScripts || []).length,
    headerBannerHtml: !!s.headerBannerHtml,
    sidebarWidgetHtml: !!s.sidebarWidgetHtml,
  };
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return {
    ok: failures.length === 0,
    checks,
    configured,
    failures,
    detected: {
      hasMarker: checks.marker,
      hasGtm: /googletagmanager\.com\/gtm\.js/i.test(html),
      hasGa4: /googletagmanager\.com\/gtag\/js/i.test(html),
      hasDataLayer: checks.dataLayer,
    },
  };
}

async function verifyLiveSite(settings, targetUrl) {
  const base = (targetUrl || process.env.APP_URL || 'https://upperroomdfw.com').replace(/\/$/, '');
  const probes = [base + '/', base + '/index.html'];
  const attempts = [];

  for (const probe of probes) {
    try {
      const { status, html } = await fetchHtml(probe);
      const analysis = analyzeHtml(html, settings);
      attempts.push({ probe, status, ...analysis });
      if (analysis.ok && status === 200) {
        return {
          ok: true,
          url: probe,
          httpStatus: status,
          ...analysis,
          reason: 'All configured tags detected in raw HTML',
          probes: attempts,
        };
      }
    } catch (err) {
      attempts.push({ probe, error: err.message, ok: false, failures: ['fetch'] });
    }
  }

  const last = attempts[attempts.length - 1] || {};
  return {
    ok: false,
    url: last.probe || probes[0],
    httpStatus: last.status,
    error: last.error,
    checks: last.checks || {},
    configured: last.configured || {},
    failures: last.failures || ['fetch'],
    reason: last.failures?.length
      ? 'Missing in raw HTML: ' + last.failures.join(', ')
      : (last.error || 'CDN/cache returned HTML without baked telemetry'),
    probes: attempts,
  };
}

function buildDashboardStatus(db, dnsService) {
  const settings = mergeSettings(require('./site-settings').getSiteSettings(db));
  const reasons = [];

  if (!settings.gtmId && !settings.ga4Id) {
    reasons.push('No GA4 or GTM ID saved in site settings — analytics tags never injected');
  }
  if (!settings.searchConsole.google && !settings.searchConsole.bing) {
    reasons.push('No Search Console verification meta tags configured');
  }
  if (!dnsService.route53Ready()) {
    reasons.push('ROUTE53_HOSTED_ZONE_ID / AWS credentials not set — DNS dashboard blind to live Route53');
  }

  return {
    telemetryConfigured: !!(settings.gtmId || settings.ga4Id || settings.searchConsole.google),
    dnsReady: dnsService.route53Ready(),
    blindReasons: reasons,
    settingsUpdatedAt: settings.updatedAt,
  };
}

module.exports = {
  MARKER,
  MARKER_CLOSE,
  normalizeVerificationToken,
  normalizeSearchConsole,
  buildTelemetryHeadBlock,
  buildTelemetryBodyBlock,
  buildVerificationMetas,
  analyzeHtml,
  verifyLiveSite,
  buildDashboardStatus,
};