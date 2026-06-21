const fs = require('fs');
const path = require('path');

const singles = [
  'classic', 'modern', 'minimal', 'magazine', 'card', 'hero',
  'sidebar', 'fullwidth', 'dark', 'light', 'event', 'ministry',
  'youth', 'outreach', 'catholic', 'network',
];

function base(name, multi) {
  const extra = multi
    ? '<section class="p-6 border-t"><h2 class="text-xl font-semibold">Extended Content</h2><p class="text-sm text-slate-600">Multi-page template — events, ministry details, reviews, and contact on separate sections.</p></section>'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Listing | Upper Room DFW</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="../../css/main.css">
  <link rel="stylesheet" href="../../css/platform.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body class="tail-container urdfw-platform tpl-${name}">
  <nav class="p-4 border-b bg-white sticky top-0"><a href="../../directory.html">← Directory</a> <span class="text-xs ml-2 px-2 py-0.5 bg-sky-100 rounded">Template: ${name}</span></nav>
  <main class="max-w-4xl mx-auto p-6">
    <h1 id="listing-name" class="text-3xl font-bold"></h1>
    <p id="listing-meta" class="text-slate-600"></p>
    <img id="listing-image" class="w-full h-64 object-cover rounded-xl my-4" alt="">
    <p id="listing-desc"></p>
    <div id="urdfw-reviews" class="mt-6"></div>
    <div id="urdfw-contact" class="mt-4"></div>
    ${extra}
  </main>
  <script src="../../js/main.js"></script>
  <script src="../../js/platform/00-core.js"></script>
  <script src="../../js/platform/06-reviews.js"></script>
  <script src="../../js/platform/11-integrations.js"></script>
  <script>
    (async function() {
      const res = await fetch('../../data/churches.json');
      const churches = await res.json();
      const slug = new URLSearchParams(location.search).get('slug') || '${name}-demo';
      const c = churches.find(x => x.slug === slug) || churches[0];
      document.getElementById('listing-name').textContent = c.name;
      document.getElementById('listing-meta').textContent = c.area + ', TX • ' + c.category;
      document.getElementById('listing-image').src = '../../' + c.image;
      document.getElementById('listing-desc').textContent = c.fullDescription || c.description;
      document.title = c.name + ' | ' + c.area + ' | Upper Room DFW';
      await URDFWPlatform.initCore();
      URDFWPlatform.renderReviewForm(document.getElementById('urdfw-reviews'), c.id);
      URDFWPlatform.renderContactForm(document.getElementById('urdfw-contact'), c);
    })();
  </script>
</body>
</html>`;
}

const singleDir = path.join(__dirname, '../templates/single');
const multiDir = path.join(__dirname, '../templates/multi');
fs.mkdirSync(singleDir, { recursive: true });
fs.mkdirSync(multiDir, { recursive: true });

singles.forEach((n) => fs.writeFileSync(path.join(singleDir, n + '.html'), base(n, false)));
['standard-multipage', 'premium-multipage'].forEach((n) =>
  fs.writeFileSync(path.join(multiDir, n + '.html'), base(n, true))
);
console.log('Created', singles.length, 'single + 2 multi templates');