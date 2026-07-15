#!/usr/bin/env node
/**
 * Expand existing blog posts to 1000+ words (SEO/AEO/GEO) and schedule 25 new
 * weekly drip posts. Each post: 2 images + 3 siloed links
 * (homepage, internal Upper Room page, authoritative external).
 *
 * Usage: node scripts/expand-and-schedule-blog.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'blog-posts.json');

const INTERNAL_POOL = [
  { href: 'directory.html', label: 'DFW church directory' },
  { href: 'register.html', label: 'register your church on Upper Room DFW' },
  { href: 'pricing.html', label: 'Standard and Premium listing plans' },
  { href: 'events.html', label: 'DFW faith events calendar' },
  { href: 'about.html', label: 'About Upper Room DFW' },
  { href: 'contact.html', label: 'contact the Upper Room team' },
  { href: 'features.html', label: 'platform features for churches' },
  { href: 'training.html', label: 'member training hub' },
  { href: 'submit-listing.html', label: 'submit a church listing' },
  { href: 'claim-listing.html', label: 'claim an existing listing' },
  { href: 'churches/the-grove-community-church.html', label: 'The Grove Community Church profile' },
  { href: 'churches/grace-community-church-plano.html', label: 'Grace Community Church Plano profile' },
  { href: 'churches/first-baptist-arlington.html', label: 'First Baptist Arlington profile' },
  { href: 'churches/all-nations-fellowship.html', label: 'All Nations Fellowship profile' },
  { href: 'churches/vibrant-life-church-frisco.html', label: 'Vibrant Life Church Frisco profile' },
  { href: 'churches/covenant-church-dallas.html', label: 'Covenant Church Dallas profile' },
  { href: 'churches/calvary-chapel-fort-worth.html', label: 'Calvary Chapel Fort Worth profile' },
  { href: 'member-dashboard.html', label: 'church member portal' },
  { href: 'privacy-policy.html', label: 'privacy policy' },
  { href: 'blog.html', label: 'Upper Room DFW faith blog' },
];

const EXTERNAL_POOL = [
  { href: 'https://en.wikipedia.org/wiki/Dallas%E2%80%93Fort_Worth_metroplex', label: 'Dallas–Fort Worth metroplex (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Christianity_in_the_United_States', label: 'Christianity in the United States (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Nondenominational_Christianity', label: 'nondenominational Christianity overview' },
  { href: 'https://en.wikipedia.org/wiki/Southern_Baptist_Convention', label: 'Southern Baptist Convention background' },
  { href: 'https://www.pewresearch.org/religion/', label: 'Pew Research Center Religion research' },
  { href: 'https://www.barna.com/', label: 'Barna Group faith research' },
  { href: 'https://www.census.gov/quickfacts/fact/table/dallascitytexas,fortworthcitytexas/PST045223', label: 'U.S. Census QuickFacts for Dallas & Fort Worth' },
  { href: 'https://www.texas.gov/', label: 'State of Texas official site' },
  { href: 'https://www.christianitytoday.com/', label: 'Christianity Today' },
  { href: 'https://www.thegospelcoalition.org/', label: 'The Gospel Coalition' },
  { href: 'https://lifewayresearch.com/', label: 'Lifeway Research' },
  { href: 'https://www.biblegateway.com/', label: 'Bible Gateway' },
  { href: 'https://business.google.com/us/business-profile/', label: 'Google Business Profile for churches' },
  { href: 'https://www.npr.org/sections/religion/', label: 'NPR Religion coverage' },
  { href: 'https://en.wikipedia.org/wiki/Plano,_Texas', label: 'Plano, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Fort_Worth,_Texas', label: 'Fort Worth, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Frisco,_Texas', label: 'Frisco, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Arlington,_Texas', label: 'Arlington, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/House_church', label: 'house church movement (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Youth_ministry', label: 'youth ministry (Wikipedia)' },
  { href: 'https://www.visitingdallas.com/', label: 'Visit Dallas' },
  { href: 'https://www.fortworth.com/', label: 'Fort Worth official visitor site' },
  { href: 'https://en.wikipedia.org/wiki/Megachurch', label: 'megachurch landscape (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Multiculturalism', label: 'multicultural communities (Wikipedia)' },
  { href: 'https://www.usa.gov/', label: 'USA.gov civic resources' },
];

const IMAGE_POOL = Array.from({ length: 38 }, (_, i) => `images/${i + 1}.jpg`);

function hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function pick(arr, seed, salt = '') {
  const h = hash(seed + '|' + salt);
  const n = parseInt(h.slice(0, 8), 16);
  return arr[n % arr.length];
}

function pickN(arr, seed, n, salt = '') {
  const out = [];
  const used = new Set();
  let i = 0;
  while (out.length < n && i < arr.length * 3) {
    const item = pick(arr, seed, salt + i);
    const key = typeof item === 'string' ? item : item.href;
    if (!used.has(key)) {
      used.add(key);
      out.push(item);
    }
    i += 1;
  }
  return out;
}

function wordCount(html) {
  const t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.split(' ').filter(Boolean).length : 0;
}

function imgTag(src, alt, prefix = '') {
  return `<figure class="urdfw-blog-figure my-8"><img src="${prefix}${src}" alt="${escAttr(alt)}" class="w-full rounded-2xl object-cover max-h-96" loading="lazy" width="1200" height="675"><figcaption class="text-xs text-slate-500 mt-2 text-center">${escAttr(alt)}</figcaption></figure>`;
}

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function linkHome(prefix = '') {
  return `<a href="${prefix}index.html">Upper Room DFW homepage</a>`;
}

function linkInternal(item, prefix = '') {
  return `<a href="${prefix}${item.href}">${item.label}</a>`;
}

function linkExternal(item) {
  return `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${item.label}</a>`;
}

function siloParagraph(seed, prefix = '') {
  const internal = pick(INTERNAL_POOL, seed, 'internal');
  const external = pick(EXTERNAL_POOL, seed, 'external');
  return `<p class="urdfw-silo-links"><strong>Explore next:</strong> Start from the ${linkHome(prefix)}, compare options in the ${linkInternal(internal, prefix)}, and ground your research with ${linkExternal(external)} for broader context beyond a single search for <em>churches near me</em>.</p>`;
}

function p(...paras) {
  return paras.map((t) => `<p>${t}</p>`).join('');
}

function h2(t) { return `<h2>${t}</h2>`; }
function h3(t) { return `<h3>${t}</h3>`; }
function ul(items) { return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`; }
function ol(items) { return `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`; }

/** Core long-form sections reused with local injection */
function geoFramework(city, primaryKw) {
  return [
    h2(`How local search works for “${primaryKw}” in ${city}`),
    p(
      `When someone types <strong>${primaryKw}</strong>, Google and AI answer engines blend map pack results, website relevance, and real-world signals: proximity, reviews, service times, and entity clarity. After two decades of local SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization), the pattern is consistent—directories that publish structured, city-specific content help both human families and machine systems resolve intent faster than a single church homepage ever could.`,
      `Upper Room DFW exists for that job in the Dallas–Fort Worth metroplex. We organize verified church listings so a parent in Plano, a student in Denton, or a new hire relocating to Fort Worth can compare worship style, youth ministry, bilingual services, and outreach without bouncing across twenty unconnected websites.`,
      `Authoritative local content also answers follow-up questions voice search and AI chat often surface: “Is there a Spanish service near me?”, “Which churches near me have secure kids check-in?”, and “What is the best church directory in Texas for DFW suburbs?” Those questions are not vanity keywords—they are how real people decide where to walk through the doors on Sunday.`
    ),
  ].join('');
}

