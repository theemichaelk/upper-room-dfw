const BRAND = {
  primary: '#0369a1',
  dark: '#0c4a6e',
  name: 'Upper Room DFW',
  tagline: 'The trusted local church directory for Dallas–Fort Worth',
  footer: 'Powered By The Stone Builders Rejected — Michael K',
  phone: '(682) 358-3942',
  email: 'michaelk@tsbrenterprises.com',
};

function layout({ title, preheader, bodyHtml, ctaUrl, ctaLabel }) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  const cta = ctaUrl
    ? `<p style="margin:28px 0 0"><a href="${ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px">${ctaLabel || 'Open Dashboard'}</a></p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,system-ui,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${preheader || title}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
<tr><td style="background:linear-gradient(135deg,${BRAND.dark},${BRAND.primary});padding:28px 32px;color:#fff">
<div style="font-size:13px;opacity:.85;letter-spacing:.08em;text-transform:uppercase">Upper Room DFW</div>
<div style="font-size:22px;font-weight:700;margin-top:6px">${title}</div>
</td></tr>
<tr><td style="padding:32px;color:#334155;font-size:15px;line-height:1.65">${bodyHtml}${cta}</td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5">
${BRAND.tagline}<br>
<a href="${appUrl}" style="color:${BRAND.primary}">${appUrl.replace(/^https?:\/\//, '')}</a> · ${BRAND.phone}<br>
<span style="color:#94a3b8">${BRAND.footer}</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function welcomeEmail(name) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: 'Welcome to Upper Room DFW — your 14-day trial starts now',
    html: layout({
      title: 'Welcome aboard',
      preheader: 'Complete your church listing and reach DFW families.',
      bodyHtml: `
        <p>Hi <strong>${escapeHtml(name || 'there')}</strong>,</p>
        <p>Thank you for registering with <strong>Upper Room DFW</strong>. Your church listing is in review and your <strong>14-day free trial</strong> has started.</p>
        <p>Next steps:</p>
        <ol style="padding-left:20px;margin:12px 0">
          <li>Sign in to your member dashboard</li>
          <li>Complete your listing profile, photos, and service times</li>
          <li>Choose Standard ($29/mo) or Premium ($79/mo) when you're ready to go live</li>
        </ol>`,
      ctaUrl: appUrl + '/member-dashboard.html',
      ctaLabel: 'Open Member Dashboard',
    }),
    text: `Hi ${name}, welcome to Upper Room DFW. Open your dashboard: ${appUrl}/member-dashboard.html`,
  };
}

function passwordResetEmail(token) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  const link = `${appUrl}/member-dashboard.html?reset=${token}`;
  return {
    subject: 'Reset your Upper Room DFW password',
    html: layout({
      title: 'Password reset',
      preheader: 'This link expires in 1 hour.',
      bodyHtml: `
        <p>We received a request to reset your password.</p>
        <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
        <p style="font-size:13px;color:#64748b;word-break:break-all">Or copy: ${link}</p>`,
      ctaUrl: link,
      ctaLabel: 'Reset Password',
    }),
    text: `Reset your password: ${link}`,
  };
}

function leadNotificationEmail(lead) {
  return {
    subject: `New directory lead: ${lead.name || 'Someone'} contacted you`,
    html: layout({
      title: 'New lead from Upper Room DFW',
      preheader: `${lead.name || 'A visitor'} sent a message through your listing.`,
      bodyHtml: `
        <p><strong>${escapeHtml(lead.name || 'Visitor')}</strong> reached out through your Upper Room DFW listing.</p>
        <table style="width:100%;margin:16px 0;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#64748b;width:80px">Email</td><td><a href="mailto:${escapeHtml(lead.email || '')}">${escapeHtml(lead.email || '—')}</a></td></tr>
          ${lead.phone ? `<tr><td style="padding:8px 0;color:#64748b">Phone</td><td>${escapeHtml(lead.phone)}</td></tr>` : ''}
        </table>
        <div style="background:#f8fafc;border-left:4px solid ${BRAND.primary};padding:16px;border-radius:0 8px 8px 0;margin-top:12px">
          ${escapeHtml(lead.message || '')}
        </div>`,
    }),
    text: `New lead from ${lead.name} (${lead.email}): ${lead.message}`,
  };
}

function paymentReceiptEmail(amount, plan) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: `Payment received — ${plan} plan · Upper Room DFW`,
    html: layout({
      title: 'Payment confirmed',
      preheader: `Thank you for your $${amount} ${plan} subscription.`,
      bodyHtml: `
        <p>We've received your payment of <strong>$${amount}</strong> for the <strong>${escapeHtml(plan)}</strong> plan.</p>
        <p>Your listing benefits are now active. Manage billing anytime from your dashboard.</p>`,
      ctaUrl: appUrl + '/member-dashboard.html',
      ctaLabel: 'View Billing',
    }),
    text: `Payment received: $${amount} for ${plan} plan.`,
  };
}

const CAMPAIGN_META = {
  welcome: { subject: 'Welcome to Upper Room DFW', trigger: 'user.registered' },
  forgot_password: { subject: 'Reset your password', trigger: 'auth.forgot' },
  order: { subject: 'Order confirmation', trigger: 'payment.completed' },
  subscription_reminder: { subject: 'Subscription renews soon', trigger: 'billing.reminder' },
  contact_auto_reply: { subject: 'We received your message', trigger: 'support.created' },
  contact_admin: { subject: 'New contact form submission', trigger: 'support.created' },
  digest: { subject: 'Weekly DFW Church Digest', trigger: 'newsletter.digest' },
  subscriber_welcome: { subject: 'You are subscribed to DFW faith updates', trigger: 'subscriber.added' },
  listing_approved: { subject: 'Your listing is approved', trigger: 'client.approved' },
  payment_receipt: { subject: 'Payment received', trigger: 'payment.completed' },
  lead_notification: { subject: 'New directory lead', trigger: 'lead.created' },
};

function campaignMeta(key) {
  return CAMPAIGN_META[key] || { subject: key, trigger: 'manual' };
}

function orderConfirmationEmail(data) {
  const order = data.order || {};
  const amount = order.amount ?? data.amount ?? 0;
  const gateway = order.gateway || data.gateway || 'stripe';
  const plan = order.plan || data.plan || 'standard';
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: `Order confirmation #${order.id || order.ref || 'URDFW'}`,
    html: layout({
      title: 'Order confirmed',
      preheader: `Thank you! $${amount} charged via ${gateway}.`,
      bodyHtml: `
        <p>Thank you for your <strong>${escapeHtml(plan)}</strong> subscription.</p>
        <p>Amount: <strong>$${amount}</strong> · Gateway: <strong>${escapeHtml(gateway)}</strong></p>
        <p>Reference: ${escapeHtml(order.ref || order.id || '—')}</p>`,
      ctaUrl: appUrl + '/member-dashboard.html',
      ctaLabel: 'View Dashboard',
    }),
    text: `Order confirmed: $${amount} via ${gateway}. Ref: ${order.ref || order.id}`,
  };
}

