#!/usr/bin/env node
/**
 * Generate sitemap.xml (search engines) and sitemap.html (human-readable),
 * and ensure a Sitemap link appears in site footers.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://upperroomdfw.com';
const TODAY = new Date().toISOString().slice(0, 10);

/** Internal / non-indexable pages excluded from both sitemaps */
const EXCLUDE = new Set([
  '404.html',
  'admin.html',
  'billing-hub.html',
  'collections.html',
  'csv-import.html',
  'embed.html',
  'feature-checklist.html',
  'field-builder.html',
  'form-builder.html',
  'go.html',
  'member-dashboard.html',
  'messages.html',
  'page-builder.html',
  'shortcode-builder.html',
  'templates.html',
  'upper-room-dfw-complete.html',
  'user-directory.html',
  'widgets.html',
  'sitemap.html', // listed explicitly below
]);

try {
  const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'redirects.json'), 'utf8'));
  for (const r of redirects.redirects || []) {
    const from = (r.from || '').replace(/^\//, '');
    if (from && from !== '/') EXCLUDE.add(from);
  }
} catch { /* defaults */ }

const PAGE_TITLES = {
  'index.html': 'Home',
  'about.html': 'About',
  'blog.html': 'Blog',
  'claim-listing.html': 'Claim a Listing',
  'contact.html': 'Contact',
  'directory.html': 'Church Directory',
  'email-updates.html': 'Email Updates',
  'events.html': 'Events',
  'features.html': 'Features',
  'pricing.html': 'Pricing',
  'privacy-policy.html': 'Privacy Policy',
  'register.html': 'Register Your Church',
  'signup.html': 'Sign Up',
  'submit-listing.html': 'Submit a Listing',
  'support.html': 'Support',
  'terms-of-service.html': 'Terms of Service',
  'training.html': 'Training',
  'feed.xml': 'RSS Feed',
  'sitemap.html': 'HTML Sitemap',
  'sitemap.xml': 'XML Sitemap',
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleFromPath(rel) {
  if (PAGE_TITLES[rel]) return PAGE_TITLES[rel];
  const base = path.basename(rel, path.extname(rel));
  // strip numeric suffixes from bulk-generated church slugs
  const clean = base.replace(/-\d{10,}$/, '');
  return clean
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function walkHtml(dir, list = [], base = '') {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'upperroom-dfw-mobile' || name === 'templates') continue;
      walkHtml(full, list, rel.replace(/\\/g, '/'));
    } else if (name.endsWith('.html')) {
      list.push({ path: rel.replace(/\\/g, '/'), mtime: stat.mtime.toISOString().slice(0, 10) });
    }
  }
  return list;
}

function mtimeOf(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return TODAY;
  return fs.statSync(full).mtime.toISOString().slice(0, 10);
}

// --- collect URLs ---
const rootPages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && !EXCLUDE.has(f))
  .map((f) => ({ path: f, mtime: mtimeOf(f), section: 'main' }));

let blogPosts = [];
try {
  const blogData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'blog-posts.json'), 'utf8'));
  const now = Date.now();
  blogPosts = (blogData.posts || [])
    .filter((p) => p.publishedAt && new Date(p.publishedAt).getTime() <= now && p.status !== 'draft')
    .map((p) => {
      const rel = `blog/${p.slug}.html`;
      return {
        path: rel,
        mtime: fs.existsSync(path.join(ROOT, rel)) ? mtimeOf(rel) : String(p.publishedAt).slice(0, 10),
        section: 'blog',
        title: p.title || titleFromPath(rel),
      };
    });
} catch {
  blogPosts = walkHtml(path.join(ROOT, 'blog'), [], 'blog').map((p) => ({
    ...p,
    section: 'blog',
    title: titleFromPath(p.path),
  }));
}

// Church names from data when available
const churchNameBySlug = new Map();
try {
  const churchesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'churches.json'), 'utf8'));
  for (const c of churchesJson) {
    if (c.slug) churchNameBySlug.set(c.slug, c.name || c.slug);
  }
} catch { /* optional */ }

