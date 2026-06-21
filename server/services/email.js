const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    transporter = {
      sendMail: async (opts) => {
        console.log('[email:dev]', opts.to, opts.subject);
        return { messageId: 'dev-' + Date.now() };
      },
    };
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'Upper Room DFW <noreply@upperroomdfw.com>';
  return getTransporter().sendMail({ from, to, subject, html, text });
}

async function sendWelcome(email, name) {
  const appUrl = process.env.APP_URL || 'http://localhost:8000';
  return sendEmail({
    to: email,
    subject: 'Welcome to Upper Room DFW',
    html: `<p>Hi ${name},</p><p>Your church registration is received. <a href="${appUrl}/member-dashboard.html">Open your dashboard</a> to complete your listing and start your free trial.</p>`,
  });
}

async function sendPasswordReset(email, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:8000';
  const link = `${appUrl}/member-dashboard.html?reset=${token}`;
  return sendEmail({
    to: email,
    subject: 'Reset your Upper Room DFW password',
    html: `<p>Click to reset your password (expires in 1 hour):</p><p><a href="${link}">${link}</a></p>`,
  });
}

async function sendLeadNotification(churchEmail, lead) {
  return sendEmail({
    to: churchEmail,
    subject: `New directory lead: ${lead.name}`,
    html: `<p><strong>${lead.name}</strong> (${lead.email}) contacted you:</p><p>${lead.message}</p>`,
  });
}

async function sendPaymentReceipt(email, amount, plan) {
  return sendEmail({
    to: email,
    subject: `Payment received — ${plan} plan`,
    html: `<p>Thank you! We received $${amount} for your ${plan} subscription.</p>`,
  });
}

module.exports = {
  getTransporter,
  sendEmail,
  sendWelcome,
  sendPasswordReset,
  sendLeadNotification,
  sendPaymentReceipt,
};