function aeoBlock(topic) {
  return [
    h2(`Answer-ready takeaways (AEO)`),
    p(`Answer engines favor clear, scannable facts. Use this block as a quick brief before you visit or list a church related to ${topic}.`),
    ul([
      `<strong>Intent first:</strong> separate “churches near me tonight” (map) from “best church directory in Texas for comparing youth programs” (research).`,
      `<strong>Entity clarity:</strong> name the city, neighborhood corridor, and program tags (youth, bilingual, outreach) so listings match how people speak.`,
      `<strong>Proof over hype:</strong> service times, parking notes, kids security, and real outreach beats vague brand language.`,
      `<strong>Trust loops:</strong> verified profiles, consistent NAP-style details, and human editorial oversight improve both SEO and AI citations.`,
      `<strong>Action path:</strong> browse → shortlist → visit twice → join a group or serve team—not a one-click “conversion.”`,
    ]),
  ].join('');
}

function visitFramework(city) {
  return [
    h2(`A practical visit plan for ${city} families`),
    ol([
      `Define three non-negotiables (kids ministry, language, worship style, or outreach focus).`,
      `Build a shortlist of three churches using the Upper Room DFW directory filters for ${city} and nearby suburbs.`,
      `Confirm times, parking, and kids check-in on the listing page before you leave home.`,
      `Visit the main service once; return for a mid-week group or serve opportunity.`,
      `Debrief as a household: Did greeters help? Did teaching connect? Would you invite a neighbor?`,
      `If you lead a church, claim or register your profile so searchers can find accurate data.`,
    ]),
    p(
      `This cadence respects both spiritual discernment and local search behavior. People rarely choose a spiritual home from a single sponsored ad. They compare, ask friends, re-query <em>churches in DFW</em>, and look for confirmation that a congregation is real, welcoming, and active in the city.`
    ),
  ].join('');
}

function pastorBlock() {
  return [
    h2(`For pastors and church administrators in Texas`),
    p(
      `If you serve a congregation in Dallas, Fort Worth, Arlington, Plano, Frisco, Garland, Irving, Denton, McKinney, or any North Texas city, your online presence is part of pastoral care. Incomplete listings create friction for the very people you want to welcome.`,
      `Upper Room DFW offers verified profiles, SEO-oriented church pages, and a member portal so staff can update times and programs without waiting on a web agency. Premium plans expand visibility for multi-campus and high-growth churches competing for attention in one of America’s densest church markets.`,
      `Treat the directory as infrastructure: accurate data, honest program tags, and photos that look like your actual Sunday—not a stock-photo fantasy. That is how you rank for relevant local queries without compromising integrity.`
    ),
  ].join('');
}

function faqBlock(city, kws) {
  const q1 = kws[0] || 'churches near me';
  return [
    h2(`FAQ: local questions we hear every week`),
    h3(`What is the best way to find ${q1} in ${city}?`),
    p(`Start with a verified directory that covers the full metro, not only one denomination. Cross-check service times on the church’s own site, then visit. Map packs help with proximity; long-form guides help with fit.`),
    h3(`Is Upper Room DFW a church?`),
    p(`No. Upper Room DFW is a local church directory and platform helping families discover churches across Texas’s DFW region and helping congregations publish accurate listings.`),
    h3(`How do churches in Texas improve local discovery?`),
    p(`Keep Google Business Profile data consistent, publish clear service times, collect authentic reviews ethically, and maintain a complete directory listing with youth, bilingual, and outreach tags when relevant.`),
    h3(`What about AI search and voice assistants?`),
    p(`AEO and GEO reward structured answers, entity names, and city context. Content that defines terms, lists steps, and cites real local patterns is more likely to be summarized accurately than thin blog filler.`),
  ].join('');
}

function padToMinWords(html, seed, city, primaryKw, min = 1000) {
  let body = html;
  let guard = 0;
  while (wordCount(body) < min && guard < 8) {
    body += [
      h2(guard === 0 ? `Neighborhood corridors and commute reality in ${city}` : `More local context for ${primaryKw} (${guard + 1})`),
      p(
        `Commutes shape church choice as much as theology for many DFW households. A family in North Dallas may hesitate to drive to South Fort Worth every week; a Keller campus may serve a different weekday rhythm than downtown Dallas. When you evaluate ${primaryKw}, map the real door-to-door time for Sunday school drop-off and mid-week groups—not just pin-to-pin distance.`,
        `Upper Room DFW organizes listings by city and area so you can compare Arlington, Plano, Frisco, McKinney, Mesquite, Grand Prairie, Richardson, Carrollton, Euless, and Lewisville without losing the metro-wide picture. That dual lens—hyperlocal and regional—is how experienced local SEO practitioners approach multi-city markets.`,
        `Generative engines also prefer content that names these places explicitly. Vague “great churches nearby” language underperforms next to specific, helpful descriptions of what a first-time visitor should expect in each corridor of the Dallas–Fort Worth metroplex.`
      ),
      p(
        `Finally, revisit your shortlist quarterly. New campuses launch, service times shift, and bilingual options expand. A living directory plus evergreen education content keeps both seekers and church leaders aligned with how people actually search for churches in Texas today.`
      ),
    ].join('');
    guard += 1;
  }
  return body;
}

function buildImages(seed, title) {
  const imgs = pickN(IMAGE_POOL, seed, 2, 'img');
  return {
    image: imgs[0],
    images: [
      { src: imgs[0], alt: `${title} — DFW church community photo 1` },
      { src: imgs[1], alt: `${title} — local faith and fellowship photo 2` },
    ],
  };
}

function buildContent(spec, prefix = '../') {
  const {
    slug, title, city, primaryKw, keywords, angleSections,
  } = spec;
  const seed = slug;
  const imgs = buildImages(seed, title);
  const [img1, img2] = imgs.images;

  let body = [
    p(
      `Searching for a spiritual home in North Texas is rarely a single click. Families type <strong>${primaryKw}</strong>, then refine to neighborhoods, youth programs, bilingual worship, or outreach—often within the same evening. This guide is written for that journey: practical, locally specific, and optimized for how people and AI systems discover churches across the Dallas–Fort Worth metroplex.`,
      `Upper Room DFW is a church directory built for Texas’s largest metro. Whether you are evaluating <em>churches near me</em>, comparing the <em>best directory in Texas</em> for multi-city life, or leading a congregation that needs to be found for <em>churches in DFW</em>, the goal is the same—clear information, verified listings, and trustworthy next steps.`
    ),
    imgTag(img1.src, img1.alt, prefix),
    geoFramework(city, primaryKw),
    aeoBlock(title.toLowerCase()),
    angleSections(prefix, seed),
    imgTag(img2.src, img2.alt, prefix),
    visitFramework(city),
    pastorBlock(),
    faqBlock(city, keywords),
    siloParagraph(seed, prefix),
    p(
      `<strong>Bottom line:</strong> Local ranking for church discovery is won by usefulness, accuracy, and city-level clarity—not keyword stuffing. Use Upper Room DFW as your research hub, visit with intention, and keep your own listing current if you serve a church in Texas.`
    ),
  ].join('');

  body = padToMinWords(body, seed, city, primaryKw, 1000);
  return { ...imgs, content: body, readMinutes: Math.max(8, Math.ceil(wordCount(body) / 220)) };
}

