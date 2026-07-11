/**
 * Site updates audit — surfaces deploy history and platform capabilities for admin.
 */
const fs = require('fs');
const path = require('path');

function projectRoot(rootDir) {
  return rootDir || path.join(__dirname, '..', '..');
}

function loadUpdates(rootDir) {
  const file = path.join(projectRoot(rootDir), 'data', 'site-updates.json');
  if (!fs.existsSync(file)) return { updates: [], generatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { updates: [], generatedAt: null };
  }
}

function buildAuditReport(db, rootDir) {
  const root = projectRoot(rootDir);
  const updates = loadUpdates(root);
  const files = {
    blogPosts: fs.existsSync(path.join(root, 'data', 'blog-posts.json')),
    feedXml: fs.existsSync(path.join(root, 'feed.xml')),
    sitemapXml: fs.existsSync(path.join(root, 'sitemap.xml')),
    page404: fs.existsSync(path.join(root, '404.html')),
    controlSchema: fs.existsSync(path.join(root, 'data', 'platform-control-schema.json')),
  };

  let blogCount = 0;
  let sitemapCount = 0;
  try {
    blogCount = JSON.parse(fs.readFileSync(path.join(root, 'data', 'blog-posts.json'), 'utf8')).posts?.length || 0;
  } catch { /* ignore */ }
  try {
    sitemapCount = (fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').match(/<loc>/g) || []).length;
  } catch { /* ignore */ }

  const blogHtmlFiles = fs.existsSync(path.join(root, 'blog'))
    ? fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html')).length
    : 0;

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    capabilities: {
      seoHub: true,
      omnichannelConsole: true,
      edgeDnsMonitor: true,
      pageLifecycle: true,
      blogRss: files.feedXml,
      sitemap: files.sitemapXml,
      blogAdmin: true,
      htmlControl: true,
    },
    inventory: {
      blogPostsJson: blogCount,
      blogHtmlPages: blogHtmlFiles,
      sitemapUrls: sitemapCount,
      has404Rescue: files.page404,
    },
    files,
    recentUpdates: updates.updates || [],
  };
}

module.exports = { loadUpdates, buildAuditReport };