function subscriptionReminderEmail(data) {
  const plan = data.plan || data.order?.plan || 'Standard';
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: 'Your Upper Room DFW subscription renews soon',
    html: layout({
      title: 'Renewal reminder',
      preheader: `Your ${plan} plan renews in 3 days.`,
      bodyHtml: `
        <p>Your <strong>${escapeHtml(plan)}</strong> plan renews in <strong>3 days</strong>.</p>
        <p>Update billing anytime from your member dashboard.</p>`,
      ctaUrl: appUrl + '/member-dashboard.html?tab=billing',
      ctaLabel: 'Manage Billing',
    }),
    text: `Your ${plan} plan renews in 3 days. Manage billing: ${appUrl}/member-dashboard.html`,
  };
}

function contactAutoReplyEmail(data) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  const name = data.name || 'there';
  return {
    subject: 'We received your message — Upper Room DFW',
    html: layout({
      title: 'Message received',
      preheader: 'Thanks for contacting Upper Room DFW. We reply within 24 hours.',
      bodyHtml: `
        <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
        <p>Thanks for contacting <strong>Upper Room DFW</strong>. We received your message and will reply within <strong>24 business hours</strong>.</p>
        <p>In the meantime, explore churches and events across DFW in our directory.</p>`,
      ctaUrl: appUrl + '/directory.html',
      ctaLabel: 'Browse Directory',
    }),
    text: `Hi ${name}, we received your message and will reply within 24 hours.`,
  };
}

