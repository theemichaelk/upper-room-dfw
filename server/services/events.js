const { sendEmail } = require('./email');
const { sendCampaign } = require('./campaigns');

const { dispatchWebhooks } = require('./webhook-dispatcher');

function adminEmails(db) {
  return db.prepare("SELECT email FROM users WHERE role = 'admin'").all().map((r) => r.email);
}

function createEventBus(db) {
  const handlers = {};

  function on(event, handler) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(handler);
  }

  async function emit(event, payload = {}) {
    const at = new Date().toISOString();
    try {
      db.prepare('INSERT INTO event_log (event, payload_json, at) VALUES (?, ?, ?)').run(
        event, JSON.stringify(payload), at
      );
    } catch (err) {
      console.error('[events] log failed:', err.message);
    }

    const queue = [...(handlers['*'] || []), ...(handlers[event] || [])];
    await Promise.allSettled(queue.map((fn) => fn(payload, { event, db, at })));
    dispatchWebhooks(db, event, payload).catch((err) => {
      console.error('[events] webhook dispatch:', err.message);
    });

    return { event, at, handlers: queue.length };
  }

  on('user.registered', async (data) => {
    await sendCampaign('welcome', { email: data.email, name: data.name }).catch(() => {});
    const subject = `New church registration: ${data.name || data.email}`;
    const html = `<p><strong>${data.name || 'New church'}</strong> (${data.email}) registered${data.area ? ' in ' + data.area : ''}.</p>`;
    for (const to of adminEmails(db)) {
      await sendEmail({ to, subject, html, text: subject }).catch(() => {});
    }
  });

  on('lead.created', async (data) => {
    if (data.churchEmail) {
      await sendCampaign('lead_notification', { email: data.churchEmail, ...data }).catch(() => {});
    }
    for (const to of adminEmails(db)) {
      await sendCampaign('contact_admin', { email: to, ...data, topic: 'New directory lead' }).catch(() => {});
    }
  });

  on('payment.completed', async (data) => {
    if (data.email) {
      await sendCampaign('payment_receipt', { email: data.email, amount: data.amount, plan: data.plan }).catch(() => {});
      await sendCampaign('order', {
        email: data.email,
        amount: data.amount,
        plan: data.plan,
        gateway: data.gateway,
        order: { amount: data.amount, plan: data.plan, gateway: data.gateway, ref: data.sessionId },
      }).catch(() => {});
    }
    const subject = `Payment received: ${data.email} — ${data.plan} ($${data.amount})`;
    for (const to of adminEmails(db)) {
      await sendEmail({ to, subject, html: `<p>${subject}</p>`, text: subject }).catch(() => {});
    }
  });

  on('subscriber.added', async (data) => {
    if (!data.email) return;
    await sendCampaign('subscriber_welcome', { email: data.email, name: data.name }).catch(() => {});
    const subject = `New newsletter subscriber: ${data.email}`;
    for (const to of adminEmails(db)) {
      await sendEmail({ to, subject, html: `<p>${data.email} subscribed to email updates.</p>`, text: subject }).catch(() => {});
    }
  });

  on('support.created', async (data) => {
    if (data.email) {
      await sendCampaign('contact_auto_reply', { email: data.email, name: data.name, message: data.message }).catch(() => {});
    }
    for (const to of adminEmails(db)) {
      await sendCampaign('contact_admin', { email: to, ...data }).catch(() => {});
    }
  });

  on('client.approved', async (data) => {
    if (!data.email) return;
    await sendCampaign('listing_approved', { email: data.email, name: data.name }).catch(() => {});
  });

  on('subscription.updated', async (data) => {
    if (data.status === 'past_due' && data.email) {
      await sendEmail({
        to: data.email,
        subject: 'Action needed: billing issue on your Upper Room DFW account',
        html: '<p>We could not process your latest subscription payment. Please update your billing method.</p>',
        text: 'Please update your billing method in the member dashboard.',
      }).catch(() => {});
    }
  });

  return { on, emit };
}

let bus = null;

function initEvents(db) {
  if (!bus) bus = createEventBus(db);
  return bus;
}

function getEvents(db) {
  return initEvents(db);
}

module.exports = { initEvents, getEvents, createEventBus };