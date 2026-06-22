#!/usr/bin/env node
/**
 * Create Amplify SSR Compute role with S3 DB backup permissions and attach to app.
 * Usage: node scripts/setup-amplify-iam.js
 */
const { execSync } = require('child_process');
const path = require('path');

const APP_ID = process.env.AMPLIFY_APP_ID || 'dbtc2f3y8pyam';
const REGION = process.env.AWS_REGION || 'us-east-2';
const ROLE_NAME = process.env.AMPLIFY_COMPUTE_ROLE || 'UrdfwAmplifyComputeRole';
const POLICY_NAME = 'UrdfwDbBackupS3Policy';
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

const account = JSON.parse(run(`aws sts get-caller-identity --output json`)).Account;
const roleArn = `arn:aws:iam::${account}:role/${ROLE_NAME}`;

console.log('Setting up Amplify compute IAM for Upper Room DFW...');

tryRun(`aws iam create-policy --policy-name ${POLICY_NAME} --policy-document file://${path.join(DEPLOY, 'iam-compute-s3-policy.json')}`);
const policyArn = `arn:aws:iam::${account}:policy/${POLICY_NAME}`;

tryRun(`aws iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document file://${path.join(DEPLOY, 'iam-compute-trust.json')}`);
tryRun(`aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn ${policyArn}`);

const update = run(
  `aws amplify update-app --app-id ${APP_ID} --region ${REGION} --compute-role-arn ${roleArn} --output json`
);
const parsed = JSON.parse(update);
console.log('Compute role attached:', parsed.app?.computeRoleArn || roleArn);
console.log('Done. DB backups will use s3://upperroomdfw.com/data/urdfw.db');