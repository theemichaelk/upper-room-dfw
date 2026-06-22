#!/usr/bin/env node
/**
 * Expand data/churches.json to 105+ DFW listings and generate missing HTML pages.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'churches.json');
const TARGET = parseInt(process.env.TARGET_CHURCHES || '105', 10);

const AREAS = [
  { name: 'Arlington', lat: 32.7357, lng: -97.1081 },
  { name: 'Dallas', lat: 32.7792, lng: -96.8089 },
  { name: 'Fort Worth', lat: 32.7555, lng: -97.3308 },
  { name: 'Plano', lat: 33.0198, lng: -96.6989 },
  { name: 'Frisco', lat: 33.1507, lng: -96.8236 },
  { name: 'Irving', lat: 32.8140, lng: -96.9489 },
  { name: 'Garland', lat: 32.9126, lng: -96.6389 },
  { name: 'Mesquite', lat: 32.7668, lng: -96.5992 },
  { name: 'Richardson', lat: 32.9483, lng: -96.7299 },
  { name: 'Carrollton', lat: 32.9537, lng: -96.8903 },
  { name: 'McKinney', lat: 33.1972, lng: -96.6398 },
  { name: 'Denton', lat: 33.2148, lng: -97.1331 },
  { name: 'Lewisville', lat: 33.0462, lng: -96.9942 },
  { name: 'Grand Prairie', lat: 32.7459, lng: -96.9978 },
  { name: 'Euless', lat: 32.8371, lng: -97.0819 },
];

const PREFIXES = ['Grace', 'Hope', 'Faith', 'New Life', 'Cornerstone', 'Crossroads', 'Summit', 'Harvest', 'Living Word', 'Riverside', 'Trinity', 'Covenant', 'Calvary', 'Bethel', 'Emmanuel', 'Redeemer', 'Restoration', 'Victory', 'Abundant Life', 'Kingdom'];
const SUFFIXES = ['Community Church', 'Fellowship', 'Worship Center', 'Baptist Church', 'Methodist Church', 'Assembly', 'Chapel', 'Ministries', 'Family Church', 'Bible Church'];
const DENOMINATIONS = ['Non-denominational', 'Baptist', 'Methodist', 'Pentecostal', 'Presbyterian', 'Lutheran', 'Assembly of God', 'Church of Christ', 'Episcopal', 'Catholic'];
const CATEGORIES = ['Church', 'Church', 'Church', 'Ministry', 'Youth', 'Outreach', 'Event'];
const SIZES = ['Small', 'Medium', 'Large', 'Mega', 'Network'];
const TAG_POOL = ['Contemporary', 'Traditional', 'Family', 'Youth', 'Worship', 'Bilingual', 'Outreach', 'Prayer', 'Small Groups', 'Missions', 'Community', 'Historic'];
const IMAGES = Array.from({ length: 38 }, (_, i) => `images/${i + 1}.jpg`);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function jitter(base, spread, i) {
  return +(base + ((i % 17) - 8) * spread).toFixed(4);
}

function generateChurch(id, i) {
  const area = pick(AREAS, i);
  const prefix = pick(PREFIXES, i * 3);
  const suffix = pick(SUFFIXES, i * 7);
  const name = `${prefix} ${suffix} ${area.name}`;
  const slug = slugify(`${prefix}-${suffix}-${area.name}`) + `-${id}`;
  const denomination = pick(DENOMINATIONS, i);
  const category = pick(CATEGORIES, i);
  const tags = [pick(TAG_POOL, i), pick(TAG_POOL, i + 5), pick(TAG_POOL, i + 11)].filter((v, idx, a) => a.indexOf(v) === idx);
  const image = pick(IMAGES, i);

  return {
    id,
    slug,
    name,
    area: area.name,
    category,
    address: `${1200 + (i % 800)} ${pick(['Main', 'Oak', 'Church', 'Faith', 'Park', 'Broadway'], i)} St, ${area.name}, TX`,
    lat: jitter(area.lat, 0.018, i),
    lng: jitter(area.lng, 0.022, i),
    phone: `(${469 + (i % 3)}${i % 10}) 555-${String(1000 + id).slice(-4)}`,
    email: `hello@${slug.slice(0, 24)}.org`,
    website: `https://${slug.slice(0, 20)}.org`,
    times: category === 'Event' ? 'Monthly gatherings' : `Sundays ${9 + (i % 3)}:${i % 2 ? '30' : '00'}am`,
    description: `A welcoming ${denomination.toLowerCase()} ${category.toLowerCase()} serving families across ${area.name} and the greater DFW metroplex.`,
    fullDescription: `${name} is a vibrant faith community in ${area.name}, Texas. We offer authentic worship, biblical teaching, and programs for every generation. Our congregation is passionate about reaching neighbors, supporting local outreach, and helping families find their spiritual home in Dallas–Fort Worth.`,
    denomination,
    size: pick(SIZES, i),
    tags,
    image,
    featured: i % 11 === 0,
  };
}

const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const slugs = new Set(existing.map((c) => c.slug));
let nextId = Math.max(...existing.map((c) => c.id), 0) + 1;

while (existing.length < TARGET) {
  const church = generateChurch(nextId++, existing.length);
  if (slugs.has(church.slug)) continue;
  slugs.add(church.slug);
  existing.push(church);
}

fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));
console.log('churches.json now has', existing.length, 'entries');

const gen = spawnSync(process.execPath, [path.join(__dirname, 'generate-missing-pages.js')], {
  stdio: 'inherit',
  cwd: ROOT,
});
process.exit(gen.status || 0);