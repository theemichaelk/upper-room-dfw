#!/usr/bin/env node
/**
 * Full production deploy: env → git → S3 static → CloudFront invalidation → Amplify rebuild.
 * Usage: npm run push:live
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_ID = process.env.AMPLIFY_APP_ID || 'dbtc2f3y8pyam';
const REGION = process.env.AWS_REGION || 'us-east-2';
const CF_DIST = process.env.CLOUDFRONT_DIST_ID || 'EI9QWFII46LGX';

function run(cmd, label) {
  console.log('\n▶', label || cmd);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true });
}

async function main() {
  console.log('=== Upper Room DFW — push:live ===');

  run('node scripts/push-env-to-amplify.js', 'Push env to Amplify');

  try {
    run('git push github main', 'Git push to github/main');
  } catch (e) {
    console.warn('Git push skipped or failed — continuing with S3 deploy');
  }

  run('npm run deploy:s3', 'Deploy static assets to S3');

  run(
    `aws cloudfront create-invalidation --distribution-id ${CF_DIST} --paths "/*" --region ${REGION}`,
    'CloudFront cache invalidation'
  );

  try {
    run(
      `aws amplify start-job --app-id ${APP_ID} --branch-name main --job-type RELEASE --region ${REGION}`,
      'Amplify RELEASE job (API rebuild)'
    );
  } catch (e) {
    console.warn('Amplify job start failed — API may need manual redeploy');
  }

  console.log('\n✓ push:live complete. Allow 2–5 min for Amplify + CloudFront propagation.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});