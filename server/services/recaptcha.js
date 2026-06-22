/**
 * Google reCAPTCHA v2 verification — skips when RECAPTCHA_SECRET_KEY is unset.
 */
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (!token) return { ok: false, error: 'reCAPTCHA required' };

  const params = new URLSearchParams({
    secret,
    response: token,
  });

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    return { ok: false, error: 'reCAPTCHA verification failed' };
  }
  return { ok: true };
}

function recaptchaSiteKey() {
  return process.env.RECAPTCHA_SITE_KEY || '';
}

module.exports = { verifyRecaptcha, recaptchaSiteKey };