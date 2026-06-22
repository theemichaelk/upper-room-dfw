/**
 * SQLite backup/restore via S3 — survives Amplify cold starts.
 * Set DB_BACKUP_BUCKET (e.g. upperroomdfw.com) and DB_BACKUP_KEY (e.g. data/urdfw.db).
 */
const fs = require('fs');
const path = require('path');

let S3Client;
let GetObjectCommand;
let PutObjectCommand;
let HeadObjectCommand;

function s3Ready() {
  return !!(process.env.DB_BACKUP_BUCKET && process.env.DB_BACKUP_KEY);
}

function getClient() {
  if (!S3Client) {
    ({ S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3'));
  }
  return new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2' });
}

function bucketConfig() {
  return {
    bucket: process.env.DB_BACKUP_BUCKET,
    key: process.env.DB_BACKUP_KEY || 'data/urdfw.db',
  };
}

async function restoreDbIfNeeded(dbPath) {
  const { bucket, key } = bucketConfig();
  if (!bucket) return { restored: false, reason: 'no-bucket' };

  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 8192) {
    return { restored: false, reason: 'local-exists' };
  }

  const client = getClient();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body.transformToByteArray();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(bytes));
    console.log('[db-persist] Restored from s3://' + bucket + '/' + key);
    return { restored: true };
  } catch (err) {
    if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      console.log('[db-persist] No backup yet at s3://' + bucket + '/' + key);
      return { restored: false, reason: 'not-found' };
    }
    console.warn('[db-persist] Restore failed:', err.message);
    return { restored: false, reason: err.message };
  }
}

async function backupNow(dbPath) {
  const { bucket, key } = bucketConfig();
  if (!bucket || !fs.existsSync(dbPath)) return { ok: false };

  try {
    const client = getClient();
    const body = fs.readFileSync(dbPath);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/x-sqlite3',
    }));
    console.log('[db-persist] Backed up to s3://' + bucket + '/' + key);
    return { ok: true, bytes: body.length };
  } catch (err) {
    console.warn('[db-persist] Backup failed:', err.message);
    return { ok: false, error: err.message };
  }
}

let backupTimer = null;

function scheduleBackup(dbPath) {
  if (!s3Ready()) return;
  const interval = parseInt(process.env.DB_BACKUP_INTERVAL_MS || '90000', 10);

  const run = () => backupNow(dbPath).catch(() => {});

  if (backupTimer) clearInterval(backupTimer);
  backupTimer = setInterval(run, interval);

  const shutdown = async () => {
    if (backupTimer) clearInterval(backupTimer);
    await backupNow(dbPath);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  setTimeout(run, 5000);
}

function wrapDbForAutoBackup(db, dbPath) {
  if (!s3Ready()) return db;
  let pending = null;
  const queue = () => {
    if (pending) return;
    pending = setTimeout(async () => {
      pending = null;
      await backupNow(dbPath);
    }, 3000);
  };
  const origPrepare = db.prepare.bind(db);
  db.prepare = function (sql) {
    const stmt = origPrepare(sql);
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
    if (!isWrite) return stmt;
    const origRun = stmt.run.bind(stmt);
    stmt.run = function (...args) {
      const result = origRun(...args);
      queue();
      return result;
    };
    return stmt;
  };
  return db;
}

module.exports = {
  s3Ready,
  restoreDbIfNeeded,
  backupNow,
  scheduleBackup,
  wrapDbForAutoBackup,
};