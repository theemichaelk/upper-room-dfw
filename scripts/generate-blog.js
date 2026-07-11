#!/usr/bin/env node
/**
 * Generate blog post HTML pages, feed.xml (RSS 2.0), and blog index cards.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'blog-posts.json');
const BLOG_DIR = path.join(ROOT, 'blog');
const INDEX_HTML = path.join(ROOT, 'index.html');
const { logoImgTag } = require('./brand-assets');

const HERO_BLOG_START = '<!-- urdfw-hero-blog:start -->';
const HERO_BLOG_END = '<!-- urdfw-hero-blog:end -->';
const HERO_BLOG_MOBILE_START = '<!-- urdfw-hero-blog-mobile:start -->';
const HERO_BLOG_MOBILE_END = '<!-- urdfw-hero-blog-mobile:end -->';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  } catch {
    return iso;
  }
}

function navBlock(prefix) {
  const p = prefix || '';
  return `
  <nav class="bg-white border-b border-slate-200 sticky top-0 z-50" data-urdfw-shell="global">
    <div class="max-w-screen-2xl mx-auto px-6">
      <div class="flex items-center justify-between h-16">
        <a href="${p}index.html" class="flex items-center gap-x-2.5">
          ${logoImgTag(p.startsWith('../') ? 1 : 0)}
          <span class="font-semibold text-xl">Upper Room DFW</span>
        </a>
        <div class="hidden md:flex gap-6 text-sm font-medium items-center">
          <a href="${p}index.html">Home</a>
          <a href="${p}directory.html">Directory</a>
          <a href="${p}blog.html" class="font-semibold text-[#0369a1]">Blog</a>
          <a href="${p}events.html">Events</a>
          <a href="${p}contact.html">Contact</a>
          <a href="${p}register.html" class="px-3 py-1 bg-[#0369a1] text-white rounded-xl text-xs">Register Church</a>
        </div>
        <button type="button" id="mobile-hamburger" class="md:hidden w-10 h-10"><i class="fa-solid fa-bars"></i></button>
      </div>
    </div>
  </nav>`;
}

function footerBlock(prefix) {
  const p = prefix || '';
  return `
  <footer class="bg-slate-900 text-slate-400 text-sm mt-8" data-urdfw-shell="global">
    <div class="max-w-screen-2xl mx-auto px-6 py-5 text-xs flex flex-wrap gap-x-4 gap-y-1">
      © Upper Room DFW •
      <a href="${p}index.html" class="hover:text-white">Home</a> •
      <a href="${p}directory.html" class="hover:text-white">Directory</a> •
      <a href="${p}blog.html" class="hover:text-white">Blog</a> •
      <a href="${p}feed.xml" class="hover:text-white">RSS</a> •
      <a href="${p}sitemap.xml" class="hover:text-white">Sitemap</a> •
      <a href="${p}privacy-policy.html" class="hover:text-white">Privacy</a>
    </div>
    <div class="text-center text-xs py-3 text-slate-500 border-t border-white/10 urdfw-powered-by">Powered By <a href="https://tsbrenterprises.com" class="hover:text-white underline" target="_blank" rel="noopener noreferrer">The Stone Builders Rejected</a></div>
  </footer>`;
}

function headBlock(opts) {
  const { title, description, canonical, prefix, keywords } = opts;
  const p = prefix || '';
  const kw = (keywords || []).join(', ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="${p}images/logo-upper-room-dfw.png" type="image/png" sizes="any">
  <link rel="apple-touch-icon" href="${p}images/logo-upper-room-dfw.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- urdfw-telemetry:v1 -->
<!-- /urdfw-telemetry:v1 -->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${kw ? `<meta name="keywords" content="${esc(kw)}">` : ''}
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="Upper Room DFW Blog RSS" href="${p}feed.xml">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:type" content="article">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="${p}css/main.css">
  <link rel="stylesheet" href="${p}css/platform.css">
  <link rel="stylesheet" href="${p}css/responsive.css">
  <link rel="stylesheet" href="${p}css/blog.css">
</head>
<body class="tail-container bg-slate-50 text-slate-800" data-urdfw-shell="global">`;
}

function postPage(post, baseUrl) {
  const prefix = '../';
  const url = `${baseUrl}/blog/${post.slug}.html`;
  const title = `${post.title} | Upper Room DFW Blog`;
  return `${headBlock({ title, description: post.excerpt, canonical: url, prefix, keywords: post.keywords })}
${navBlock(prefix)}
<main class="max-w-3xl mx-auto px-6 py-10">
  <a href="${prefix}blog.html" class="text-sm text-sky-700 hover:underline"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Blog</a>
  <article class="mt-6 bg-white border rounded-2xl overflow-hidden shadow-sm">
    <img src="${prefix}${post.image}" alt="${esc(post.title)}" class="w-full h-56 md:h-72 object-cover" loading="eager">
    <div class="p-6 md:p-8 prose prose-slate max-w-none">
      <p class="text-xs text-slate-500 mb-2"><i class="fa-solid fa-location-dot text-sky-600"></i> ${esc(post.city)} · ${formatDate(post.publishedAt)} · ${post.readMinutes} min read</p>
      <h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-4">${esc(post.title)}</h1>
      <div class="urdfw-blog-content text-slate-700 leading-relaxed">${post.content}</div>
    </div>
  </article>
  <div class="mt-8 p-5 bg-sky-50 border border-sky-100 rounded-2xl text-sm">
    <strong>Find a church in ${esc(post.city)}</strong> — <a href="${prefix}directory.html" class="text-sky-700 underline">Browse the DFW directory</a> or <a href="${prefix}register.html" class="text-sky-700 underline">list your church</a>.
  </div>
</main>
${footerBlock(prefix)}
<script src="${prefix}js/main.js" defer></script>
<script src="${prefix}js/platform/loader.js" defer></script>
</body>
</html>
`;
}

function blogIndexPage(data) {
  const posts = [...data.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const cards = posts.map((post) => `
      <article class="urdfw-blog-card bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <a href="blog/${post.slug}.html" class="block">
          <img src="${post.image}" alt="${esc(post.title)}" class="w-full h-48 object-cover" loading="lazy">
          <div class="p-5">
            <p class="text-xs text-slate-500 mb-1"><i class="fa-solid fa-location-dot text-sky-600"></i> ${esc(post.city)} · ${formatDate(post.publishedAt)}</p>
            <h2 class="text-lg font-semibold text-slate-900 leading-snug">${esc(post.title)}</h2>
            <p class="text-sm text-slate-600 mt-2 line-clamp-3">${esc(post.excerpt)}</p>
            <span class="inline-block mt-3 text-sm font-semibold text-sky-700">Read more →</span>
          </div>
        </a>
      </article>`).join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Upper Room DFW Faith Blog',
    url: `${data.baseUrl}/blog.html`,
    description: 'Local church insights, DFW faith stories, and directory tips.',
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${data.baseUrl}/blog/${p.slug}.html`,
      datePublished: p.publishedAt,
      image: `${data.baseUrl}/${p.image}`,
    })),
  });

  return `${headBlock({
    title: 'Blog | Upper Room DFW — DFW Church Insights & Faith Stories',
    description: 'Locally SEO-optimized faith stories, church guides, and DFW community insights from Upper Room DFW.',
    canonical: `${data.baseUrl}/blog.html`,
    prefix: '',
    keywords: ['DFW churches blog', 'Dallas church guide', 'Fort Worth faith', 'Plano churches'],
  })}
${navBlock('')}
<header class="bg-gradient-to-br from-sky-900 to-sky-600 text-white py-14">
  <div class="max-w-screen-2xl mx-auto px-6">
    <h1 class="text-3xl md:text-4xl font-bold">DFW Faith Blog</h1>
    <p class="mt-2 text-sky-100 max-w-2xl">Locally relevant guides for choosing churches, youth programs, outreach, and events across Dallas–Fort Worth.</p>
    <div class="mt-4 flex flex-wrap gap-3 text-sm">
      <a href="feed.xml" class="px-3 py-1.5 bg-white/15 rounded-xl hover:bg-white/25"><i class="fa-solid fa-rss mr-1"></i> RSS Feed</a>
      <a href="sitemap.xml" class="px-3 py-1.5 bg-white/15 rounded-xl hover:bg-white/25"><i class="fa-solid fa-sitemap mr-1"></i> Sitemap</a>
      <a href="directory.html" class="px-3 py-1.5 bg-white text-sky-900 rounded-xl font-semibold">Browse Directory</a>
    </div>
  </div>
</header>
<main class="max-w-screen-2xl mx-auto px-6 py-12">
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" id="urdfw-blog-grid">
${cards}
  </div>
</main>
<script type="application/ld+json">${jsonLd}</script>
${footerBlock('')}
<script src="js/main.js" defer></script>
<script src="js/platform/loader.js" defer></script>
</body>
</html>
`;
}

function rssFeed(data) {
  const posts = [...data.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const items = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${data.baseUrl}/blog/${p.slug}.html</link>
      <guid isPermaLink="true">${data.baseUrl}/blog/${p.slug}.html</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt}]]></description>
      <category>${esc(p.city)}</category>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Upper Room DFW Blog</title>
    <link>${data.baseUrl}/blog.html</link>
    <description>DFW church insights, local faith guides, and directory tips</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${data.baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function heroBlogCard(post, compact) {
  const href = `blog/${post.slug}.html`;
  if (compact) {
    return `<a href="${href}" class="urdfw-hero-blog-item group block py-3 border-b border-white/10 last:border-0 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
      <p class="text-[10px] uppercase tracking-wider text-sky-200/90 mb-0.5">${esc(post.city)} · ${post.readMinutes} min</p>
      <h3 class="text-sm font-semibold leading-snug text-white group-hover:text-sky-100 line-clamp-2">${esc(post.title)}</h3>
    </a>`;
  }
  return `<a href="${href}" class="urdfw-hero-blog-mobile-item flex gap-3 p-3 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors">
    <img src="${post.image}" alt="" class="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy">
    <div class="min-w-0">
      <p class="text-[10px] uppercase tracking-wider text-slate-400">${esc(post.city)}</p>
      <h3 class="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">${esc(post.title)}</h3>
      <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">${esc(post.excerpt)}</p>
    </div>
  </a>`;
}

function buildHeroBlogPanels(posts) {
  const latest = posts.slice(0, 3);
  const desktop = `${HERO_BLOG_START}
    <aside id="hero-blog-panel" class="urdfw-hero-blog-panel hidden lg:flex flex-col absolute right-6 top-1/2 -translate-y-1/2 z-30 w-[min(100%,340px)] max-h-[min(88%,520px)]" aria-label="Latest from the blog">
      <div class="bg-slate-900/75 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 class="text-sm font-semibold text-white tracking-wide"><i class="fa-solid fa-newspaper text-sky-300 mr-1.5"></i>Latest from the Blog</h2>
          <a href="blog.html" class="text-xs text-sky-300 hover:text-white font-medium">All posts →</a>
        </div>
        <div class="px-3 py-2 overflow-y-auto flex-1">
          ${latest.map((p) => heroBlogCard(p, true)).join('\n')}
        </div>
        <div class="px-4 py-2.5 border-t border-white/10 shrink-0 flex gap-2 text-xs">
          <a href="feed.xml" class="text-sky-300/90 hover:text-white"><i class="fa-solid fa-rss mr-1"></i>RSS</a>
          <span class="text-white/20">·</span>
          <a href="sitemap.xml" class="text-sky-300/90 hover:text-white">Sitemap</a>
        </div>
      </div>
    </aside>
${HERO_BLOG_END}`;

  const mobile = `${HERO_BLOG_MOBILE_START}
  <section id="hero-blog-mobile" class="lg:hidden bg-white border-b border-slate-200" aria-label="Latest blog posts">
    <div class="max-w-screen-2xl mx-auto px-6 py-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-slate-900"><i class="fa-solid fa-newspaper text-sky-600 mr-1.5"></i>Latest from the Blog</h2>
        <a href="blog.html" class="text-xs font-semibold text-sky-700">View all →</a>
      </div>
      <div class="space-y-2">
        ${latest.map((p) => heroBlogCard(p, false)).join('\n')}
      </div>
    </div>
  </section>
${HERO_BLOG_MOBILE_END}`;

  return { desktop, mobile };
}

function patchHomeHeroBlog(data) {
  if (!fs.existsSync(INDEX_HTML)) return false;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  const posts = [...data.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const { desktop, mobile } = buildHeroBlogPanels(posts);

  if (!html.includes(HERO_BLOG_START)) {
    html = html.replace(
      /(\s*<!-- Slider Arrows -->)/,
      `\n    ${desktop}\n$1`
    );
  } else {
    html = html.replace(
      new RegExp(`${HERO_BLOG_START}[\\s\\S]*?${HERO_BLOG_END}`),
      desktop
    );
  }

  if (!html.includes(HERO_BLOG_MOBILE_START)) {
    html = html.replace(
      /(<\/header>\s*\n\s*<!-- STATS -->)/,
      `</header>\n\n${mobile}\n\n  <!-- STATS -->`
    );
  } else {
    html = html.replace(
      new RegExp(`${HERO_BLOG_MOBILE_START}[\\s\\S]*?${HERO_BLOG_MOBILE_END}`),
      mobile
    );
  }

  if (!html.includes('urdfw-hero-with-blog')) {
    html = html.replace(
      /<header id="hero-slider" class="([^"]*)">/,
      '<header id="hero-slider" class="$1 urdfw-hero-with-blog lg:pr-[min(360px,32vw)]">'
    );
  }

  fs.writeFileSync(INDEX_HTML, html);
  return true;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  let count = 0;
  for (const post of data.posts) {
    const file = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(file, postPage(post, data.baseUrl));
    count += 1;
  }

  fs.writeFileSync(path.join(ROOT, 'blog.html'), blogIndexPage(data));
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), rssFeed(data));
  if (patchHomeHeroBlog(data)) console.log('Patched index.html hero blog panel');

  console.log(`Generated ${count} blog posts, blog.html, and feed.xml`);
}

main();