/* ─── Expand existing 10 posts ─── */
const EXISTING_SPECS = [
  {
    slug: 'how-to-choose-a-church-in-dfw',
    title: 'How to Choose a Church in DFW: A Local Family Guide',
    excerpt: 'A 1,000+ word local SEO guide for Dallas–Fort Worth families comparing worship, youth programs, bilingual services, and outreach using the Upper Room DFW church directory—built with AEO and GEO best practices for “churches near me” intent.',
    city: 'Dallas-Fort Worth',
    keywords: ['choose a church DFW', 'churches near me', 'find church Dallas', 'church directory DFW', 'churches in DFW', 'Upper Room DFW'],
    primaryKw: 'churches near me in DFW',
    angleSections: (prefix) => [
      h2('Start with non-negotiables, not trends'),
      p(
        'List what your household will not compromise: secure children’s ministry, bilingual worship, contemporary music, small groups, or community outreach. Trends shift; your season of life is more stable. Upper Room DFW tags help you filter verified listings by city, denomination signals, and programs instead of guessing from social media ads alone.',
        'Couples often disagree on style before they agree on theology. Write the list together. If youth ministry is essential, treat it as a first filter—not an afterthought after three quiet Sundays.'
      ),
      h2('Visit twice before you decide'),
      p(
        'First visit for the main service; second for a mid-week group or volunteer hour. Notice greeters, signage, kids check-in security, and whether newcomers are welcomed intentionally. In a metro the size of DFW, a single “good vibe” Sunday is not enough data.',
        `Use the ${linkInternal({ href: 'directory.html', label: 'searchable church directory' }, prefix)} to pre-check parking notes and service times so your first visit is about people, not logistics.`
      ),
      h2('Use local data, not guesswork'),
      p(
        'Our directory tracks 100+ verified churches across North Texas cities with program tags—youth, family, outreach, bilingual—and GMB-aligned signals where available. That structure supports both classic SEO and generative answers that need entities and cities, not vague “great church” claims.',
        'If you are relocating for work, start with a 20-minute commute radius from home and office, then expand. Many DFW freeways look short on a map and long at 8:45 a.m. Sunday when kids are restless.'
      ),
    ].join(''),
  },
  {
    slug: 'best-churches-in-plano-for-families',
    title: 'Best Churches in Plano for Families: What Locals Search For',
    excerpt: 'Plano and Collin County parents prioritize kids programs, safety, and community. A long-form local guide to family-friendly churches, with SEO/AEO framing for “churches near me” and Upper Room DFW directory filters.',
    city: 'Plano',
    keywords: ['churches Plano TX', 'family church Plano', 'kids ministry Plano', 'churches near me Plano', 'Collin County churches', 'church directory'],
    primaryKw: 'family churches in Plano',
    angleSections: (prefix) => [
      h2('What Plano families filter first'),
      ul([
        'Sunday kids check-in and background-checked volunteers',
        'Weeknight small groups near Legacy West, Preston Meadow, or West Plano corridors',
        'Bilingual or multicultural worship options',
        'Student ministry pipelines from middle school through high school',
      ]),
      p(
        `Plano continues to attract young families—and church search trends on Upper Room show youth and children’s programs dominate filters. Compare verified Plano listings next to Allen, Frisco, and Richardson campuses that share the same school-district life.`,
        `Browse ${linkInternal({ href: 'directory.html?q=Plano', label: 'Plano church listings' }, prefix)} and cross-check ${linkInternal({ href: 'events.html', label: 'local faith events' }, prefix)} for family nights and camps.`
      ),
      h2('Safety, belonging, and the “second hour”'),
      p(
        'Parents evaluate the lobby as carefully as the sermon. Clear signage, friendly greeters, and predictable dismissal procedures lower anxiety. Ask how special-needs kids are supported and how new families join groups without awkward signup tables.',
        'A “best church” list is always subjective. Use criteria, not influencer ranking. Upper Room DFW helps you shortlist; the Holy Spirit and your household discernment finish the process.'
      ),
    ].join(''),
  },
  {
    slug: 'fort-worth-churches-contemporary-worship',
    title: 'Fort Worth Churches with Contemporary Worship: A Local Shortlist',
    excerpt: 'From downtown Fort Worth to Keller and Arlington, a GEO-optimized guide to contemporary worship communities—live bands, practical teaching, and how to compare listings for churches in DFW’s western half.',
    city: 'Fort Worth',
    keywords: ['Fort Worth churches', 'contemporary worship DFW', 'churches Keller TX', 'churches near me Fort Worth', 'churches in Texas', 'Upper Room DFW'],
    primaryKw: 'contemporary churches in Fort Worth',
    angleSections: (prefix) => [
      h2('How we define contemporary worship locally'),
      p(
        'Live music, practical sermons, casual dress, and digital-first communication—including online giving and group apps—define many Tarrant County campuses. Historic congregations may blend liturgical roots with modern sets; new plants may lean fully band-driven.',
        `Filter Upper Room DFW by worship style and city to compare Fort Worth, Arlington, Keller, and Burleson side by side via the ${linkInternal({ href: 'directory.html?q=Fort+Worth', label: 'Fort Worth directory results' }, prefix)}.`
      ),
      h2('West-side corridors that shape attendance'),
      p(
        'I-35W, 820, and the Alliance corridor create different “near me” realities than East Fort Worth or downtown. Pin your home, work, and kids’ activities before you fall in love with a campus twenty-five minutes away on a good day.',
        'Contemporary does not mean shallow. Ask about discipleship pathways, baptism classes, and how new believers are mentored—not only production quality.'
      ),
    ].join(''),
  },
  {
    slug: 'dfw-youth-ministries-guide-2026',
    title: 'DFW Youth Ministries Guide 2026: Programs Parents Should Know',
    excerpt: 'Youth nights, summer camps, and mentorship across Dallas–Fort Worth—framed for local SEO queries about teen church programs and “churches near me” with strong student ministry.',
    city: 'DFW Metroplex',
    keywords: ['youth ministry DFW', 'teen church programs Dallas', 'youth group Fort Worth', 'churches near me youth', 'church directory Texas', 'Upper Room DFW'],
    primaryKw: 'youth ministries in DFW',
    angleSections: (prefix) => [
      h2('What strong youth programs share'),
      ol([
        'Background-checked volunteers and clear check-in',
        'Weekly rhythm plus seasonal retreats',
        'Parent communication via email or SMS',
        'Pathways from middle school to college ministry',
      ]),
      p(
        `Youth ministry remains a top filter on Upper Room DFW. Search youth-tagged listings and open campus pages for mid-week times. Start with ${linkInternal({ href: 'directory.html?q=youth', label: 'youth-friendly church search' }, prefix)}.`,
        'Ask students—not only staff—how welcome they felt. Belonging is the metric teens report; parents hear “fine” until the car ride home reveals more.'
      ),
      h2('Summer 2026 and school-year rhythms'),
      p(
        'Camps and mission trips spike searches every May. Book early, verify medical forms, and confirm scholarship policies. During the school year, consistency beats flashy one-off events for spiritual formation.'
      ),
    ].join(''),
  },
  {
    slug: 'bilingual-churches-dallas-fort-worth',
    title: 'Bilingual Churches in Dallas & Fort Worth: Spanish & Multicultural Worship',
    excerpt: 'A long-form guide to bilingual and multicultural congregations across DFW—Spanish services, multi-language campuses, and directory tactics for “iglesia cerca de mí” and churches near me.',
    city: 'Dallas',
    keywords: ['bilingual church Dallas', 'Spanish church DFW', 'multicultural church Fort Worth', 'iglesia Dallas', 'churches near me Spanish', 'church directory'],
    primaryKw: 'bilingual churches in Dallas–Fort Worth',
    angleSections: (prefix) => [
      h2('Why bilingual listings matter for local search'),
      p(
        'DFW is one of America’s most diverse metros. Seekers search both English and Spanish phrases. Verified tags help families find worship in their heart language without trial-and-error visits across Irving, Dallas, Fort Worth, and Garland.',
        `Explore ${linkInternal({ href: 'directory.html?q=bilingual', label: 'bilingual church search results' }, prefix)} and multicultural profiles such as ${linkInternal({ href: 'churches/all-nations-fellowship.html', label: 'All Nations Fellowship in Irving' }, prefix)}.`
      ),
      h2('Beyond translation: belonging'),
      p(
        'True multicultural ministry includes leadership diversity, bilingual kids spaces, and events that do not force one culture to assimilate silently. Ask how leadership teams are structured and how second-generation youth are shepherded.'
      ),
    ].join(''),
  },
  {
    slug: 'first-time-church-visitor-checklist-dfw',
    title: 'First-Time Church Visitor Checklist for DFW Newcomers',
    excerpt: 'A comprehensive DFW visitor checklist—parking, kids drop-off, dress, follow-up questions—optimized for newcomers searching churches near me and first-time visitor guides.',
    city: 'DFW Metroplex',
    keywords: ['first time church visitor', 'church etiquette Texas', 'visit church Dallas', 'newcomer church DFW', 'churches near me', 'Upper Room DFW'],
    primaryKw: 'visiting a church for the first time in DFW',
    angleSections: (prefix) => [
      h2('Before you go'),
      ul([
        'Check service times on the Upper Room listing page',
        'Arrive 15 minutes early for parking and kids check-in',
        'Bring a friend if possible',
        'Note the campus address—many churches have multiple locations',
      ]),
      h2('Questions to ask a greeter'),
      ul([
        'Where do first-time guests check in?',
        'Are small groups open this week?',
        'How do I learn about serving locally?',
        'Is there a newcomer lunch or class?',
      ]),
      p(`Find a church to visit this Sunday through the ${linkInternal({ href: 'directory.html', label: 'DFW church directory' }, prefix)}.`),
    ].join(''),
  },
  {
    slug: 'dfw-faith-events-summer-2026',
    title: 'DFW Faith Events Summer 2026: Festivals, Revivals & Community Outreach',
    excerpt: 'Summer faith events across North Texas—conferences, outdoor worship, family festivals—plus how event discovery ties to church directory SEO and local “things to do” intent.',
    city: 'DFW Metroplex',
    keywords: ['DFW church events', 'faith festival Texas 2026', 'Christian events Dallas', 'church conference Fort Worth', 'churches in DFW', 'Upper Room DFW'],
    primaryKw: 'DFW faith events summer 2026',
    angleSections: (prefix) => [
      h2('How to stay updated'),
      p(
        `Bookmark the ${linkInternal({ href: 'events.html', label: 'Global Events & DFW Faith Calendar' }, prefix)} and subscribe to our RSS feed for roundups. Summer fills with outdoor worship nights, youth camps, and city-wide outreach across Dallas, Fort Worth, Arlington, and Frisco.`,
        'Registered churches can submit events through the member portal for featured placement—keeping the calendar useful for both locals and visitors.'
      ),
      h2('Why events boost local discovery'),
      p(
        'Event pages and calendar entries create timely content signals. Families searching “church events near me” often convert to regular attendance when logistics are clear and campuses feel welcoming.'
      ),
    ].join(''),
  },
  {
    slug: 'small-groups-north-texas',
    title: 'Small Groups in North Texas: How to Find Community Beyond Sunday',
    excerpt: 'Sunday is the front door; small groups build lasting friendships. A GEO guide to home groups, Bible studies, and community across Plano, Dallas, Fort Worth, and suburbs.',
    city: 'North Texas',
    keywords: ['church small groups DFW', 'Bible study Dallas', 'community groups Fort Worth', 'home group Plano', 'churches near me', 'church directory'],
    primaryKw: 'small groups in North Texas',
    angleSections: (prefix) => [
      h2('Types of groups to look for'),
      ul([
        'Neighborhood home groups',
        'Young adult or young family cohorts',
        'Men’s and women’s studies',
        'Serve teams tied to outreach',
      ]),
      p(
        `Many DFW transplants say finding community took longer than finding a worship service. Ask listing contacts about open groups—or ${linkInternal({ href: 'contact.html', label: 'message Upper Room' }, prefix)} for recommendations by city.`,
        'Online groups help, but weekly face-to-face rhythms still form the strongest bonds in a sprawling metro.'
      ),
    ].join(''),
  },
  {
    slug: 'register-your-church-upper-room-dfw',
    title: 'Register Your Church on Upper Room DFW: SEO Benefits for Local Listings',
    excerpt: 'Why verified church listings rank in Google local search, how Google Business Profile alignment helps, and what pastors get with Standard and Premium plans on Upper Room DFW.',
    city: 'DFW Metroplex',
    keywords: ['list church Dallas', 'church directory SEO', 'register church DFW', 'best directory in Texas', 'churches in Texas', 'Upper Room DFW'],
    primaryKw: 'register your church on Upper Room DFW',
    angleSections: (prefix) => [
      h2('What registration includes'),
      ul([
        'Verified profile with photos and service times',
        'SEO-oriented page on upperroomdfw.com',
        'Inclusion in sitemap and RSS discovery pathways',
        'Member portal for updates without calling a developer',
      ]),
      p(
        `If your congregation serves DFW but isn’t listed, families searching <em>churches near me</em> may never find you. ${linkInternal({ href: 'register.html', label: 'Register your church' }, prefix)} or ${linkInternal({ href: 'pricing.html', label: 'compare Standard and Premium plans' }, prefix)}.`,
        'Directory SEO compounds with a healthy Google Business Profile: consistent names, categories, hours, and photos. Treat both as pastoral infrastructure.'
      ),
    ].join(''),
  },
  {
    slug: 'community-outreach-churches-dfw',
    title: 'Community Outreach Churches in DFW: Food Banks, Mentorship & City Serve',
    excerpt: 'Mission-minded congregations serving South Dallas, East Fort Worth, and suburban needs—plus how outreach tags help seekers find serve opportunities through the church directory.',
    city: 'DFW Metroplex',
    keywords: ['outreach churches Dallas', 'community service church DFW', 'mission church Fort Worth', 'volunteer church Texas', 'churches near me', 'Upper Room DFW'],
    primaryKw: 'outreach churches in DFW',
    angleSections: (prefix) => [
      h2('Find outreach-focused listings'),
      p(
        `Filter ${linkInternal({ href: 'directory.html?q=outreach', label: 'directory results for outreach' }, prefix)} to see congregations tagging active serve teams, food ministries, ESL classes, and re-entry mentorship.`,
        'Pick one church near your workplace, attend a serve Saturday, and ask how ongoing volunteers are onboarded. Consistency matters more than scale.'
      ),
      h2('Why seekers care about outreach'),
      p(
        'Many younger adults evaluate churches by tangible love for the city. Transparent outreach calendars and honest needs lists outperform polished branding that never invites hands-on service.'
      ),
    ].join(''),
  },
];

