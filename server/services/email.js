const nodemailer = require('nodemailer');
const templates = require('./email-templates');

let transporter = null;

function smtpTransportOptions() {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const opts = {
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  };
  // Acumbamail + most relays on 587: plain auth + STARTTLS
  if (!secure && port === 587) {
    opts.requireTLS = true;
    opts.tls = { minVersion: 'TLSv1.2' };
  }
  return opts;
}

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport(smtpTransportOptions());
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
  const tpl = templates.welcomeEmail(name);
  return sendEmail({ to: email, ...tpl });
}

async function sendPasswordReset(email, token) {
  const tpl = templates.passwordResetEmail(token);
  return sendEmail({ to: email, ...tpl });
}

async function sendLeadNotification(churchEmail, lead) {
  const tpl = templates.leadNotificationEmail(lead);
  return sendEmail({ to: churchEmail, ...tpl });
}

async function sendPaymentReceipt(email, amount, plan) {
  const tpl = templates.paymentReceiptEmail(amount, plan);
  return sendEmail({ to: email, ...tpl });
}

module.exports = {
  getTransporter,
  sendEmail,
  sendWelcome,
  sendPasswordReset,
  sendLeadNotification,
  sendPaymentReceipt,
};