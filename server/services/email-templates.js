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
};