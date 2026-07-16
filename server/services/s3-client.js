/**
 * Shared S3 client — production AWS or local Floci (path-style, port 4566).
 *
 * Dev (Floci):
 *   AWS_ENDPOINT_URL=http://localhost:4566
 *   AWS_ACCESS_KEY_ID=test
 *   AWS_SECRET_ACCESS_KEY=test
 *   AWS_REGION=us-east-1
 *   DB_BACKUP_BUCKET=upperroomdfw-local
 *
 * Prod: leave AWS_ENDPOINT_URL unset; use real IAM/keys + us-east-2.
 */
function s3ClientConfig() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
  const endpoint = (process.env.AWS_ENDPOINT_URL || process.env.FLOCI_ENDPOINT || '').replace(/\/$/, '');
  const forcePathStyle =
    process.env.AWS_S3_FORCE_PATH_STYLE === 'true' ||
    process.env.AWS_S3_FORCE_PATH_STYLE === '1' ||
    !!endpoint;

  const cfg = { region };
  if (endpoint) {
    cfg.endpoint = endpoint;
    cfg.forcePathStyle = forcePathStyle;
    cfg.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    };
  }
  return cfg;
}

function isLocalS3() {
  const endpoint = process.env.AWS_ENDPOINT_URL || process.env.FLOCI_ENDPOINT || '';
  return /localhost|127\.0\.0\.1|4566/.test(endpoint);
}

function createS3Client() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client(s3ClientConfig());
}

module.exports = { s3ClientConfig, isLocalS3, createS3Client };
