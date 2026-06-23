const buckets = new Map();

function prune() {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs * 2) buckets.delete(key);
  }
}

function createRateLimiter({ windowMs = 60000, max = 30, keyFn } = {}) {
  return (req, res, next) => {
    prune();
    const key = (keyFn || ((r) => r.ip || r.socket?.remoteAddress || 'unknown'))(req);
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0, windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}

const authLimiter = createRateLimiter({ windowMs: 15 * 60000, max: 20 });
const formLimiter = createRateLimiter({ windowMs: 60000, max: 10 });
const apiLimiter = createRateLimiter({ windowMs: 60000, max: 120 });

module.exports = { createRateLimiter, authLimiter, formLimiter, apiLimiter };