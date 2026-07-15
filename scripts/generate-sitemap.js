#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://upperroomdfw.com';

let exclude = new Set(['upper-room-dfw-complete.html', 'index.html', 'go.html', 'embed.html']);
try {
  const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'redirects.json'), 'utf8'));
  for (const r of redirects.redirects || []) {
    const from = (r.from || '').replace(/^\//, '');
    if (from && from !== '/') exclude.add(from);
  }
} catch { /* defaults */ }

function walkHtml(dir, list = [], base = '') {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full, list, rel.replace(/\\/g, '/'));
    else if (name.endsWith('.html')) list.push({ path: rel.replace(/\\/g, '/'), mtime: stat.mtime.toISOString().slice(0, 10) });
  }
  return list;
}

const rootPages = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && !exclude.has(f))
  .map((f) => ({ path: f, mtime: fs.statSync(path.join(ROOT, f)).mtime.toISOString().slice(0, 10) }));

/* Only published blog posts (drip schedule) enter the sitemap */
let blogPosts = [];
try {
  const blogData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'blog-posts.json'), 'utf8'));
  const now = Date.now();
  blogPosts = (blogData.posts || [])
    .filter((p) => p.publishedAt && new Date(p.publishedAt).getTime() <= now && p.status !== 'draft')
    .map((p) => {
      const rel = `blog/${p.slug}.html`;
      const full = path.join(ROOT, 'blog', `${p.slug}.html`);
      const mtime = fs.existsSync(full)
        ? fs.statSync(full).mtime.toISOString().slice(0, 10)
        : String(p.publishedAt).slice(0, 10);
      return { path: rel, mtime };
    });
} catch {
  blogPosts = walkHtml(path.join(ROOT, 'blog'), [], 'blog');
}

const churches = walkHtml(path.join(ROOT, 'churches'), [], 'churches')
  .filter((p) => p.path !== 'churches/index.html');

const extra = [
  { path: 'templates/single/classic.html', mtime: null },
  { path: 'feed.xml', mtime: fs.existsSync(path.join(ROOT, 'feed.xml')) ? fs.statSync(path.join(ROOT, 'feed.xml')).mtime.toISOString().slice(0, 10) : null },
];

const all = [...rootPages, ...blogPosts, ...churches, ...extra]
  .filter((p) => !exclude.has(p.path))
  .sort((a, b) => a.path.localeCompare(b.path));

const urls = all.map((p) => {
  const loc = `${BASE}/${p.path}`;
  const lastmod = p.mtime ? `\n    <lastmod>${p.mtime}</lastmod>` : '';
  const priority = p.path.startsWith('blog/') ? '\n    <priority>0.8</priority>' : (p.path === 'blog.html' ? '\n    <priority>0.9</priority>' : '');
  return `  <url>\n    <loc>${loc}</loc>${lastmod}${priority}\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log('Wrote sitemap.xml with', all.length, 'URLs (includes blog + feed.xml)');