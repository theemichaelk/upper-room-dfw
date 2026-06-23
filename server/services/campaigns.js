/**
 * Production email campaigns — mirrors js/platform/10-admin.js templates.
 * All sends go through Amazon SES SMTP (nodemailer).
 */
const templates = require('./email-templates');
const { sendEmail } = require('./email');
const { shortenUrl } = require('./tinyurl');

const CAMPAIGN_KEYS = [
  'welcome',
  'forgot_password',
  'order',
  'subscription_reminder',
  'contact_auto_reply',
  'contact_admin',
  'digest',
  'subscriber_welcome',
  'listing_approved',
  'payment_receipt',
  'lead_notification',
];

function listCampaigns() {
  return CAMPAIGN_KEYS.map((key) => ({
    key,
    ...templates.campaignMeta(key),
  }));
}

async function maybeShorten(url) {
  if (!url || !process.env.TINYURL_API_TOKEN) return url;
  const r = await shortenUrl(url).catch(() => null);
  return r?.ok ? r.tinyUrl : url;
}

async function sendCampaign(templateKey, data = {}) {
  const built = await templates.buildCampaign(templateKey, data, { maybeShorten });
  if (!built) return { ok: false, error: 'Unknown campaign: ' + templateKey };
  const to = data.email || data.to;
  if (!to) return { ok: false, error: 'Recipient email required' };

  const result = await sendEmail({ to, subject: built.subject, html: built.html, text: built.text });
  return { ok: true, templateKey, to, messageId: result.messageId };
}

module.exports = { CAMPAIGN_KEYS, listCampaigns, sendCampaign };