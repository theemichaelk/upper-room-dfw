#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const key = process.env.ACUMBAMAIL_API_KEY;
const body = 'auth_token=' + encodeURIComponent(key || '');

const req = https.request({
  hostname: 'acumbamail.com',
  path: '/api/1/getLists/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  let d = '';
  res.on('data', (c) => { d += c; });
  res.on('end', () => {
    console.log('API status:', res.statusCode);
    console.log(d.slice(0, 800));
  });
});
req.on('error', (e) => console.error(e));
req.write(body);
req.end();