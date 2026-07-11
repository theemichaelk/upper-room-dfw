/**
 * Search Console verification token normalization — shared by build + runtime + API save.
 */

function normalizeVerificationToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const fromContent = s.match(/content\s*=\s*["']([^"']+)["']/i);
  if (fromContent) return fromContent[1].trim();
  return s.replace(/^<[^>]+>/i, '').replace(/<\/[^>]+>$/i, '').trim();
}

function normalizeSearchConsole(sc) {
  const input = sc || {};
  return {
    google: normalizeVerificationToken(input.google),
    bing: normalizeVerificationToken(input.bing),
    yahoo: normalizeVerificationToken(input.yahoo),
  };
}

module.exports = { normalizeVerificationToken, normalizeSearchConsole };