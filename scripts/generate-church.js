#!/usr/bin/env node
/**
 * Upper Room DFW - Church Detail Page Generator
 * Usage:
 *   node scripts/generate-church.js --file new-church.json
 *   or
 *   node scripts/generate-church.js --data '{"name":"New Church","area":"Dallas", ...}'
 *
 * This script:
 * - Adds/updates the church in data/churches.json
 * - Generates a full static detail page in churches/slug.html
 * - Uses the current design system and includes Similar Churches section
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/churches.json');
const CHURCHES_DIR = path.join(__dirname, '../churches');
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{NAME}} | {{AREA}}, TX | Upper Room DFW</title>
  <meta name="description" content="{{DESCRIPTION}} | Listed on Upper Room DFW — the local church directory for Dallas-Fort Worth.">
  <meta property="og:title" content="{{NAME}} — {{AREA}}">
  <meta property="og:description" content="{{DESCRIPTION}}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="../css/main.css">
  <link rel="stylesheet" href="../css/platform.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Church",
    "name": "{{NAME}}",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "{{AREA}}",
      "addressRegion": "TX",
      "addressCountry": "US"
    },
    "telephone": "{{PHONE}}",
    "url": "{{WEBSITE}}",
    "description": "{{FULL_DESCRIPTION}}"
  }
  </script>
</head>
<body class="tail-container bg-slate-50">
  <nav class="bg-white border-b sticky top-0 z-50">
    <div class="max-w-screen-2xl mx-auto px-6 flex h-16 items-center justify-between">
      <a href="../index.html" class="flex items-center gap-x-2.5">
        <div class="w-9 h-9 bg-indigo-900 rounded-2xl flex items-center justify-center"><i class="fa-solid fa-church text-white"></i></div>
        <span class="font-semibold text-xl">Upper Room DFW</span>
      </a>
      <div class="hidden md:flex gap-6 text-sm">
        <a href="../index.html">Home</a>
        <a href="../directory.html">Directory</a>
        <a href="../events.html">Events</a>
        <a href="../pricing.html">For Churches</a>
        <a href="../admin.html">Admin</a>
      </div>
      <a href="../directory.html" class="text-sm px-4 py-1.5 border rounded-2xl font-medium">Back to Directory</a>
    </div>
  </nav>

  <div class="max-w-4xl mx-auto px-6 pt-10">
    <div class="flex items-center gap-3 text-sm text-emerald-700 mb-2">
      <i class="fa-solid fa-map-marker-alt"></i> <span>{{AREA}}, TX</span>
      <span class="px-3 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">{{CATEGORY}}</span>
      <span class="px-3 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{{DENOMINATION}}</span>
    </div>
    <h1 class="text-5xl tracking-tighter font-semibold">{{NAME}}</h1>
    <p class="text-xl text-slate-600 mt-2">{{DESCRIPTION}}</p>

    <div class="mt-6 grid md:grid-cols-3 gap-6">
      <div class="md:col-span-2">
        <img src="../{{IMAGE}}" class="w-full rounded-3xl shadow" alt="{{NAME}} in {{AREA}}">
        <div class="mt-8 prose prose-slate max-w-none">
          <h2>About {{NAME}}</h2>
          <p>{{FULL_DESCRIPTION}}</p>
        </div>

        <div class="mt-8">
          <h3 class="font-semibold mb-3">Service Times</h3>
          <div class="bg-white border p-4 rounded-2xl">{{TIMES}}</div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white border p-5 rounded-3xl">
          <div class="font-semibold mb-2">Contact</div>
          <div class="text-sm space-y-1.5">
            {{PHONE_LINE}}
            {{EMAIL_LINE}}
            {{WEBSITE_LINE}}
          </div>
          <button onclick="window.fakeAction('Directions to {{NAME}}', '{{ADDRESS}} — Google Maps would open in production.')" class="mt-4 w-full py-2 text-sm border rounded-2xl hover:bg-slate-50 font-semibold">Get Directions</button>
          <button onclick="window.fakeAction('Contact {{NAME}}', 'Thank you! This would open your email client in a live site.')" class="mt-2 w-full py-2 bg-indigo-900 text-white text-sm rounded-2xl font-semibold">Contact Church</button>
        </div>

        <div class="bg-white border p-5 rounded-3xl text-sm">
          <div class="font-semibold mb-2">Tags</div>
          <div class="flex flex-wrap gap-2">{{TAGS_HTML}}</div>
        </div>
      </div>
    </div>

    <!-- Similar Churches Section -->
    <div class="mt-12">
      <h3 class="text-2xl font-semibold tracking-tight mb-4">Similar Churches in the Area</h3>
      <div id="similar-churches" class="grid md:grid-cols-3 gap-4"></div>
    </div>

    <div class="mt-8">
      <a href="../directory.html" class="inline-flex items-center text-indigo-700 font-semibold">← Back to full DFW Church Directory</a>
    </div>
  </div>

  <div class="max-w-4xl mx-auto px-6 py-10 text-xs text-slate-500 border-t mt-10">
    Listed on Upper Room DFW — Local Church Directory for Dallas-Fort Worth
  </div>

  <script src="../js/main.js"></script>
  <script>
    // Dynamic Similar Churches (loads from data for "live" feel)
    async function loadSimilar() {
      try {
        const res = await fetch('../data/churches.json');
        const all = await res.json();
        const currentArea = "{{AREA}}";
        const currentId = {{ID}};
        const similar = all
          .filter(c => c.id !== currentId && (c.area === currentArea || c.category === "{{CATEGORY}}"))
          .slice(0, 3);
        
        const container = document.getElementById('similar-churches');
        if (!container || !similar.length) {
          container.innerHTML = '<p class="text-sm text-slate-500">Check the full directory for more options in ' + currentArea + '.</p>';
          return;
        }
        container.innerHTML = similar.map(s => \`
          <a href="\${s.slug}.html" class="block bg-white border hover:border-indigo-200 rounded-2xl p-4 text-sm transition">
            <div class="font-semibold">\${s.name}</div>
            <div class="text-emerald-700 text-xs">\${s.area} • \${s.category}</div>
            <div class="text-slate-500 text-xs mt-1 line-clamp-2">\${s.description}</div>
          </a>
        \`).join('');
      } catch(e) {
        console.warn('Could not load similar churches');
      }
    }
    document.addEventListener('DOMContentLoaded', loadSimilar);
  </script>
  <script src="../js/platform/loader.js"></script>
</body>
</html>`;

// Simple arg parsing
const args = process.argv.slice(2);
let churchData = null;

if (args.includes('--file')) {
  const fileIndex = args.indexOf('--file');
  const filePath = args[fileIndex + 1];
  churchData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} else if (args.includes('--data')) {
  const dataIndex = args.indexOf('--data');
  churchData = JSON.parse(args[dataIndex + 1]);
} else {
  console.log('Usage: node scripts/generate-church.js --file new-church.json  OR  --data \'{...}\'');
  process.exit(1);
}

if (!churchData.slug) {
  churchData.slug = churchData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
if (!churchData.id) churchData.id = Date.now();

// Load existing data
let churches = [];
if (fs.existsSync(DATA_FILE)) {
  churches = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Add or update
const existingIndex = churches.findIndex(c => c.slug === churchData.slug);
if (existingIndex >= 0) {
  churches[existingIndex] = { ...churches[existingIndex], ...churchData };
  console.log('Updated existing church:', churchData.slug);
} else {
  churches.push(churchData);
  console.log('Added new church:', churchData.slug);
}

// Save updated data
fs.writeFileSync(DATA_FILE, JSON.stringify(churches, null, 2));

// Generate HTML page
let html = TEMPLATE
  .replace(/\{\{NAME\}\}/g, churchData.name)
  .replace(/\{\{AREA\}\}/g, churchData.area)
  .replace(/\{\{CATEGORY\}\}/g, churchData.category)
  .replace(/\{\{DESCRIPTION\}\}/g, churchData.description)
  .replace(/\{\{FULL_DESCRIPTION\}\}/g, churchData.fullDescription || churchData.description)
  .replace(/\{\{TIMES\}\}/g, churchData.times || 'Contact for current times')
  .replace(/\{\{ADDRESS\}\}/g, churchData.address)
  .replace(/\{\{PHONE\}\}/g, churchData.phone || '')
  .replace(/\{\{WEBSITE\}\}/g, churchData.website || '')
  .replace(/\{\{DENOMINATION\}\}/g, churchData.denomination || 'Non-denominational')
  .replace(/\{\{IMAGE\}\}/g, churchData.image || 'assets/church-placeholder.svg')
  .replace(/\{\{ID\}\}/g, churchData.id);

const phoneLine = churchData.phone ? `<div><i class="fa-solid fa-phone w-4 mr-2 text-slate-400"></i> ${churchData.phone}</div>` : '';
const emailLine = churchData.email ? `<div><i class="fa-solid fa-envelope w-4 mr-2 text-slate-400"></i> <a href="mailto:${churchData.email}" class="text-indigo-700">${churchData.email}</a></div>` : '';
const websiteLine = churchData.website ? `<div><i class="fa-solid fa-globe w-4 mr-2 text-slate-400"></i> <a href="${churchData.website}" target="_blank" class="text-indigo-700">${churchData.website}</a></div>` : '';
const tagsHtml = (churchData.tags || []).map(t => `<span class="px-3 py-0.5 bg-slate-100 text-xs rounded-full">${t}</span>`).join('');

html = html
  .replace('{{PHONE_LINE}}', phoneLine)
  .replace('{{EMAIL_LINE}}', emailLine)
  .replace('{{WEBSITE_LINE}}', websiteLine)
  .replace('{{TAGS_HTML}}', tagsHtml);

// Write the page
const outPath = path.join(CHURCHES_DIR, `${churchData.slug}.html`);
fs.writeFileSync(outPath, html);

console.log('✅ Generated page:', outPath);
console.log('✅ Data updated in', DATA_FILE);
console.log('Run the site and visit /churches/' + churchData.slug + '.html to see it.');