const churches = walkHtml(path.join(ROOT, 'churches'), [], 'churches')
  .filter((p) => p.path !== 'churches/index.html')
  .map((p) => {
    const slug = path.basename(p.path, '.html');
    return {
      ...p,
      section: 'churches',
      title: churchNameBySlug.get(slug) || titleFromPath(p.path),
    };
  });

const extras = [
  { path: 'sitemap.html', mtime: TODAY, section: 'main', title: 'HTML Sitemap' },
  {
    path: 'feed.xml',
    mtime: fs.existsSync(path.join(ROOT, 'feed.xml')) ? mtimeOf('feed.xml') : TODAY,
    section: 'main',
    title: 'RSS Feed',
  },
];

// Homepage first (canonical /), then rest
const homepage = { path: '', mtime: mtimeOf('index.html'), section: 'main', title: 'Home', locPath: '' };

const all = [homepage, ...rootPages, ...blogPosts, ...churches, ...extras]
  .filter((p) => !EXCLUDE.has(p.path) && p.path !== 'index.html')
  .sort((a, b) => {
    if (a.path === '') return -1;
    if (b.path === '') return 1;
    return a.path.localeCompare(b.path);
  });

// Dedupe by path
const seen = new Set();
const unique = all.filter((p) => {
  const key = p.path || '/';
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

function priorityFor(p) {
  if (p.path === '') return '1.0';
  if (p.path === 'directory.html' || p.path === 'blog.html') return '0.9';
  if (p.path.startsWith('blog/')) return '0.8';
  if (p.path.startsWith('churches/')) return '0.7';
  if (p.path === 'sitemap.html') return '0.5';
  return '0.6';
}

// --- sitemap.xml ---
const xmlUrls = unique
  .map((p) => {
    const loc = p.path === '' ? `${BASE}/` : `${BASE}/${p.path}`;
    const lastmod = p.mtime || TODAY;
    const priority = priorityFor(p);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);

// --- sitemap.html ---
const bySection = { main: [], blog: [], churches: [] };
for (const p of unique) {
  const sec = p.section || 'main';
  if (!bySection[sec]) bySection[sec] = [];
  bySection[sec].push(p);
}

function listHtml(items) {
  return items
    .map((p) => {
      const href = p.path === '' ? 'index.html' : p.path;
      const title = p.title || titleFromPath(p.path || 'index.html');
      const date = p.mtime ? `<span class="text-slate-400 text-xs ml-2">${esc(p.mtime)}</span>` : '';
      return `        <li><a href="${esc(href)}" class="text-sky-700 hover:underline">${esc(title)}</a>${date}</li>`;
    })
    .join('\n');
}

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemap | Upper Room DFW</title>
  <meta name="description" content="Browse every public page on Upper Room DFW — main site pages, blog guides, and church directory listings across Dallas–Fort Worth.">
  <link rel="canonical" href="${BASE}/sitemap.html">
  <meta property="og:title" content="Sitemap | Upper Room DFW">
  <meta property="og:description" content="HTML sitemap for Upper Room DFW church directory — main pages, blog, and church listings.">
  <meta property="og:url" content="${BASE}/sitemap.html">
  <meta property="og:image" content="${BASE}/images/logo-upper-room-dfw.jpg">
  <meta property="og:image:alt" content="Upper Room DFW — King Jesus">
  <link rel="icon" href="images/logo-upper-room-dfw.png" type="image/png" sizes="any">
  <link rel="apple-touch-icon" href="images/logo-upper-room-dfw.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <meta name="theme-color" content="#0369a1">
  <link rel="stylesheet" href="css/main.css">
  <link rel="stylesheet" href="css/platform.css">
  <link rel="stylesheet" href="css/responsive.css">
  <link rel="stylesheet" href="css/widgets.css">
</head>
<body class="bg-slate-50 text-slate-800">
  <nav class="bg-white border-b border-slate-200 sticky top-0 z-50" data-urdfw-shell="global">
    <div class="max-w-screen-2xl mx-auto px-6">
      <div class="flex items-center justify-between h-16">
        <a href="index.html" class="flex items-center gap-x-2.5">
          <img src="images/logo-upper-room-dfw.png" alt="Upper Room DFW — King Jesus" class="urdfw-brand-logo h-11 w-11 object-contain shrink-0" width="44" height="44">
          <span class="font-semibold text-xl">Upper Room DFW</span>
        </a>
        <div class="hidden md:flex gap-6 text-sm font-medium items-center">
          <a href="index.html">Home</a>
          <a href="directory.html">Directory</a>
          <a href="blog.html">Blog</a>
          <a href="events.html">Events</a>
          <a href="contact.html">Contact</a>
          <a href="register.html" class="px-3 py-1 bg-[#0369a1] text-white rounded-xl text-xs">Register Church</a>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-screen-xl mx-auto px-6 py-10">
    <header class="mb-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-2">Site map</p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900">Upper Room DFW Sitemap</h1>
      <p class="mt-3 text-slate-600 max-w-2xl">
        A human-readable map of public pages on the Dallas–Fort Worth church directory.
        Search engines can also use the machine-readable
        <a href="sitemap.xml" class="text-sky-700 font-medium hover:underline">sitemap.xml</a>
        (${unique.length} URLs · last generated ${esc(TODAY)}).
      </p>
      <div class="mt-4 flex flex-wrap gap-3 text-sm">
        <a href="#main-pages" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300">Main pages (${bySection.main.length})</a>
        <a href="#blog" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300">Blog (${bySection.blog.length})</a>
        <a href="#churches" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300">Churches (${bySection.churches.length})</a>
        <a href="sitemap.xml" class="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100"><i class="fa-solid fa-file-code mr-1"></i> XML sitemap</a>
      </div>
    </header>

    <section id="main-pages" class="mb-12">
      <h2 class="text-xl font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">
        <i class="fa-solid fa-house text-sky-600 mr-2"></i>Main pages
      </h2>
      <ul class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm list-none pl-0">
${listHtml(bySection.main)}
      </ul>
    </section>

    <section id="blog" class="mb-12">
      <h2 class="text-xl font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">
        <i class="fa-solid fa-newspaper text-sky-600 mr-2"></i>Blog &amp; guides
      </h2>
      <ul class="grid sm:grid-cols-1 lg:grid-cols-2 gap-2 text-sm list-none pl-0">
${listHtml(bySection.blog)}
      </ul>
    </section>

    <section id="churches" class="mb-12">
      <h2 class="text-xl font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">
        <i class="fa-solid fa-church text-sky-600 mr-2"></i>Church listings
      </h2>
      <ul class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm list-none pl-0">
${listHtml(bySection.churches)}
      </ul>
    </section>
  </main>

  <footer class="bg-slate-900 text-slate-400 text-sm mt-8" data-urdfw-shell="global">
    <div class="max-w-screen-2xl mx-auto px-6 py-5 text-xs flex flex-wrap gap-x-4 gap-y-1">
      © Upper Room DFW •
      <a href="index.html" class="hover:text-white">Home</a> •
      <a href="directory.html" class="hover:text-white">Directory</a> •
      <a href="blog.html" class="hover:text-white">Blog</a> •
      <a href="sitemap.html" class="hover:text-white">Sitemap</a> •
      <a href="sitemap.xml" class="hover:text-white">XML</a> •
      <a href="privacy-policy.html" class="hover:text-white">Privacy</a> •
      <a href="terms-of-service.html" class="hover:text-white">Terms</a>
    </div>
    <div class="text-center text-xs py-3 text-slate-500 border-t border-white/10 urdfw-powered-by">Powered By <a href="https://tsbrenterprises.com" class="hover:text-white underline" target="_blank" rel="noopener noreferrer">The Stone Builders Rejected</a> Michael K</div>
  </footer>
  <script src="js/platform/loader.js" defer></script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.html'), htmlPage);

// --- inject Sitemap link into footers site-wide ---
function collectHtmlFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'upperroom-dfw-mobile' || name === '.amplify-hosting' || name === '.git') continue;
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) collectHtmlFiles(full, list);
    else if (name.endsWith('.html')) list.push(full);
  }
  return list;
}

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const depth = parts.length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function hasSitemapHtmlLink(html, href) {
  const escaped = href.replace(/\./g, '\\.');
  return new RegExp(`href=["']${escaped}["']`, 'i').test(html);
}

