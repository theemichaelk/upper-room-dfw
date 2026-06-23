function isProduction() {
  return process.env.NODE_ENV === 'production'
    || (process.env.APP_URL || '').includes('upperroomdfw.com');
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function assertProductionSecrets() {
  if (!isProduction()) return;

  const weakJwt = !process.env.JWT_SECRET || process.env.JWT_SECRET === 'urdfw-dev-secret-change-in-production';
  if (weakJwt) {
    console.error('\n  FATAL: Set a strong JWT_SECRET in production (.env / Amplify).\n');
    process.exit(1);
  }

  const weakAdmin = process.env.ADMIN_PASSWORD === 'admin123';
  if (weakAdmin) {
    console.warn('  WARN: ADMIN_PASSWORD is still the default — use bcrypt admin users only.\n');
  }
}

module.exports = { securityHeaders, assertProductionSecrets, isProduction };