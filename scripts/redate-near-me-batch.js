#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data', 'blog-posts.json');
const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const batch = d.posts.filter((p) => p.excerpt && p.excerpt.includes('local guide for people searching'));
const now = new Date();
console.log('now', now.toISOString(), 'batch', batch.length);

batch.forEach((p, i) => {
  let t;
  if (i < 25) {
    // Publish first 25 immediately (staggered over past ~50 days)
    t = new Date(now.getTime() - (25 - i) * 2 * 86400000);
  } else {
    // Remaining every 3 days going forward
    t = new Date(now.getTime() + (i - 24) * 3 * 86400000);
  }
  t.setUTCHours(10, 0, 0, 0);
  p.publishedAt = t.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  p.status = t.getTime() <= now.getTime() ? 'published' : 'scheduled';
});

d.posts.forEach((p) => {
  if (p.publishedAt && new Date(p.publishedAt).getTime() <= now.getTime() && p.status !== 'draft') {
    p.status = 'published';
  }
});

fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');
console.log(
  'batch published',
  batch.filter((p) => p.status === 'published').length,
  'scheduled',
  batch.filter((p) => p.status === 'scheduled').length
);
console.log('all published', d.posts.filter((p) => p.status === 'published').length);
