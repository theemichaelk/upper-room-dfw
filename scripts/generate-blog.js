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

const HOME_INSIGHTS_START = '<!-- urdfw-home-insights:start -->';
const HOME_INSIGHTS_END = '<!-- urdfw-home-insights:end -->';
const INSIGHTS_ANCHOR = '<!-- urdfw-home-insights-anchor -->';

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

function shortTitle(title, max = 58) {
  const t = String(title || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 28 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function shortExcerpt(text, max = 88) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function cityPill(city) {
  const label = String(city || 'DFW').replace('DFW Metroplex', 'DFW');
  return `<span class="urdfw-insights-pill">${esc(label)}</span>`;
}

function insightsFeaturedCard(post) {
  const href = `blog/${post.slug}.html`;
  return `<article class="urdfw-insights-featured-wrap lg:col-span-2">
    <a href="${href}" class="urdfw-insights-featured-card group">
      <div class="urdfw-insights-featured-media">
        <img src="${post.image}" alt="${esc(shortTitle(post.title, 56))}" width="640" height="320" loading="eager">
      </div>
      <div class="urdfw-insights-featured-content">
        <div class="urdfw-insights-meta">
          ${cityPill(post.city)}
          <time datetime="${post.publishedAt}" class="urdfw-insights-date">${formatDate(post.publishedAt)}</time>
        </div>
        <h3 class="urdfw-insights-featured-title">${esc(shortTitle(post.title, 72))}</h3>
        <p class="urdfw-insights-featured-excerpt">${esc(shortExcerpt(post.excerpt, 120))}</p>
        <span class="urdfw-insights-cta">Read the guide <i class="fa-solid fa-arrow-right ml-1 text-xs"></i></span>
      </div>
    </a>
  </article>`;
}

function insightsCompactCard(post) {
  const href = `blog/${post.slug}.html`;
  return `<article>
    <a href="${href}" class="urdfw-insights-compact-card group">
      <img src="${post.image}" alt="${esc(shortTitle(post.title, 40))}" class="urdfw-insights-compact-img" width="400" height="160" loading="lazy">
      <div class="urdfw-insights-compact-body">
        <div class="urdfw-insights-meta">
          ${cityPill(post.city)}
          <time datetime="${post.publishedAt}" class="urdfw-insights-date">${formatDate(post.publishedAt)}</time>
        </div>
        <h3 class="urdfw-insights-compact-title">${esc(shortTitle(post.title, 56))}</h3>
      </div>
    </a>
  </article>`;
}

function buildHomeInsightsSection(posts, totalCount) {
  const latest = posts.slice(0, 3);
  const [featured, ...rest] = latest;
  const countLabel = totalCount || posts.length;

  return `${HOME_INSIGHTS_START}
  <section id="dfw-faith-insights" class="urdfw-home-insights" aria-labelledby="urdfw-insights-heading">
    <div class="max-w-screen-2xl mx-auto px-6 py-10 md:py-12">
      <header class="urdfw-home-insights-header">
        <div>
          <p class="urdfw-insights-eyebrow">Guides for North Texas families &amp; pastors</p>
          <h2 id="urdfw-insights-heading" class="urdfw-home-insights-title">DFW Faith Insights</h2>
          <p class="urdfw-home-insights-sub">Local church guides written for Dallas–Fort Worth search — choosing a congregation, youth programs, outreach, and listing your church.</p>
        </div>
        <a href="blog.html" class="urdfw-home-insights-cta" title="Browse all ${countLabel} articles">View all ${countLabel} guides <i class="fa-solid fa-arrow-right ml-1.5 text-xs"></i></a>
      </header>
      <div class="urdfw-home-insights-grid">
        ${featured ? insightsFeaturedCard(featured) : ''}
        ${rest.length ? `<div class="urdfw-insights-compact-stack">${rest.map((p) => insightsCompactCard(p)).join('')}</div>` : ''}
      </div>
    </div>
  </section>
${HOME_INSIGHTS_END}`;
}

function stripLegacyHeroBlog(html) {
  html = html.replace(/<!-- urdfw-hero-blog:start -->[\s\S]*?<!-- urdfw-hero-blog:end -->/g, '');
  html = html.replace(/<!-- urdfw-hero-blog-mobile:start -->[\s\S]*?<!-- urdfw-hero-blog-mobile:end -->/g, '');
  html = html.replace(
    /<header id="hero-slider" class="([^"]*)">/,
    (_, cls) => {
      const base = cls
        .replace(/\burdfw-hero-with-blog\b/g, '')
        .replace(/\blg:pr-\[[^\]]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return `<header id="hero-slider" class="${base}">`;
    }
  );
  return html;
}

function patchHomeInsights(data) {
  if (!fs.existsSync(INDEX_HTML)) return false;
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  html = stripLegacyHeroBlog(html);

  const posts = [...data.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const section = buildHomeInsightsSection(posts, data.posts.length);

  if (html.includes(HOME_INSIGHTS_START)) {
    html = html.replace(
      new RegExp(`${HOME_INSIGHTS_START}[\\s\\S]*?${HOME_INSIGHTS_END}`),
      section
    );
  } else if (html.includes(INSIGHTS_ANCHOR)) {
    html = html.replace(INSIGHTS_ANCHOR, section);
  } else {
    html = html.replace(
      /(  <\/div>\s*\n)(\s*<!-- TESTIMONIES with 5-star reviews[^>]*-->)/,
      `$1\n${section}\n\n$2`
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
  if (patchHomeInsights(data)) console.log('Patched index.html home insights section');

  console.log(`Generated ${count} blog posts, blog.html, and feed.xml`);
}

main();