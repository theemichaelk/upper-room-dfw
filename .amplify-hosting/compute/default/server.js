'use strict';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || '/tmp/urdfw.db';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'amplify-production-change-me';
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'Kingme05$';
if (!process.env.ADMIN_EMAILS) {
  process.env.ADMIN_EMAILS = 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com';
}
if (!process.env.DB_BACKUP_BUCKET) process.env.DB_BACKUP_BUCKET = 'upperroomdfw.com';
if (!process.env.DB_BACKUP_KEY) process.env.DB_BACKUP_KEY = 'data/urdfw.db';
if (!process.env.AWS_REGION) process.env.AWS_REGION = 'us-east-2';
const path = require('path');
process.chdir(__dirname);
require('dotenv').config({ path: path.join(__dirname, '.env') });
try {
  require('./server/index.js');
} catch (err) {
  console.error('Server failed to start:', err);
  process.exit(1);
}