function contactAdminEmail(data) {
  return {
    subject: `New contact: ${data.name || data.email || 'Visitor'}`,
    html: layout({
      title: 'New contact submission',
      bodyHtml: `
        <p><strong>From:</strong> ${escapeHtml(data.name || 'Visitor')} &lt;${escapeHtml(data.email || '')}&gt;</p>
        <p><strong>Topic:</strong> ${escapeHtml(data.topic || 'General')}</p>
        <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-top:12px">${escapeHtml(data.message || '')}</div>`,
    }),
    text: `Contact from ${data.name} (${data.email}): ${data.message}`,
  };
}

function digestEmail(data) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  const directoryUrl = data.directoryUrl || appUrl + '/directory.html';
  return {
    subject: 'Weekly DFW Church Digest — Upper Room DFW',
    html: layout({
      title: 'Weekly DFW Church Digest',
      preheader: 'This week in DFW faith communities…',
      bodyHtml: `
        <p>Here is your weekly snapshot of faith life across Dallas–Fort Worth.</p>
        <ul style="padding-left:20px">
          <li>New and updated church listings in Arlington, Dallas, Frisco &amp; Fort Worth</li>
          <li>Upcoming worship nights, family conferences &amp; community events</li>
          <li>Tips for churches growing visibility in the directory</li>
        </ul>
        <p>${escapeHtml(data.blurb || 'Discover churches near you and share your listing with families searching for a church home.')}</p>`,
      ctaUrl: directoryUrl,
      ctaLabel: 'Explore Directory',
    }),
    text: `Weekly DFW Church Digest. Browse: ${directoryUrl}`,
  };
}

function subscriberWelcomeEmail(data) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: 'You are subscribed — DFW faith updates from Upper Room DFW',
    html: layout({
      title: 'Welcome to our digest list',
      preheader: 'You will receive DFW church news, events, and directory highlights.',
      bodyHtml: `
        <p>Thank you for subscribing to <strong>Upper Room DFW</strong> email updates.</p>
        <p>You will receive directory highlights, faith community news, and event roundups for the DFW metroplex.</p>`,
      ctaUrl: appUrl + '/directory.html',
      ctaLabel: 'Find a Church',
    }),
    text: `Thanks for subscribing to Upper Room DFW updates. Directory: ${appUrl}/directory.html`,
  };
}

function listingApprovedEmail(data) {
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';
  return {
    subject: 'Your Upper Room DFW listing is approved',
    html: layout({
      title: 'Listing approved',
      preheader: 'Your church listing is now live on Upper Room DFW.',
      bodyHtml: `
        <p>Hi <strong>${escapeHtml(data.name || 'there')}</strong>,</p>
        <p>Your church listing is now <strong>live</strong> on Upper Room DFW. Families across DFW can find you in the directory.</p>`,
      ctaUrl: appUrl + '/member-dashboard.html',
      ctaLabel: 'Open Dashboard',
    }),
    text: `Your listing is approved. Dashboard: ${appUrl}/member-dashboard.html`,
  };
}

async function buildCampaign(key, data, helpers = {}) {
  const short = helpers.maybeShorten || (async (u) => u);
  const appUrl = process.env.APP_URL || 'https://upperroomdfw.com';

  switch (key) {
    case 'welcome':
      return welcomeEmail(data.name);
    case 'forgot_password': {
      const link = data.link || `${appUrl}/member-dashboard.html?reset=${data.token || ''}`;
      const shortened = await short(link);
      const tpl = passwordResetEmail(data.token || '');
      if (data.token) {
        tpl.html = tpl.html.replace(link, shortened);
        tpl.text = tpl.text.replace(link, shortened);
      }
      return tpl;
    }
    case 'order':
      return orderConfirmationEmail(data);
    case 'subscription_reminder':
      return subscriptionReminderEmail(data);
    case 'contact_auto_reply':
      return contactAutoReplyEmail(data);
    case 'contact_admin':
      return contactAdminEmail(data);
    case 'digest': {
      const d = { ...data, directoryUrl: await short(data.directoryUrl || appUrl + '/directory.html') };
      return digestEmail(d);
    }
    case 'subscriber_welcome':
      return subscriberWelcomeEmail(data);
    case 'listing_approved':
      return listingApprovedEmail(data);
    case 'payment_receipt':
      return paymentReceiptEmail(data.amount, data.plan);
    case 'lead_notification':
      return leadNotificationEmail(data);
    default:
      return null;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  BRAND,
  layout,
  welcomeEmail,
  passwordResetEmail,
  leadNotificationEmail,
  paymentReceiptEmail,
  campaignMeta,
  buildCampaign,
  CAMPAIGN_META,
};