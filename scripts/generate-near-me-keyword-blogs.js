#!/usr/bin/env node
/**
 * Generate long-form DFW blog posts for "near me" keyword list
 * in the same format as expand-and-schedule-blog.js / existing posts.
 *
 * Usage: node scripts/generate-near-me-keyword-blogs.js
 * Then:  node scripts/generate-blog.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'blog-posts.json');

// Reuse expand helpers by inlining minimal set (avoid circular imports)
const INTERNAL_POOL = [
  { href: 'directory.html', label: 'DFW church directory' },
  { href: 'register.html', label: 'register your church on Upper Room DFW' },
  { href: 'events.html', label: 'DFW faith events calendar' },
  { href: 'about.html', label: 'About Upper Room DFW' },
  { href: 'contact.html', label: 'contact the Upper Room team' },
  { href: 'features.html', label: 'platform features for churches' },
  { href: 'blog.html', label: 'Upper Room DFW faith blog' },
  { href: 'churches/the-grove-community-church.html', label: 'The Grove Community Church profile' },
  { href: 'churches/grace-community-church-plano.html', label: 'Grace Community Church Plano profile' },
  { href: 'churches/first-baptist-arlington.html', label: 'First Baptist Arlington profile' },
  { href: 'churches/vibrant-life-church-frisco.html', label: 'Vibrant Life Church Frisco profile' },
  { href: 'churches/covenant-church-dallas.html', label: 'Covenant Church Dallas profile' },
  { href: 'churches/calvary-chapel-fort-worth.html', label: 'Calvary Chapel Fort Worth profile' },
  { href: 'churches/st-marys-catholic-parish.html', label: "St. Mary's Catholic Parish profile" },
  { href: 'claim-listing.html', label: 'claim an existing listing' },
];

const EXTERNAL_POOL = [
  { href: 'https://en.wikipedia.org/wiki/Dallas%E2%80%93Fort_Worth_metroplex', label: 'Dallas–Fort Worth metroplex (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Christianity_in_the_United_States', label: 'Christianity in the United States (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Catholic_Church_in_the_United_States', label: 'Catholic Church in the United States (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Baptists', label: 'Baptists overview (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Methodism', label: 'Methodism (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Eastern_Orthodox_Church', label: 'Eastern Orthodox Church (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Nondenominational_Christianity', label: 'nondenominational Christianity overview' },
  { href: 'https://en.wikipedia.org/wiki/The_Church_of_Jesus_Christ_of_Latter-day_Saints', label: 'LDS Church overview (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Lutheranism', label: 'Lutheranism (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Episcopal_Church_(United_States)', label: 'Episcopal Church (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Seventh-day_Adventist_Church', label: 'Seventh-day Adventist Church (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Pentecostalism', label: 'Pentecostalism (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Presbyterianism', label: 'Presbyterianism (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Anglicanism', label: 'Anglicanism (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Unitarian_Universalism', label: 'Unitarian Universalism (Wikipedia)' },
  { href: 'https://www.pewresearch.org/religion/', label: 'Pew Research Center Religion research' },
  { href: 'https://en.wikipedia.org/wiki/Plano,_Texas', label: 'Plano, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Fort_Worth,_Texas', label: 'Fort Worth, Texas (Wikipedia)' },
  { href: 'https://en.wikipedia.org/wiki/Arlington,_Texas', label: 'Arlington, Texas (Wikipedia)' },
];

const IMAGE_POOL = Array.from({ length: 38 }, (_, i) => `images/${i + 1}.jpg`);

const KEYWORDS = [
  'churches near me',
  'church near me',
  'catholic church near me',
  "church's chicken near me",
  'baptist church near me',
  'christian church near me',
  'orthodox church near me',
  'non denominational church near me',
  'catholic churches near me',
  'mormon church near me',
  'lds church near me',
  'church chicken near me',
  'lutheran church near me',
  'episcopal church near me',
  'adventist church near me',
  'methodist church near me',
  'pentecostal church near me',
  'presbyterian church near me',
  'baptist churches near me',
  'non denominational churches near me',
  'sda church near me',
  'church of christ near me',
  'churchs near me',
  'christian churches near me',
  'black churches near me',
  'lutheran churches near me',
  'catholic church near me mass times',
  'roman catholic church near me',
  'anglican church near me',
  'church jobs near me',
  'united methodist church near me',
  'church services near me',
  'churches for sale near me',
  'church service near me',
  'church near me now',
  'life church near me',
  'eastern orthodox church near me',
  'community church near me',
  "church's chicken near by me",
  'greek orthodox church near me',
  'church for sale near me',
  'church near me catholic',
  'churches near me with saturday services',
  'near me catholic church',
  'bible church near me',
  'church camps near me',
  'church daycare near me',
  'unitarian church near me',
  'orthodox churches near me',
  'churches that help with rent near me',
  'catholic church near me mass',
  'reformed church near me',
  'unitarian universalist church near me',
  'episcopal churches near me',
  'methodist churches near me',
  'catholic church in near me',
  'black church near me',
  'seventh day adventist church near me',
  'pentecostal churches near me',
  'non-denominational church near me',
  'catholic churches near me mass times',
  'roman catholic churches near me',
];

function hash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}
function pick(arr, seed, salt = '') {
  const n = parseInt(hash(seed + '|' + salt).slice(0, 8), 16);
  return arr[n % arr.length];
}
function pickN(arr, seed, n, salt = '') {
  const out = [];
  const used = new Set();
  let i = 0;
  while (out.length < n && i < arr.length * 4) {
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
function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function imgTag(src, alt, prefix = '') {
  return `<figure class="urdfw-blog-figure my-8"><img src="${prefix}${src}" alt="${escAttr(alt)}" class="w-full rounded-2xl object-cover max-h-96" loading="lazy" width="1200" height="675"><figcaption class="text-xs text-slate-500 mt-2 text-center">${escAttr(alt)}</figcaption></figure>`;
}
function h2(t) { return `<h2>${t}</h2>`; }
function h3(t) { return `<h3>${t}</h3>`; }
function p(...paras) { return paras.map((t) => `<p>${t}</p>`).join(''); }
function ul(items) { return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`; }
function ol(items) { return `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`; }

function slugify(kw) {
  return String(kw)
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function titleCaseKw(kw) {
  return kw
    .split(/\s+/)
    .map((w) => {
      if (w.toLowerCase() === 'me' || w.toLowerCase() === 'near' || w.toLowerCase() === 'with' || w.toLowerCase() === 'for' || w.toLowerCase() === 'in' || w.toLowerCase() === 'of' || w.toLowerCase() === 'the' || w.toLowerCase() === 'a') {
        return w.toLowerCase();
      }
      if (w.toLowerCase() === 'lds' || w.toLowerCase() === 'sda') return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function detectIntent(kw) {
  const k = kw.toLowerCase();
  if (/chicken/.test(k)) return 'chicken';
  if (/mass/.test(k) || /roman catholic|catholic/.test(k)) return 'catholic';
  if (/baptist/.test(k)) return 'baptist';
  if (/methodist|united methodist/.test(k)) return 'methodist';
  if (/orthodox|greek orthodox|eastern orthodox/.test(k)) return 'orthodox';
  if (/mormon|lds/.test(k)) return 'lds';
  if (/lutheran/.test(k)) return 'lutheran';
  if (/episcopal/.test(k)) return 'episcopal';
  if (/anglican/.test(k)) return 'anglican';
  if (/adventist|sda|seventh day/.test(k)) return 'adventist';
  if (/pentecostal/.test(k)) return 'pentecostal';
  if (/presbyterian/.test(k)) return 'presbyterian';
  if (/non[- ]?denominational/.test(k)) return 'nondenom';
  if (/unitarian/.test(k)) return 'unitarian';
  if (/reformed/.test(k)) return 'reformed';
  if (/church of christ/.test(k)) return 'coc';
  if (/bible church/.test(k)) return 'bible';
  if (/black church/.test(k)) return 'black';
  if (/community church/.test(k)) return 'community';
  if (/life church/.test(k)) return 'life';
  if (/jobs/.test(k)) return 'jobs';
  if (/for sale|sale/.test(k)) return 'sale';
  if (/camp/.test(k)) return 'camp';
  if (/daycare|day care/.test(k)) return 'daycare';
  if (/rent|help with/.test(k)) return 'aid';
  if (/saturday/.test(k)) return 'saturday';
  if (/service/.test(k)) return 'services';
  if (/now/.test(k)) return 'now';
  if (/christian church/.test(k)) return 'christian';
  return 'general';
}

const INTENT_ANGLE = {
  chicken: (kw) => [
    h2('Restaurant vs. congregation: what people actually mean'),
    p(
      `Many phones autocomplete <strong>${kw}</strong> when someone wants fried chicken—not a worship service. Upper Room DFW is a <em>church directory</em>, not a restaurant map. If you need dinner, use Maps. If you need a spiritual home in Dallas–Fort Worth, stay here.`,
      'We still answer this search honestly because confused queries waste Sundays. Below we show how to pivot from a food search into a clear church shortlist across North Texas cities.'
    ),
    h2('If you meant a church, start with denomination and drive time'),
    p(
      'Type the tradition you prefer (Catholic, Baptist, non-denominational, Methodist) plus your city—Arlington, Plano, Fort Worth, Frisco—then open verified listings for service times and kids check-in.',
      `Use the <a href="../directory.html">searchable DFW church directory</a> instead of bouncing between restaurant pins and campus photos.`
    ),
  ].join(''),
  catholic: (kw) => [
    h2('Catholic life in the DFW metro'),
    p(
      `When locals search <strong>${kw}</strong>, they usually want Mass times, Confession hours, bilingual options, and a parish that fits their zip code—not a generic “great church” list.`,
      'Dallas–Fort Worth includes large diocesan parishes, Spanish-language Masses, and multi-campus communities. Confirm the latest schedule on the parish page and on Upper Room DFW before you leave home—holiday schedules change often.'
    ),
    h2('Mass times, parking, and first-time visitors'),
    ul([
      'Saturday vigil vs. Sunday morning options',
      'Spanish, bilingual, or Latin-rite options when available',
      'Family rooms, children’s liturgy, and accessible entrances',
      'How to register as a parishioner after a few visits',
    ]),
    p(`Browse Catholic-tagged listings in the <a href="../directory.html">directory</a> and cross-check <a href="../events.html">faith events</a> for parish festivals and RCIA seasons.`),
  ].join(''),
  baptist: (kw) => [
    h2('Baptist congregations across North Texas'),
    p(
      `Searches for <strong>${kw}</strong> cover everything from historic downtown churches to large multi-service campuses in the suburbs.`,
      'Compare preaching style, music, small groups, and student ministry. Southern Baptist, independent Baptist, and Missionary Baptist communities all appear in the metro—labels help, but a visit still matters.'
    ),
    h2('What to verify before Sunday'),
    ul(['Service times and dress culture', 'Kids & student ministry security', 'Community outreach and missions', 'How newcomers join groups']),
  ].join(''),
  methodist: (kw) => [
    h2('Methodist and United Methodist options in DFW'),
    p(
      `People typing <strong>${kw}</strong> often want liturgy with warmth, strong music, and local mission. United Methodist, Free Methodist, and related Wesleyan traditions serve corridors from East Dallas to Fort Worth.`,
      'Confirm campus identity after denominational shifts—names and affiliations change, but hospitality should stay clear on every listing.'
    ),
  ].join(''),
  orthodox: (kw) => [
    h2('Orthodox Christianity in Dallas–Fort Worth'),
    p(
      `Queries like <strong>${kw}</strong> often point to Greek, Antiochian, OCA, or other Eastern Orthodox parishes—plus, less often, Oriental Orthodox communities.`,
      'Expect Divine Liturgy, calendar feasts, and parish fellowship after services. Call ahead if you are new to Orthodoxy; many priests welcome inquirers and offer catechesis.'
    ),
  ].join(''),
  lds: (kw) => [
    h2('LDS / Latter-day Saint meetinghouses near you'),
    p(
      `Searches for <strong>${kw}</strong> usually mean The Church of Jesus Christ of Latter-day Saints. Meetinghouses and temples serve different purposes—weekly worship vs. temple ordinances.`,
      'Upper Room DFW focuses on broader Christian directory listings; always verify ward times on official LDS tools, then use our directory for neighboring Christian communities if you are exploring wider options in DFW.'
    ),
  ].join(''),
  lutheran: (kw) => [
    h2('Lutheran worship in the Metroplex'),
    p(`Whether ELCA, LCMS, or WELS, families searching <strong>${kw}</strong> care about liturgy, education, and parish schools. Compare cities—Plano, Fort Worth, and Dallas each host long-standing Lutheran congregations.`),
  ].join(''),
  episcopal: (kw) => [
    h2('Episcopal churches and Anglican roots'),
    p(`<strong>${kw}</strong> points many seekers toward Book of Common Prayer worship, choirs, and outreach ministries. Visit twice—once on a principal feast if you can—to feel the rhythm of the parish.`),
  ].join(''),
  anglican: (kw) => [
    h2('Anglican congregations in North Texas'),
    p(`Anglican searches (${kw}) may include ACNA, continuing Anglican, and related parishes. Clarify affiliation and communion practices when you visit.`),
  ].join(''),
  adventist: (kw) => [
    h2('Seventh-day Adventist (SDA) worship'),
    p(
      `People searching <strong>${kw}</strong> often need <em>Saturday</em> Sabbath services, health ministries, and Pathfinder or youth programs.`,
      'Filter for Saturday worship when browsing Upper Room DFW and confirm times on the local SDA listing.'
    ),
  ].join(''),
  pentecostal: (kw) => [
    h2('Pentecostal and Spirit-filled churches'),
    p(`From Assemblies of God to independent Pentecostal congregations, <strong>${kw}</strong> often means expressive worship, altar ministry, and mid-week prayer. Ask about kids ministry security the same way you would at any large campus.`),
  ].join(''),
  presbyterian: (kw) => [
    h2('Presbyterian churches across DFW'),
    p(`PC(USA), PCA, and other Presbyterian bodies appear in local results for <strong>${kw}</strong>. Expect thoughtful preaching and ordered worship—confirm elder-led structure if that matters to your household.`),
  ].join(''),
  nondenom: (kw) => [
    h2('Non-denominational churches near you'),
    p(
      `Many DFW campuses brand as non-denominational when people type <strong>${kw}</strong>. Compare theology statements, multi-site models, and small-group culture—not only production quality.`,
      'Non-denominational does not mean “no beliefs.” Read the about page and visit a mid-week group before joining membership.'
    ),
  ].join(''),
  unitarian: (kw) => [
    h2('Unitarian and Unitarian Universalist communities'),
    p(`Searches for <strong>${kw}</strong> usually seek inclusive, non-creedal communities. Confirm service style, children’s religious education, and social justice ministries on the listing page.`),
  ].join(''),
  reformed: (kw) => [
    h2('Reformed churches in North Texas'),
    p(`Reformed and Calvinistic congregations answer <strong>${kw}</strong> with confessional teaching and often quieter liturgy. Compare PCA, URC, and independent Reformed options by city corridor.`),
  ].join(''),
  coc: (kw) => [
    h2('Churches of Christ in DFW'),
    p(`A-cappella worship and biblical emphasis characterize many Churches of Christ. When you search <strong>${kw}</strong>, note service times and whether the congregation is instrumental or a cappella.`),
  ].join(''),
  bible: (kw) => [
    h2('Bible churches and expositional teaching'),
    p(`“Bible church” searches like <strong>${kw}</strong> often want verse-by-verse teaching and adult education. Look for adult classes, men’s/women’s studies, and clear statement-of-faith pages.`),
  ].join(''),
  black: (kw) => [
    h2('Black churches and historic African American congregations'),
    p(
      `Families searching <strong>${kw}</strong> often want gospel music, strong preaching, and community leadership rooted in African American church tradition.`,
      'DFW is rich with historic and contemporary Black congregations—use city filters (Dallas, Fort Worth, Arlington, DeSoto, Cedar Hill) and visit more than once.'
    ),
  ].join(''),
  community: (kw) => [
    h2('Community churches and neighborhood campuses'),
    p(`Community church branding answers <strong>${kw}</strong> with local focus—schools, sports, and neighborhood service. Ask how they partner with nearby cities and nonprofits.`),
  ].join(''),
  life: (kw) => [
    h2('“Life Church” and multi-site brand names'),
    p(
      `Some people type <strong>${kw}</strong> looking for a specific multi-site brand; others mean any vibrant life-stage church. Confirm the legal name and campus address on the listing so you do not drive to the wrong city.`
    ),
  ].join(''),
  jobs: (kw) => [
    h2('Church jobs and ministry openings near you'),
    p(
      `If you searched <strong>${kw}</strong> for employment—pastoral staff, facilities, childcare, worship—start with the church’s own careers page, denomination job boards, and networking through a visit.`,
      'Upper Room DFW helps you discover congregations; open roles change weekly. Contact larger campuses in Dallas and Fort Worth directly, and keep your résumé ministry-ready.'
    ),
  ].join(''),
  sale: (kw) => [
    h2('Churches for sale vs. finding a place to worship'),
    p(
      `Commercial searches like <strong>${kw}</strong> usually mean real estate—sanctuary buildings, land, or former campuses. That is a realtor and zoning question, not a Sunday visit plan.`,
      'If you meant “a church for me to attend,” switch to denomination + city filters in our directory. If you are a congregation seeking facilities, contact brokers who specialize in religious properties in North Texas.'
    ),
  ].join(''),
  camp: (kw) => [
    h2('Church camps and summer ministry'),
    p(`Parents typing <strong>${kw}</strong> want summer camps, VBS, and retreats. Check youth-tagged listings and seasonal events on Upper Room DFW each spring—slots fill early in Collin and Tarrant counties.`),
  ].join(''),
  daycare: (kw) => [
    h2('Church daycare and weekday childcare'),
    p(
      `Daycare searches (${kw}) need licensing, hours, and age ranges—not only Sunday branding. Call the church office, verify state licensing, and tour before enrolling.`,
      'Directory tags help you find family-friendly campuses; always confirm weekday programs separately from weekend worship.'
    ),
  ].join(''),
  aid: (kw) => [
    h2('Churches that help with rent and benevolence'),
    p(
      `When someone searches <strong>${kw}</strong>, they need practical help now. Many DFW churches partner with food pantries, benevolence funds, and referral networks.`,
      'Call ahead: funds are limited and often require an appointment, ID, and residency proof. Upper Room DFW can help you find outreach-oriented congregations; also contact 211 Texas and local nonprofits for emergency housing support.'
    ),
  ].join(''),
  saturday: (kw) => [
    h2('Saturday services and vigil Masses'),
    p(
      `Not every church meets only on Sunday mornings. <strong>${kw}</strong> often means Catholic Saturday vigil, Adventist Sabbath, or Saturday evening contemporary services.`,
      'Filter listings and read times carefully—Saturday 5 p.m. vs. Sunday 9 a.m. changes your whole weekend plan.'
    ),
  ].join(''),
  services: (kw) => [
    h2('Finding service times near you'),
    p(`Whether you typed <strong>${kw}</strong> or a close variant, start with verified times, parking notes, and kids ministry hours. Holiday weekends differ—always re-check the week of Easter and Christmas.`),
  ].join(''),
  now: (kw) => [
    h2('“Near me now”: open services and last-minute visits'),
    p(
      `Urgent searches like <strong>${kw}</strong> happen when someone needs a service today—traveling, grieving, or newly arrived in DFW.`,
      'Call the church office or check the listing for today’s times. Live maps help with traffic; Upper Room DFW helps with accurate campus details before you drive.'
    ),
  ].join(''),
  christian: (kw) => [
    h2('Christian churches across the metro'),
    p(`Broad searches for <strong>${kw}</strong> include many traditions. Narrow by denomination, language, and kids ministry once you have three non-negotiables written down.`),
  ].join(''),
  general: (kw) => [
    h2('How “near me” really works in a metro this large'),
    p(
      `Typing <strong>${kw}</strong> into a phone returns maps first—but maps do not know your theology, kids needs, or language. Upper Room DFW adds those filters on top of location.`,
      'Start with a 15–25 minute drive radius from home, then expand. Dallas, Fort Worth, Arlington, Plano, Frisco, Irving, and Denton each create different “near me” realities on a Sunday morning.'
    ),
    h2('Turn a vague search into a shortlist'),
    ol([
      'Name your city corridor (not only “DFW”).',
      'Add one tradition or worship style preference.',
      'Require or skip kids ministry.',
      'Open three listings and compare times side by side.',
      'Visit twice before deciding.',
    ]),
  ].join(''),
};

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

function buildPost(kw, index, startDate) {
  const intent = detectIntent(kw);
  const slugBase = slugify(kw);
  const slug = `${slugBase}-dfw`.replace(/-dfw-dfw$/, '-dfw');
  const title =
    intent === 'chicken'
      ? `${titleCaseKw(kw)}: Restaurant Search vs Finding a Church in DFW`
      : `${titleCaseKw(kw)} in Dallas–Fort Worth: A Local Directory Guide`;
  const city = 'Dallas-Fort Worth';
  const primaryKw = kw;
  const keywords = [
    kw,
    'churches near me',
    'churches in DFW',
    'church directory DFW',
    'Upper Room DFW',
    city,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const seed = slug;
  const imgs = buildImages(seed, title);
  const [img1, img2] = imgs.images;
  const prefix = '../';
  const internal = pick(INTERNAL_POOL, seed, 'internal');
  const external = pick(EXTERNAL_POOL, seed, 'external');
  const angleFn = INTENT_ANGLE[intent] || INTENT_ANGLE.general;

  let body = [
    p(
      `Searching for a spiritual home in North Texas is rarely a single click. Families look for <strong>${primaryKw}</strong>, then narrow by neighborhood, youth programs, bilingual worship, or outreach—often in the same evening. This guide is written for that journey: practical, specific to Dallas–Fort Worth, and honest about what a good fit feels like on a real Sunday.`,
      `Upper Room DFW is a church directory for Texas’s largest metro. Whether you are evaluating <em>churches near me</em>, comparing listings across the metro, or leading a congregation that wants to be found by neighbors searching for <em>churches in DFW</em>, the goal is the same—clear information, verified listings, and trustworthy next steps.`
    ),
    imgTag(img1.src, img1.alt, prefix),
    h2(`Finding your way around ${city}`),
    p(
      `When families look for <strong>${primaryKw}</strong>, they usually care about three things: how far the drive really is, whether kids and youth will feel safe and known, and whether the teaching and community feel like home. A clear church directory helps you compare those pieces side by side instead of opening twenty tabs and hoping one campus sticks.`,
      `Upper Room DFW is built for that job in the Dallas–Fort Worth metroplex. We organize verified church listings so a parent in Plano, a student in Denton, or a new hire relocating to Fort Worth can review worship style, youth ministry, bilingual services, and outreach without starting from scratch every Sunday.`,
      `People also ask practical follow-ups: “Is there a Spanish service near me?”, “Which churches have secure kids check-in?”, and “Where can I serve in the city this month?” Those are real life questions—not marketing slogans—and they deserve honest, local answers.`
    ),
    h2('Quick brief before you visit'),
    p(`Keep this short list handy while you explore options related to ${title.toLowerCase()}.`),
    ul([
      '<strong>Know your season:</strong> a young family, empty-nester couple, and college student need different things on the same Sunday.',
      '<strong>Name your place:</strong> list your city or corridor (Plano, East Fort Worth, Mid-Cities) so you are not comparing impossible commutes.',
      '<strong>Look for proof:</strong> service times, parking notes, kids security, and real outreach matter more than polished slogans.',
      '<strong>Trust verified listings:</strong> complete profiles and honest program tags save you from surprise “we don’t have that” moments in the lobby.',
      '<strong>Take next steps slowly:</strong> browse → shortlist → visit twice → join a group or serve team.',
    ]),
    angleFn(kw),
    imgTag(img2.src, img2.alt, prefix),
    h2(`A practical visit plan for ${city} families`),
    ol([
      'Define three non-negotiables (kids ministry, language, worship style, or outreach focus).',
      `Build a shortlist of three churches using the Upper Room DFW directory filters for ${city} and nearby suburbs.`,
      'Confirm times, parking, and kids check-in on the listing page before you leave home.',
      'Visit the main service once; return for a mid-week group or serve opportunity.',
      'Debrief as a household: Did greeters help? Did teaching connect? Would you invite a neighbor?',
      'If you lead a church, claim or register your profile so newcomers can find accurate information.',
    ]),
    p(
      `Most people do not choose a spiritual home from a single ad. They compare, ask friends, look up <em>churches in DFW</em> again, and need confirmation that a congregation is real, welcoming, and active in the city.`
    ),
    h2('Neighborhood corridors and commute reality in Dallas-Fort Worth'),
    p(
      `Commutes shape church choice as much as theology for many DFW households. A family in North Dallas may hesitate to drive to South Fort Worth every week; a Keller campus may serve a different weekday rhythm than downtown Dallas. When you evaluate ${primaryKw}, map the real door-to-door time for Sunday school drop-off and mid-week groups—not just pin-to-pin distance.`,
      'Upper Room DFW organizes listings by city and area so you can compare Arlington, Plano, Frisco, McKinney, Mesquite, Grand Prairie, Richardson, Carrollton, Euless, and Lewisville without losing the metro-wide picture.',
      `Specific place names help more than vague phrases like “great churches nearby.” Knowing what a first-time visitor should expect when searching <strong>${primaryKw}</strong> in each corridor of the Dallas–Fort Worth metroplex saves disappointment and wasted Sundays.`
    ),
    h2('For pastors and church administrators in Texas'),
    p(
      'If you serve a congregation in Dallas, Fort Worth, Arlington, Plano, Frisco, Garland, Irving, Denton, McKinney, or any North Texas city, your public listing is part of hospitality. Incomplete details create friction for the very people you want to welcome.',
      'Upper Room DFW offers verified profiles, clear church pages, and a member portal so staff can update times and programs without waiting on a web agency. Premium plans help multi-campus and growing churches stay visible in one of America’s densest church markets.',
      'Treat the directory like infrastructure: accurate data, honest program tags, and photos that look like your actual Sunday—not a stock-photo fantasy. That is how families find you with confidence.'
    ),
    h2('FAQ: local questions we hear every week'),
    h3(`What is the best way to find ${kw} in ${city}?`),
    p('Start with a verified directory that covers the full metro, not only one denomination. Cross-check service times on the church’s own site, then visit. Maps help with proximity; a good guide helps with fit.'),
    h3('Is Upper Room DFW a church?'),
    p('No. Upper Room DFW is a local church directory and platform helping families discover churches across Texas’s DFW region and helping congregations publish accurate listings.'),
    h3('How can churches in Texas help newcomers find them?'),
    p('Keep Google Business Profile details consistent, publish clear service times, welcome honest reviews, and maintain a complete directory listing with youth, bilingual, and outreach tags when those ministries are real.'),
    h3('Should we rely only on maps and social media?'),
    p('Maps are great for “how far.” Friends and social posts help with “who do I know.” A directory plus a thoughtful visit plan still does the best job of connecting both.'),
    `<p class="urdfw-silo-links"><strong>Explore next:</strong> Start from the <a href="${prefix}index.html">Upper Room DFW homepage</a>, compare options in the <a href="${prefix}${internal.href}">${internal.label}</a>, and ground your research with <a href="${external.href}" target="_blank" rel="noopener noreferrer">${external.label}</a> for broader context beyond a single search for <em>churches near me</em>.</p>`,
    p(
      `<strong>Bottom line:</strong> Families choose churches through usefulness, accuracy, and local clarity—not hype. Use Upper Room DFW as your research hub when you search <em>${kw}</em>, visit with intention, and keep your own listing current if you serve a church in Texas.`
    ),
  ].join('');

  // pad if needed
  let guard = 0;
  while (wordCount(body) < 1000 && guard < 4) {
    body += p(
      `Finally, revisit your shortlist every few months if you are still evaluating ${primaryKw}. New campuses launch, service times shift, and bilingual options expand across North Texas. A living directory plus practical guides keeps both seekers and church leaders aligned with how people look for churches in Texas today.`,
      `When friends ask for a recommendation after you searched ${primaryKw}, send them a shortlist of three verified listings—not a single viral video. Comparison is kindness in a metro this large.`
    );
    guard += 1;
  }

  const publishedAt = new Date(startDate.getTime() + index * 7 * 86400000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
  // normalize to 10:00 UTC like other posts
  const d = new Date(publishedAt);
  d.setUTCHours(10, 0, 0, 0);

  return {
    slug,
    title,
    excerpt: `A 1,000+ word local guide for people searching “${kw}” in Dallas–Fort Worth—how to compare verified church listings, service times, and next steps with Upper Room DFW.`,
    city,
    keywords,
    image: imgs.image,
    images: imgs.images,
    publishedAt: d.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
    status: d.getTime() <= Date.now() ? 'published' : 'scheduled',
    readMinutes: Math.max(8, Math.ceil(wordCount(body) / 220)),
    content: body,
    primaryKeyword: primaryKw,
  };
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const existingSlugs = new Set((data.posts || []).map((p) => p.slug));

  // Schedule after last existing post
  let lastMs = Date.now();
  for (const p of data.posts || []) {
    const t = new Date(p.publishedAt).getTime();
    if (t > lastMs) lastMs = t;
  }
  const start = new Date(lastMs + 7 * 86400000);
  start.setUTCHours(10, 0, 0, 0);

  const created = [];
  const skipped = [];
  let idx = 0;
  for (const kw of KEYWORDS) {
    const post = buildPost(kw, idx, start);
    if (existingSlugs.has(post.slug)) {
      skipped.push(post.slug);
      continue;
    }
    // avoid slug collision by suffix
    let slug = post.slug;
    let n = 2;
    while (existingSlugs.has(slug)) {
      slug = `${post.slug}-${n++}`;
    }
    post.slug = slug;
    existingSlugs.add(slug);
    data.posts.push(post);
    created.push({ slug: post.slug, kw, words: wordCount(post.content), status: post.status });
    idx += 1;
  }

  data.drip = data.drip || {};
  data.drip.totalScheduled = (data.posts || []).filter((p) => p.status === 'scheduled').length;
  data.drip.nearMeBatch = {
    added: created.length,
    at: new Date().toISOString(),
    note: 'near-me keyword batch from generate-near-me-keyword-blogs.js',
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`Added ${created.length} posts (skipped ${skipped.length} slug collisions)`);
  console.log(`Total posts now: ${data.posts.length}`);
  console.log('Sample:', created.slice(0, 5).map((c) => c.slug).join(', '));
  const under = created.filter((c) => c.words < 1000);
  if (under.length) console.warn('Under 1000 words:', under.length, under.slice(0, 3));
  else console.log('All new posts ≥ 1000 words');
}

main();