/* ─── 25 new weekly drip posts ─── */
const NEW_SPECS = [
  {
    slug: 'churches-near-me-dfw-how-to-search',
    title: 'Churches Near Me in DFW: How to Search Smarter Than the Map Pack',
    excerpt: 'Map packs show distance; fit needs more. A GEO/AEO guide to searching “churches near me” across Dallas–Fort Worth with Upper Room DFW filters and visit strategy.',
    city: 'Dallas-Fort Worth',
    keywords: ['churches near me', 'churches near me DFW', 'church directory', 'Upper Room DFW', 'churches in DFW', 'churches in Texas'],
    primaryKw: 'churches near me',
    angleSections: (prefix) => [
      h2('Map pack vs. research intent'),
      p(
        `“Churches near me” often means “open soon and close.” Other nights it means “help me compare youth programs across Plano and Frisco.” Upper Room DFW serves the research intent with filters and city pages while maps handle pure proximity.`,
        `Open the ${linkInternal({ href: 'directory.html', label: 'full DFW directory' }, prefix)} after you glance at maps so you do not shortlist only the loudest ads.`
      ),
      h2('Query refiners that improve results'),
      ul(['Add your suburb name', 'Add youth, bilingual, or outreach', 'Add worship style keywords', 'Compare two campuses in one weekend']),
    ].join(''),
  },
  {
    slug: 'best-church-directory-in-texas-dfw',
    title: 'Best Church Directory in Texas for DFW Families: What to Look For',
    excerpt: 'Not every directory is equal. Criteria for choosing the best church directory in Texas—coverage, verification, SEO pages, and member tools—centered on Upper Room DFW.',
    city: 'Texas',
    keywords: ['best directory in Texas', 'church directory', 'church directory Texas', 'Upper Room DFW', 'churches in Texas', 'churches in DFW'],
    primaryKw: 'best church directory in Texas',
    angleSections: (prefix) => [
      h2('Criteria that separate useful directories'),
      ol(['Metro-wide coverage, not one zip code', 'Editable member profiles', 'Program tags seekers actually use', 'Clean public pages for SEO', 'Human verification, not spam dumps']),
      p(`Upper Room DFW is purpose-built for North Texas discovery. ${linkInternal({ href: 'features.html', label: 'Review platform features' }, prefix)} and ${linkInternal({ href: 'register.html', label: 'list your church' }, prefix)}.`),
    ].join(''),
  },
  {
    slug: 'churches-in-texas-vs-dfw-local',
    title: 'Churches in Texas vs. Churches in DFW: Why Local Context Wins',
    excerpt: 'Statewide brand searches differ from DFW neighborhood intent. How GEO-focused content helps you rank for churches in Texas while converting local “near me” traffic.',
    city: 'Texas',
    keywords: ['churches in Texas', 'churches in DFW', 'church directory', 'churches near me', 'Upper Room DFW', 'Texas church search'],
    primaryKw: 'churches in Texas',
    angleSections: (prefix) => [
      h2('Statewide vs. metro intent'),
      p(
        'Someone searching “churches in Texas” may be planning a move, writing a paper, or comparing regions. “Churches in DFW” is closer to decision time. Publish content for both, but convert with city-level listings and visit CTAs.',
        `Use ${linkInternal({ href: 'directory.html', label: 'Upper Room’s metro directory' }, prefix)} as the bridge from broad curiosity to a Sunday plan.`
      ),
    ].join(''),
  },
  {
    slug: 'upper-room-dfw-church-directory-explained',
    title: 'Upper Room DFW Explained: How Our Church Directory Helps Locals',
    excerpt: 'What Upper Room DFW is (and is not), how listings work, and why a dedicated church directory improves discovery for families and pastors across Dallas–Fort Worth.',
    city: 'Dallas-Fort Worth',
    keywords: ['Upper Room DFW', 'church directory', 'DFW church directory', 'churches near me', 'churches in DFW', 'list church Texas'],
    primaryKw: 'Upper Room DFW church directory',
    angleSections: (prefix) => [
      h2('Platform pillars'),
      ul(['Public directory search', 'Church detail pages', 'Registration and claims', 'Member portal and billing tiers', 'Educational blog for local SEO']),
      p(`Start on the ${linkHome(prefix)}, then open ${linkInternal({ href: 'about.html', label: 'About Upper Room DFW' }, prefix)} for mission context.`),
    ].join(''),
  },
  {
    slug: 'dallas-churches-near-me-neighborhood-guide',
    title: 'Dallas Churches Near Me: A Neighborhood-by-Neighborhood Guide',
    excerpt: 'Oak Cliff, Lake Highlands, Uptown, South Dallas, and more—how to interpret “churches near me” inside the City of Dallas with directory filters and visit tips.',
    city: 'Dallas',
    keywords: ['Dallas churches near me', 'churches near me', 'churches in DFW', 'Dallas church directory', 'Upper Room DFW', 'church directory'],
    primaryKw: 'Dallas churches near me',
    angleSections: (prefix) => [
      h2('Neighborhood realities'),
      p(
        'Dallas is not one commute. A listing five miles away can be thirty minutes across town. Cluster your shortlist by north, south, east, and west corridors before you fall for a livestream highlight reel.',
        `Filter ${linkInternal({ href: 'directory.html?q=Dallas', label: 'Dallas listings on Upper Room' }, prefix)} and save two backups near work if home traffic is brutal on Sundays.`
      ),
    ].join(''),
  },
  {
    slug: 'arlington-churches-directory-guide',
    title: 'Arlington Churches Guide: Directory Tips Between Dallas and Fort Worth',
    excerpt: 'Arlington sits in the DFW heart. Find churches near entertainment districts, universities, and family suburbs with Upper Room filters and local SEO best practices.',
    city: 'Arlington',
    keywords: ['Arlington churches', 'churches near me Arlington', 'church directory', 'churches in DFW', 'Upper Room DFW', 'churches in Texas'],
    primaryKw: 'churches in Arlington TX',
    angleSections: (prefix) => [
      h2('Student and family dual markets'),
      p(
        'UTA students and long-term families share zip codes but not schedules. Look for young adult groups and robust kids ministry if your household bridges both.',
        `Compare ${linkInternal({ href: 'directory.html?q=Arlington', label: 'Arlington church listings' }, prefix)} and ${linkInternal({ href: 'churches/first-baptist-arlington.html', label: 'First Baptist Arlington profile' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'frisco-mckinney-churches-families',
    title: 'Frisco & McKinney Churches for Growing Families',
    excerpt: 'Collin County growth means new campuses and packed kids wings. A local guide for Frisco and McKinney families searching churches near me and youth programs.',
    city: 'Frisco',
    keywords: ['Frisco churches', 'McKinney churches', 'churches near me', 'family church Collin County', 'church directory', 'Upper Room DFW'],
    primaryKw: 'churches in Frisco and McKinney',
    angleSections: (prefix) => [
      h2('Fast-growth city challenges'),
      p(
        'Portables, multi-service schedules, and volunteer shortages are normal in high-growth suburbs. Ask how the church trains greeters and kids volunteers at scale.',
        `Browse ${linkInternal({ href: 'directory.html?q=Frisco', label: 'Frisco listings' }, prefix)} and ${linkInternal({ href: 'directory.html?q=McKinney', label: 'McKinney listings' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'irving-las-colinas-churches-guide',
    title: 'Irving & Las Colinas Churches: Corporate Corridor Faith Communities',
    excerpt: 'For professionals and families along the Irving–Las Colinas corridor—how to find churches near me with weekday groups that match corporate schedules.',
    city: 'Irving',
    keywords: ['Irving churches', 'Las Colinas church', 'churches near me', 'churches in DFW', 'church directory', 'Upper Room DFW'],
    primaryKw: 'churches in Irving TX',
    angleSections: (prefix) => [
      h2('Weekday rhythms for corporate households'),
      p(
        'Lunch Bible studies and late small groups matter as much as Sunday production. Look for transparent mid-week calendars on directory profiles.',
        `Start with ${linkInternal({ href: 'directory.html?q=Irving', label: 'Irving directory results' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'denton-churches-college-town',
    title: 'Denton Churches for Students and Long-Term Residents',
    excerpt: 'College-town energy meets established congregations. Search churches near me in Denton with filters for young adults, families, and bilingual ministry.',
    city: 'Denton',
    keywords: ['Denton churches', 'churches near me Denton', 'college church DFW', 'church directory', 'churches in Texas', 'Upper Room DFW'],
    primaryKw: 'churches in Denton TX',
    angleSections: (prefix) => [
      h2('Student ministry without forgetting families'),
      p(
        'Healthy Denton churches often run parallel tracks: vibrant college outreach and stable kids ministry for staff families. Ask how both are resourced.',
        `Use ${linkInternal({ href: 'directory.html?q=Denton', label: 'Denton church search' }, prefix)} on Upper Room DFW.`
      ),
    ].join(''),
  },
  {
    slug: 'garland-mesquite-churches-local-seo',
    title: 'Garland & Mesquite Churches: Local Search Tips for East DFW',
    excerpt: 'East DFW seekers need accurate listings and bilingual options. A practical GEO guide for Garland and Mesquite church discovery.',
    city: 'Garland',
    keywords: ['Garland churches', 'Mesquite churches', 'churches near me', 'church directory', 'churches in DFW', 'Upper Room DFW'],
    primaryKw: 'churches in Garland and Mesquite',
    angleSections: (prefix) => [
      h2('East corridor discovery'),
      p(
        'I-635 and I-30 shape attendance patterns. Shortlist churches within a realistic school-night drive for mid-week groups.',
        `Compare ${linkInternal({ href: 'directory.html?q=Garland', label: 'Garland' }, prefix)} and ${linkInternal({ href: 'directory.html?q=Mesquite', label: 'Mesquite' }, prefix)} listings.`
      ),
    ].join(''),
  },
  {
    slug: 'how-google-business-profile-helps-churches',
    title: 'Google Business Profile + Church Directory: Dual Local Ranking Strategy',
    excerpt: 'Align Google Business Profile data with Upper Room DFW listings to rank for churches near me, churches in DFW, and related local queries.',
    city: 'Dallas-Fort Worth',
    keywords: ['Google church listing', 'churches near me', 'church directory SEO', 'Upper Room DFW', 'local SEO churches', 'churches in Texas'],
    primaryKw: 'Google Business Profile for churches',
    angleSections: (prefix) => [
      h2('Consistency wins local pack and directories'),
      p(
        'Name, address, phone, hours, and categories should match across Google and your Upper Room profile. Inconsistencies confuse both algorithms and visitors.',
        `After updating GBP, refresh your ${linkInternal({ href: 'member-dashboard.html', label: 'member portal listing' }, prefix)} the same week.`
      ),
    ].join(''),
  },
  {
    slug: 'multi-campus-churches-dfw-how-to-choose',
    title: 'Multi-Campus Churches in DFW: How to Choose the Right Campus',
    excerpt: 'Satellite campuses change “near me” math. Evaluate teaching model, campus pastors, and kids ministry quality across multi-site churches in DFW.',
    city: 'Dallas-Fort Worth',
    keywords: ['multi campus church DFW', 'churches near me', 'churches in DFW', 'church directory', 'Upper Room DFW', 'Texas megachurch'],
    primaryKw: 'multi-campus churches in DFW',
    angleSections: (prefix) => [
      h2('Questions multi-site visitors should ask'),
      ul(['Is teaching live or video?', 'Who is the campus pastor?', 'Are groups campus-specific?', 'How are volunteers onboarded locally?']),
      p(`Use directory filters then open each campus profile. ${linkInternal({ href: 'directory.html', label: 'Browse all DFW listings' }, prefix)}.`),
    ].join(''),
  },
  {
    slug: 'non-denominational-churches-dfw-guide',
    title: 'Nondenominational Churches in DFW: What the Label Really Means',
    excerpt: 'Nondenominational is popular in Texas searches. Understand theology transparency, governance, and how to compare listings for churches near me.',
    city: 'Dallas-Fort Worth',
    keywords: ['nondenominational church DFW', 'churches near me', 'churches in Texas', 'church directory', 'Upper Room DFW', 'DFW churches'],
    primaryKw: 'nondenominational churches in DFW',
    angleSections: (prefix) => [
      h2('Transparency checklist'),
      p(
        'Ask for a statement of faith, leadership structure, and membership expectations. The label “nondenominational” is not a theology—it is a governance description.',
        `Shortlist via ${linkInternal({ href: 'directory.html', label: 'Upper Room DFW' }, prefix)} and visit with those questions ready.`
      ),
    ].join(''),
  },
  {
    slug: 'baptist-churches-north-texas-directory',
    title: 'Baptist Churches Across North Texas: Using a Directory Wisely',
    excerpt: 'From historic First Baptist congregations to contemporary Baptist campuses—how seekers use a church directory for churches in DFW and Texas-wide context.',
    city: 'North Texas',
    keywords: ['Baptist churches DFW', 'churches near me', 'churches in Texas', 'church directory', 'Upper Room DFW', 'Dallas Baptist church'],
    primaryKw: 'Baptist churches in North Texas',
    angleSections: (prefix) => [
      h2('Variety within a tradition'),
      p(
        'Worship style and culture vary widely among Baptist churches. Do not assume one campus represents all. Compare multiple listings and attend twice.',
        `Search ${linkInternal({ href: 'directory.html?q=Baptist', label: 'Baptist-tagged listings' }, prefix)} on Upper Room.`
      ),
    ].join(''),
  },
  {
    slug: 'methodist-presbyterian-lutheran-dfw',
    title: 'Mainline Churches in DFW: Methodist, Presbyterian & Lutheran Options',
    excerpt: 'A respectful local guide to mainline Protestant communities in Dallas–Fort Worth and how directory tags help beyond generic churches near me searches.',
    city: 'Dallas-Fort Worth',
    keywords: ['Methodist church DFW', 'Presbyterian Dallas', 'Lutheran Fort Worth', 'churches near me', 'church directory', 'Upper Room DFW'],
    primaryKw: 'mainline churches in DFW',
    angleSections: (prefix) => [
      h2('Liturgy, music, and mission'),
      p(
        'Mainline congregations often emphasize liturgy, social outreach, and intergenerational community. Visit for the full service—not only the welcome video.',
        `Explore city filters in the ${linkInternal({ href: 'directory.html', label: 'DFW church directory' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'catholic-churches-dfw-visitor-tips',
    title: 'Catholic Parishes in DFW: Visitor Tips for Mass Times & Community',
    excerpt: 'Helpful orientation for Catholics relocating to North Texas—Mass times, parish life, and how a church directory complements diocesan resources.',
    city: 'Dallas-Fort Worth',
    keywords: ['Catholic church DFW', 'Mass times Dallas', 'churches near me Catholic', 'church directory', 'Upper Room DFW', 'churches in Texas'],
    primaryKw: 'Catholic churches in DFW',
    angleSections: (prefix) => [
      h2('Relocating Catholics'),
      p(
        'Confirm Mass schedules on parish sites, then use Upper Room for neighborhood discovery alongside other Christian listings your household may also explore.',
        `See ${linkInternal({ href: 'churches/st-marys-catholic-parish.html', label: 'St. Mary’s Catholic Parish profile' }, prefix)} as an example listing format.`
      ),
    ].join(''),
  },
  {
    slug: 'online-church-vs-local-campus-dfw',
    title: 'Online Church vs. Local Campus in DFW: A Balanced Local Take',
    excerpt: 'Streaming helps—but local belonging still matters. How to weigh online options against churches near me for real community in Dallas–Fort Worth.',
    city: 'Dallas-Fort Worth',
    keywords: ['online church DFW', 'churches near me', 'local church Texas', 'church directory', 'Upper Room DFW', 'churches in DFW'],
    primaryKw: 'online vs local church in DFW',
    angleSections: (prefix) => [
      h2('When online is a bridge, not a destination'),
      p(
        'Use livestreams when ill or traveling, then re-engage a local campus for groups and serving. Hybrid habits work; isolation rarely does long-term.',
        `Find a campus via ${linkInternal({ href: 'directory.html', label: 'the Upper Room directory' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'church-parking-kids-checkin-dfw',
    title: 'Parking, Kids Check-In & First Impressions at DFW Churches',
    excerpt: 'Operational details win trust. A practical SEO-friendly guide covering first impressions seekers notice when searching churches near me.',
    city: 'Dallas-Fort Worth',
    keywords: ['church visitor tips DFW', 'kids check-in church', 'churches near me', 'church directory', 'Upper Room DFW', 'first time visitor'],
    primaryKw: 'church visitor experience in DFW',
    angleSections: (prefix) => [
      h2('Operations as hospitality'),
      p(
        'Parking lot greeters, clear kids security, and accessible restrooms communicate care. List these details on your Upper Room profile when you update photos.',
        `Pastors: ${linkInternal({ href: 'register.html', label: 'keep your listing current' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'women-mens-ministry-dfw-churches',
    title: 'Women’s & Men’s Ministries at DFW Churches: Finding Your People',
    excerpt: 'Beyond Sunday—how to evaluate men’s and women’s ministries when comparing churches in DFW using directory tags and visit questions.',
    city: 'Dallas-Fort Worth',
    keywords: ['women ministry DFW', 'mens group church Dallas', 'churches near me', 'church directory', 'Upper Room DFW', 'small groups DFW'],
    primaryKw: 'men’s and women’s ministries in DFW churches',
    angleSections: (prefix) => [
      h2('Ask for the calendar, not the brochure'),
      p(
        'Monthly breakfasts differ from weekly discipleship. Request a current calendar and visit once before joining long-term.',
        `Pair group search with ${linkInternal({ href: 'blog/small-groups-north-texas.html', label: 'our small groups guide' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'young-adults-churches-dallas-fort-worth',
    title: 'Young Adult Churches & Ministries in Dallas–Fort Worth',
    excerpt: '20s and 30s seekers need peers and purpose. Local guide for young adult ministry across churches in DFW and churches near me queries.',
    city: 'Dallas-Fort Worth',
    keywords: ['young adult church DFW', 'churches near me young adults', 'Dallas young adults ministry', 'church directory', 'Upper Room DFW', 'churches in DFW'],
    primaryKw: 'young adult churches in DFW',
    angleSections: (prefix) => [
      h2('Signals of healthy YA culture'),
      ul(['Peer leadership opportunities', 'Service projects', 'Transparent theology teaching', 'Pathways into multigenerational community']),
      p(`Browse listings and mid-week notes via ${linkInternal({ href: 'directory.html', label: 'Upper Room DFW' }, prefix)}.`),
    ].join(''),
  },
  {
    slug: 'how-to-list-church-seo-texas',
    title: 'How to List Your Church for SEO in Texas (DFW Playbook)',
    excerpt: 'A pastor’s playbook for listing on Upper Room DFW, aligning GBP, and earning visibility for churches in Texas and churches near me searches.',
    city: 'Texas',
    keywords: ['list church SEO', 'church directory', 'best directory in Texas', 'Upper Room DFW', 'churches in Texas', 'churches near me'],
    primaryKw: 'list your church for SEO in Texas',
    angleSections: (prefix) => [
      h2('Seven-day listing sprint'),
      ol([
        'Claim or register on Upper Room DFW',
        'Upload real photos',
        'Enter accurate service times',
        'Tag youth, bilingual, outreach if true',
        'Align Google Business Profile',
        'Share listing URL in weekly email',
        'Update quarterly',
      ]),
      p(`${linkInternal({ href: 'register.html', label: 'Start registration' }, prefix)} · ${linkInternal({ href: 'pricing.html', label: 'See plans' }, prefix)}`),
    ].join(''),
  },
  {
    slug: 'richardson-carrollton-churches-guide',
    title: 'Richardson & Carrollton Churches: Telecom Corridor Local Guide',
    excerpt: 'Diverse suburbs with strong family and international communities—how to search churches near me in Richardson and Carrollton effectively.',
    city: 'Richardson',
    keywords: ['Richardson churches', 'Carrollton churches', 'churches near me', 'church directory', 'churches in DFW', 'Upper Room DFW'],
    primaryKw: 'churches in Richardson and Carrollton',
    angleSections: (prefix) => [
      h2('International and family blend'),
      p(
        'These cities host multicultural congregations and long-standing family churches. Use bilingual and youth filters together when relevant.',
        `Search ${linkInternal({ href: 'directory.html?q=Richardson', label: 'Richardson' }, prefix)} and ${linkInternal({ href: 'directory.html?q=Carrollton', label: 'Carrollton' }, prefix)}.`
      ),
    ].join(''),
  },
  {
    slug: 'grand-prairie-euless-bedford-churches',
    title: 'Grand Prairie, Euless & Bedford Churches: Mid-Cities Faith Guide',
    excerpt: 'Mid-Cities living means multi-direction commutes. Find churches near me in Grand Prairie, Euless, and Bedford with directory-driven shortlists.',
    city: 'Euless',
    keywords: ['Euless churches', 'Grand Prairie churches', 'Bedford churches', 'churches near me', 'church directory', 'Upper Room DFW'],
    primaryKw: 'churches in the Mid-Cities',
    angleSections: (prefix) => [
      h2('Mid-Cities commute logic'),
      p(
        'Airport traffic and highway choice change Sunday timing. Prefer campuses on your natural path between home and grocery runs.',
        `Open ${linkInternal({ href: 'directory.html?q=Euless', label: 'Euless listings' }, prefix)} and nearby city filters.`
      ),
    ].join(''),
  },
  {
    slug: 'church-reviews-reputation-dfw',
    title: 'Church Reviews & Reputation in DFW: Reading Between the Stars',
    excerpt: 'How to interpret reviews ethically when choosing churches near me—and how pastors should respond without compromising integrity.',
    city: 'Dallas-Fort Worth',
    keywords: ['church reviews DFW', 'churches near me', 'church reputation', 'church directory', 'Upper Room DFW', 'local SEO churches'],
    primaryKw: 'church reviews in DFW',
    angleSections: (prefix) => [
      h2('For seekers'),
      p('Read recent reviews for patterns—parking, kids, friendliness—not one angry outlier. Still visit in person.'),
      h2('For church leaders'),
      p(
        'Invite honest feedback, fix operational issues, and never buy fake reviews. Pair reputation work with a complete directory profile.',
        `${linkInternal({ href: 'claim-listing.html', label: 'Claim your listing' }, prefix)} if it already exists.`
      ),
    ].join(''),
  },
  {
    slug: 'holiday-church-services-dfw-easter-christmas',
    title: 'Easter & Christmas Services in DFW: Finding Churches Near You',
    excerpt: 'Holiday service searches spike every year. Plan ahead with Upper Room DFW for Christmas Eve and Easter times across churches in DFW.',
    city: 'Dallas-Fort Worth',
    keywords: ['Christmas Eve service DFW', 'Easter church near me', 'churches near me', 'church directory', 'Upper Room DFW', 'churches in DFW'],
    primaryKw: 'holiday church services in DFW',
    angleSections: (prefix) => [
      h2('Plan two weeks early'),
      p(
        'Popular campuses fill parking lots early on Christmas Eve and Easter. Check multiple service times and overflow campuses on directory pages.',
        `Start at ${linkInternal({ href: 'directory.html', label: 'the DFW church directory' }, prefix)} and ${linkInternal({ href: 'events.html', label: 'events calendar' }, prefix)}.`
      ),
    ].join(''),
  },
];

function expandSpec(spec) {
  const built = buildContent(spec, '../');
  // Content is stored without prefix for JSON (generator adds paths)
  // Rebuild images/content with empty prefix for stored HTML body paths relative to blog/
  const builtStored = buildContent(spec, '../');
  return {
    slug: spec.slug,
    title: spec.title,
    excerpt: spec.excerpt,
    city: spec.city,
    keywords: spec.keywords,
    image: builtStored.image,
    images: builtStored.images,
    publishedAt: spec.publishedAt,
    status: spec.status || 'published',
    readMinutes: builtStored.readMinutes,
    content: builtStored.content,
    primaryKeyword: spec.primaryKw,
  };
}

function main() {
  const existingMap = Object.fromEntries(EXISTING_SPECS.map((s) => [s.slug, s]));

  // Preserve original published dates from current file when expanding
  let current = { posts: [] };
  if (fs.existsSync(DATA_PATH)) {
    current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  }
  const dateBySlug = Object.fromEntries((current.posts || []).map((p) => [p.slug, p.publishedAt]));

  const expandedExisting = EXISTING_SPECS.map((spec) => {
    const publishedAt = dateBySlug[spec.slug] || '2026-06-02T10:00:00.000Z';
    return expandSpec({ ...spec, publishedAt, status: 'published' });
  });

  // Weekly drip: first new post 2026-07-15, then every 7 days
  const start = new Date('2026-07-15T10:00:00.000Z');
  const scheduled = NEW_SPECS.map((spec, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return expandSpec({
      ...spec,
      publishedAt: d.toISOString(),
      status: 'scheduled',
    });
  });

  // Merge: expanded existing + new (skip new slugs that already exist)
  const existingSlugs = new Set(expandedExisting.map((p) => p.slug));
  const newOnly = scheduled.filter((p) => !existingSlugs.has(p.slug));

  const data = {
    version: '2.0.0',
    baseUrl: 'https://upperroomdfw.com',
    author: 'Upper Room DFW Editorial',
    drip: {
      postsPerWeek: 1,
      startDate: '2026-07-15',
      totalScheduled: newOnly.length,
      note: 'generate-blog.js only indexes/RSS posts with publishedAt <= now',
    },
    posts: [...expandedExisting, ...newOnly],
  };

  // Validate word counts
  const failures = [];
  for (const p of data.posts) {
    const w = wordCount(p.content);
    const imgs = (p.images && p.images.length) || (p.image ? 1 : 0);
    if (w < 1000) failures.push(`${p.slug}: ${w} words`);
    if (imgs < 2) failures.push(`${p.slug}: only ${imgs} images`);
    if (!p.content.includes('index.html')) failures.push(`${p.slug}: missing homepage link`);
    if (!/https?:\/\//.test(p.content)) failures.push(`${p.slug}: missing external link`);
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`Wrote ${data.posts.length} posts (${expandedExisting.length} expanded, ${newOnly.length} scheduled drip).`);
  data.posts.forEach((p) => {
    console.log(`  ${wordCount(p.content)}w  ${p.status || 'published'}  ${p.publishedAt.slice(0, 10)}  ${p.slug}`);
  });
  if (failures.length) {
    console.error('Validation issues:\n' + failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Validation OK: all posts ≥1000 words, 2 images, silo links present.');
  }
}

main();
