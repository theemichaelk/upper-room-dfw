const crypto = require('crypto');
const path = require('path');

let PutObjectCommand;
let DeleteObjectCommand;
const { createS3Client } = require('./s3-client');

function bucket() {
  return process.env.MEDIA_BUCKET || process.env.DB_BACKUP_BUCKET || 'upperroomdfw.com';
}

function publicBase() {
  const app = (process.env.APP_URL || 'https://upperroomdfw.com').replace(/\/$/, '');
  return process.env.MEDIA_PUBLIC_BASE || app;
}

function getClient() {
  if (!PutObjectCommand) {
    ({ PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3'));
  }
  return createS3Client();
}

function parseDataUrl(dataUrl) {
  const m = (dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function extFromMime(mime) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  return map[mime] || '.bin';
}

async function uploadMedia({ clientId, listingId, name, dataUrl, buffer, mimeType }) {
  let body = buffer;
  let mime = mimeType || 'image/jpeg';
  if (dataUrl) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw new Error('Invalid image data');
    body = parsed.buffer;
    mime = parsed.mime;
  }
  if (!body || body.length > 6 * 1024 * 1024) throw new Error('Image too large (max 6MB)');

  const id = crypto.randomUUID();
  const safeName = (name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const key = `media/${clientId || 'anon'}/${listingId || 'general'}/${id}${extFromMime(mime)}`;

  await getClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: mime,
    CacheControl: 'public, max-age=31536000',
  }));

  const url = `${publicBase()}/${key}`;
  return { id, key, url, mime, bytes: body.length };
}

async function deleteMediaKey(key) {
  if (!key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

function assetToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    listingId: row.listing_id,
    name: row.name,
    mimeType: row.mime_type,
    url: row.url,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

module.exports = {
  uploadMedia,
  deleteMediaKey,
  assetToApi,
  bucket,
};