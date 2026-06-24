#!/usr/bin/env node
/**
 * Create Amplify SSR Compute role with S3 DB backup + Route53 DNS permissions.
 * Usage: node scripts/setup-amplify-iam.js
 */
const { execSync } = require('child_process');
const path = require('path');

const APP_ID = process.env.AMPLIFY_APP_ID || 'dbtc2f3y8pyam';
const REGION = process.env.AWS_REGION || 'us-east-2';
const ROLE_NAME = process.env.AMPLIFY_COMPUTE_ROLE || 'UrdfwAmplifyComputeRole';
const S3_POLICY_NAME = 'UrdfwDbBackupS3Policy';
const R53_POLICY_NAME = 'UrdfwRoute53DnsPolicy';
const DEPLOY = path.join(__dirname, '..', 'deploy');

function run(cmd) {
  console.log('>', cmd);
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch (err) {
    return err.stdout || err.stderr || err.message;
  }
}

const account = JSON.parse(run('aws sts get-caller-identity --output json')).Account;
const roleArn = `arn:aws:iam::${account}:role/${ROLE_NAME}`;

console.log('Setting up Amplify compute IAM for Upper Room DFW...');

tryRun(`aws iam create-policy --policy-name ${S3_POLICY_NAME} --policy-document file://${path.join(DEPLOY, 'iam-compute-s3-policy.json')}`);
const s3PolicyArn = `arn:aws:iam::${account}:policy/${S3_POLICY_NAME}`;

tryRun(`aws iam create-policy --policy-name ${R53_POLICY_NAME} --policy-document file://${path.join(DEPLOY, 'iam-compute-route53-policy.json')}`);
const r53PolicyArn = `arn:aws:iam::${account}:policy/${R53_POLICY_NAME}`;

tryRun(`aws iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document file://${path.join(DEPLOY, 'iam-compute-trust.json')}`);
tryRun(`aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn ${s3PolicyArn}`);
tryRun(`aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn ${r53PolicyArn}`);

const update = run(
  `aws amplify update-app --app-id ${APP_ID} --region ${REGION} --compute-role-arn ${roleArn} --output json`
);
const parsed = JSON.parse(update);
console.log('Compute role attached:', parsed.app?.computeRoleArn || roleArn);
console.log('Policies: S3 backup + Route53 DNS');
console.log('Done. DB backups: s3://upperroomdfw.com/data/urdfw.db');