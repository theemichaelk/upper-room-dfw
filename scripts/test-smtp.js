#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { verifySmtp } = require('../server/services/integrations');
const { sendEmail } = require('../server/services/email');

async function main() {
  console.log('SMTP host:', process.env.SMTP_HOST);
  console.log('SMTP user:', process.env.SMTP_USER);
  console.log('FROM:', process.env.EMAIL_FROM);

  const verify = await verifySmtp();
  console.log('Verify:', verify);
  if (!verify.ok) process.exit(1);

  const to = process.env.ADMIN_EMAILS?.split(',')[0] || process.env.SMTP_USER;
  const sent = await sendEmail({
    to,
    subject: 'Upper Room DFW — Acumbamail SMTP Test',
    html: '<p>Acumbamail SMTP relay is working. ' + new Date().toISOString() + '</p>',
    text: 'Acumbamail SMTP relay is working.',
  });
  console.log('Sent test to', to, 'messageId:', sent.messageId);
}

main().catch((e) => { console.error(e); process.exit(1); });