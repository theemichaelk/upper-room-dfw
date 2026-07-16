/**
 * Writable paths for Amplify SSR/Lambda (read-only /var/task package root).
 * Prefer project data/ when writable; otherwise /tmp; optionally mirror to S3.
 */
const fs = require('fs');
const path = require('path');

let S3Client;
let PutObjectCommand;

function isLambdaLike() {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT ||
    (process.cwd() || '').includes('/var/task') ||
    (__dirname || '').includes('/var/task')
  );
}

function projectRoot() {
  return path.join(__dirname, '..', '..');
}

function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.urdfw-write-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** Directory for runtime JSON exports (site-settings, redirects, etc.) */
function writableDataDir() {
  const preferred = path.join(projectRoot(), 'data');
  if (canWriteDir(preferred)) return preferred;

  const tmp = process.env.URDFW_DATA_DIR || path.join(process.env.TMPDIR || '/tmp', 'urdfw-data');
  try {
    fs.mkdirSync(tmp, { recursive: true });
  } catch { /* ignore */ }
  return tmp;
}

function isWritableFsError(err) {
  const code = err && (err.code || err.errno);
  const msg = String(err && err.message || err || '');
  return (
    code === 'EROFS' ||
    code === 'EACCES' ||
    code === 'EPERM' ||
    /read-only file system/i.test(msg) ||
    /EROFS/i.test(msg)
  );
}

/**
 * Write text/JSON safely. Falls back to /tmp on EROFS.
 * Optionally uploads to S3 at publicKey (e.g. data/site-settings.json).
 */
async function writeDataFile(relativeName, content, opts = {}) {
  const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
  const rel = String(relativeName || '').replace(/^\/+/, '');
  const dir = writableDataDir();
  const localPath = path.join(dir, path.basename(rel.includes('/') ? rel : rel));
  // Keep nested path under data dir when possible
  const nested = path.join(dir, rel.startsWith('data/') ? rel.slice(5) : rel);
  const target = opts.flat ? localPath : nested;

  let local = { ok: false, path: target };
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    local = { ok: true, path: target, bytes: Buffer.byteLength(body), mode: isLambdaLike() ? 'tmp' : 'project' };
  } catch (err) {
    if (isWritableFsError(err)) {
      const fallback = path.join(process.env.TMPDIR || '/tmp', 'urdfw-data', path.basename(rel));
      try {
        fs.mkdirSync(path.dirname(fallback), { recursive: true });
        fs.writeFileSync(fallback, body);
        local = {
          ok: true,
          path: fallback,
          bytes: Buffer.byteLength(body),
          mode: 'tmp-fallback',
          warning: err.message,
        };
      } catch (err2) {
        local = { ok: false, error: err2.message, code: err2.code, original: err.message };
      }
    } else {
      local = { ok: false, error: err.message, code: err.code };
    }
  }

  let s3 = null;
  if (opts.uploadS3 !== false) {
    s3 = await uploadPublicAsset(opts.s3Key || rel, body, opts.contentType || 'application/json');
  }

  return {
    ok: local.ok || !!(s3 && s3.ok),
    local,
    s3,
    message: local.ok
      ? (s3?.ok ? 'Wrote local + S3' : 'Wrote local export')
      : (s3?.ok ? 'Wrote S3 only (local FS read-only)' : (local.error || s3?.error || 'Write failed')),
  };
}

function s3Bucket() {
  return (
    process.env.SITE_ASSETS_BUCKET ||
    process.env.DB_BACKUP_BUCKET ||
    process.env.S3_BUCKET ||
    ''
  );
}

async function uploadPublicAsset(key, body, contentType) {
  const bucket = s3Bucket();
  if (!bucket) return { ok: false, skipped: true, reason: 'no-bucket' };
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI && !process.env.AWS_EXECUTION_ENV) {
    /* Still try — Amplify compute often has IAM role without static keys */
  }
  try {
    if (!S3Client) {
      ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
    }
    const { s3ClientConfig } = require('./s3-client');
    const client = new S3Client({
      ...s3ClientConfig(),
    });
    const Key = String(key || '').replace(/^\/+/, '');
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
      ContentType: contentType || 'application/json',
      CacheControl: 'public, max-age=60, must-revalidate',
    }));
    return { ok: true, bucket, key: Key };
  } catch (err) {
    return { ok: false, error: err.message, bucket };
  }
}

module.exports = {
  isLambdaLike,
  projectRoot,
  canWriteDir,
  writableDataDir,
  isWritableFsError,
  writeDataFile,
  uploadPublicAsset,
  s3Bucket,
};
