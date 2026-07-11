/**
 * Blog posts — JSON file + optional DB registry overrides.
 */
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting } = require('./platform-settings');

const BLOG_KEY = 'blog_posts';

function projectRoot(rootDir) {
  return rootDir || path.join(__dirname, '..', '..');
}

function loadBlogFile(rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'blog-posts.json');
  if (!fs.existsSync(file)) return { version: '1.0.0', baseUrl: 'https://upperroomdfw.com', posts: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveBlogFile(data, rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'blog-posts.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { ok: true, path: file, count: data.posts?.length || 0 };
}

function getBlogPosts(db, rootDir) {
  const fileData = loadBlogFile(rootDir);
  const overrides = getSetting(db, BLOG_KEY, null);
  if (overrides?.posts) {
    return { ...fileData, ...overrides, posts: overrides.posts };
  }
  return fileData;
}

function setBlogPosts(db, patch, rootDir) {
  const current = getBlogPosts(db, rootDir);
  const next = {
    ...current,
    ...patch,
    posts: patch.posts || current.posts,
    updatedAt: new Date().toISOString(),
  };
  setSetting(db, BLOG_KEY, next);
  saveBlogFile(next, rootDir);
  return next;
}

function getBlogPost(db, slug, rootDir) {
  const data = getBlogPosts(db, rootDir);
  return (data.posts || []).find((p) => p.slug === slug) || null;
}

module.exports = {
  BLOG_KEY,
  loadBlogFile,
  saveBlogFile,
  getBlogPosts,
  setBlogPosts,
  getBlogPost,
};