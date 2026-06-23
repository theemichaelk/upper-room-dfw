const crypto = require('crypto');

function signingSecret() {
  return process.env.WEBHOOK_SIGNING_SECRET || process.env.JWT_SECRET || 'urdfw-webhook-dev';
}

function signPayload(body) {
  return crypto.createHmac('sha256', signingSecret()).update(body).digest('hex');
}

async function deliverWebhook(hook, event, payload) {
  const events = hook.events_json ? JSON.parse(hook.events_json) : ['*'];
  if (!events.includes('*') && !events.includes(event)) return null;

  const body = JSON.stringify({
    event,
    payload,
    webhookId: hook.id,
    timestamp: new Date().toISOString(),
  });
  const signature = signPayload(body);
  const at = new Date().toISOString();

  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-URDFW-Signature': signature,
        'X-URDFW-Event': event,
        'User-Agent': 'UpperRoomDFW-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10)),
    });
    const status = res.ok ? 'ok' : 'error';
    dbLog(hook.db, hook.id, event, status, at, res.ok ? null : `HTTP ${res.status}`);
    return { id: hook.id, status, httpStatus: res.status };
  } catch (err) {
    dbLog(hook.db, hook.id, event, 'failed', at, err.message);
    return { id: hook.id, status: 'failed', error: err.message };
  }
}

function dbLog(db, webhookId, event, status, at, error) {
  try {
    db.prepare('INSERT INTO webhook_log (webhook_id, event, status, at, error) VALUES (?, ?, ?, ?, ?)').run(
      webhookId, event, status, at, error || null
    );
  } catch { /* ignore */ }
}

async function dispatchWebhooks(db, event, payload) {
  let hooks;
  try {
    hooks = db.prepare('SELECT * FROM webhooks WHERE active = 1').all();
  } catch {
    return [];
  }
  if (!hooks.length) return [];

  const results = await Promise.allSettled(
    hooks.map((hook) => deliverWebhook({ ...hook, db }, event, payload))
  );
  return results.map((r) => (r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason?.message })).filter(Boolean);
}

function registerWebhook(db, { url, events, label }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const eventsJson = JSON.stringify(events && events.length ? events : ['*']);
  db.prepare('INSERT INTO webhooks (id, url, events_json, label, active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(
    id, url, eventsJson, label || null, now
  );
  return { id, url, events: JSON.parse(eventsJson), label, active: true, createdAt: now };
}

function listWebhooks(db) {
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all().map((row) => ({
    id: row.id,
    url: row.url,
    events: row.events_json ? JSON.parse(row.events_json) : ['*'],
    label: row.label,
    active: !!row.active,
    createdAt: row.created_at,
  }));
}

function deactivateWebhook(db, id) {
  const r = db.prepare('UPDATE webhooks SET active = 0 WHERE id = ?').run(id);
  return r.changes > 0;
}

module.exports = {
  signPayload,
  dispatchWebhooks,
  registerWebhook,
  listWebhooks,
  deactivateWebhook,
};