function injectFooterLink(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const prefix = depthPrefix(filePath);
  const href = `${prefix}sitemap.html`;
  let changed = false;

  // Hero chip: fa-sitemap aimed at xml → html sitemap
  if (/fa-sitemap/.test(html) && /href=["'](?:\.\.\/)*sitemap\.xml["']/.test(html)) {
    const next = html.replace(/href=["'](?:\.\.\/)*sitemap\.xml["']/g, `href="${href}"`);
    if (next !== html) {
      html = next;
      changed = true;
    }
  }

  // Operate only inside <footer>…</footer> so body/privacy widgets are untouched
  if (!/<footer[\s\S]*?<\/footer>/i.test(html)) {
    if (changed) fs.writeFileSync(filePath, html);
    return changed;
  }

  html = html.replace(/(<footer[\s\S]*?<\/footer>)/i, (footer) => {
    let f = footer;

    // Upgrade xml "Sitemap" links → html
    const upgraded = f.replace(
      /(href=["'])(?:\.\.\/)*sitemap\.xml(["'][^>]*>)\s*Sitemap/gi,
      `$1${href}$2 Sitemap`
    );
    if (upgraded !== f) {
      f = upgraded;
      changed = true;
    }

    if (hasSitemapHtmlLink(f, href)) return f;

    // Index multi-column Legal / Company columns
    if (path.basename(filePath) === 'index.html') {
      let next = f.replace(
        /(<a href="contact\.html" class="block hover:text-white">Contact<\/a>)(<\/div>)/,
        '$1<a href="sitemap.html" class="block hover:text-white">Sitemap</a>$2'
      );
      if (next === f) {
        next = f.replace(
          /(<a href="feed\.xml" class="block hover:text-white">RSS Feed<\/a>)(<\/div>)/,
          '$1<a href="sitemap.html" class="block hover:text-white">Sitemap</a>$2'
        );
      }
      if (next !== f) {
        f = next;
        changed = true;
        return f;
      }
    }

    // Compact footers that list Privacy
    const privacyInsert = new RegExp(
      `(<a href=["'](?:\\.\\./)*privacy-policy\\.html["'][^>]*>Privacy(?: Policy)?</a>)`,
      'i'
    );
    if (privacyInsert.test(f)) {
      f = f.replace(
        privacyInsert,
        `<a href="${href}" class="hover:text-white">Sitemap</a> • $1`
      );
      changed = true;
      return f;
    }

    // Minimal powered-by footers (church pages, builders)
    if (/urdfw-powered-by/.test(f)) {
      const navRow = `
    <div class="max-w-screen-2xl mx-auto px-4 pb-2 pt-3 text-center text-xs flex flex-wrap justify-center gap-x-3 gap-y-1 urdfw-footer-nav">
      <a href="${prefix}index.html" class="hover:text-white">Home</a>
      <a href="${prefix}directory.html" class="hover:text-white">Directory</a>
      <a href="${href}" class="hover:text-white">Sitemap</a>
      <a href="${prefix}privacy-policy.html" class="hover:text-white">Privacy</a>
    </div>`;
      f = f.replace(/^(<footer[^>]*>)/i, `$1${navRow}`);
      changed = true;
    }

    return f;
  });

  if (changed) {
    fs.writeFileSync(filePath, html);
    return true;
  }
  return false;
}

const htmlFiles = collectHtmlFiles(ROOT);
let footerCount = 0;
for (const f of htmlFiles) {
  if (injectFooterLink(f)) {
    footerCount++;
    console.log('Footer sitemap link:', path.relative(ROOT, f));
  }
}

console.log(`Wrote sitemap.xml with ${unique.length} URLs`);
console.log(`Wrote sitemap.html (main ${bySection.main.length}, blog ${bySection.blog.length}, churches ${bySection.churches.length})`);
console.log(`Updated footers in ${footerCount} HTML files`);
