/**
 * Server-side 301 redirect layer — protects crawl budget before static delivery.
 */
const { normalizePath } = require('../services/duplicate-pages');

function createRedirectMiddleware(getRedirectsFn) {
  return function redirectMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();

    const data = getRedirectsFn();
    const rules = data?.redirects || [];
    const reqPath = normalizePath(req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path);
    const withHtml = reqPath.endsWith('.html') ? reqPath : reqPath + '.html';
    const indexVariant = reqPath + '/index.html';

    const rule = rules.find((r) => {
      const from = normalizePath(r.from);
      return from === reqPath || from === withHtml || from === indexVariant;
    });

    if (!rule) return next();

    const status = rule.status || 301;
    let target = rule.to;
    if (rule.external) {
      return res.redirect(status, target);
    }
    if (!target.startsWith('/')) target = '/' + target;
    return res.redirect(status, target);
  };
}

module.exports = { createRedirectMiddleware };