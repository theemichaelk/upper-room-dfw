#!/usr/bin/env node
/**
 * Add consistent meta description, og:url, and canonical across all HTML pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROD = 'https://upperroomdfw.com';

const CUSTOM_DESCRIPTIONS = {
  'admin.html': 'Secure admin portal for Upper Room DFW — manage church listings, billing, leads, integrations, email campaigns, and platform analytics.',
  'billing-hub.html': 'Billing and payment hub for Upper Room DFW church partners — Stripe, PayPal, subscriptions, invoices, and membership plans.',
  'blog.html': 'Faith stories, DFW church insights, directory tips, and community news from Upper Room DFW.',
  'churches/index.html': 'Browse verified church listings across Dallas–Fort Worth on Upper Room DFW.',
  'claim-listing.html': 'Claim your church or ministry listing on Upper Room DFW — verify ownership and manage your DFW directory profile.',
  'collections.html': 'Save and organize favorite DFW churches and ministries into collections on Upper Room DFW.',
  'csv-import.html': 'Import or export church directory data via CSV on the Upper Room DFW admin platform.',
  'embed.html': 'Embed the Upper Room DFW church directory on your website with a customizable widget.',
  'feature-checklist.html': 'Full feature checklist for the Upper Room DFW church directory SaaS platform — verify every capability.',
  'features.html': 'Explore Upper Room DFW platform features — listings, maps, billing, CRM, training, SEO, and church member tools.',
  'field-builder.html': 'Build custom listing fields for DFW churches and ministries on Upper Room DFW.',
  'form-builder.html': 'Create contact and lead capture forms for church listings on Upper Room DFW.',
  'go.html': 'Short-link redirect for Upper Room DFW directory listings, events, and campaigns.',
  'messages.html': 'Member messages and notifications for church partners on Upper Room DFW.',
  'page-builder.html': 'Drag-and-drop page builder for church listing pages on Upper Room DFW.',
  'privacy-policy.html': 'Privacy Policy for Upper Room DFW — how we collect, use, and protect your data on our DFW church directory.',
  'shortcode-builder.html': 'Generate directory shortcodes for listings, maps, and search widgets on Upper Room DFW.',
  'signup.html': 'Create your Upper Room DFW account to register a church, manage listings, and access the member portal.',
  'submit-listing.html': 'Submit a church, ministry, or event to the Upper Room DFW directory for DFW families to discover.',
  'support.html': 'Get help with your Upper Room DFW listing, billing, or member portal — contact support.',
  'templates.html': 'Choose single-page and multipage listing templates for DFW churches on Upper Room DFW.',
  'terms-of-service.html': 'Terms of Service for Upper Room DFW — rules and guidelines for using our DFW church directory platform.',
  'training.html': 'Interactive training and onboarding for church partners on Upper Room DFW — SEO, leads, and visibility.',
  'user-directory.html': 'Browse registered church members and partners in the Upper Room DFW platform directory.',
  'widgets.html': 'Directory widgets for search, categories, maps, and featured listings on Upper Room DFW.',
};

function walkHtml(dir, list = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, list);
    else if (name.endsWith('.html')) list.push(full);
  }
  return list;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getMeta(html, attr, key) {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeHtml(m[1].trim()) : '';
}

function getTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decodeHtml(m[1].replace(/\s+/g, ' ').trim()) : '';
}

function canonicalUrl(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (norm === 'index.html') return `${PROD}/`;
  return `${PROD}/${norm}`;
}

function normRel(rel) {
  return rel.replace(/\\/g, '/');
}

function buildDescription(rel, html) {
  const key = normRel(rel);
  const existing = getMeta(html, 'name', 'description');
  if (existing && !/^Listing — Upper Room DFW/i.test(existing)) return existing;

  const ogDesc = getMeta(html, 'property', 'og:description');
  if (ogDesc) return ogDesc;

  if (CUSTOM_DESCRIPTIONS[key]) return CUSTOM_DESCRIPTIONS[key];

  const title = getTitle(html);

  if (key.startsWith('templates/single/')) {
    const tpl = path.basename(key, '.html');
    return `Upper Room DFW "${tpl}" single-page listing template for DFW churches and ministries.`;
  }
  if (key.startsWith('templates/multi/')) {
    const tpl = path.basename(key, '.html');
    return `Upper Room DFW "${tpl}" multipage listing template for churches across Dallas–Fort Worth.`;
  }
  if (key.startsWith('churches/') && key !== 'churches/index.html') {
    const name = title.split('|')[0].trim();
    return `${name} — verified listing on Upper Room DFW, the Dallas–Fort Worth church and ministry directory.`;
  }

  const clean = title.replace(/\s*\|\s*Upper Room DFW.*$/i, '').trim();
  return `${clean} — Upper Room DFW, the trusted Dallas–Fort Worth church directory.`;
}

function stripSeoTags(html) {
  return html
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:url["'][^>]*>\s*/gi, '');
}

function insertSeoTags(html, { description, canonical, ogUrl }) {
  const desc = escapeAttr(description);
  const block = [
    `  <meta name="description" content="${desc}">`,
    `  <link rel="canonical" href="${escapeAttr(canonical)}">`,
    `  <meta property="og:url" content="${escapeAttr(ogUrl)}">`,
  ].join('\n');

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n${block}`);
  }
  return html.replace(/(<head[^>]*>)/i, `$1\n${block}`);
}

function main() {
  const files = walkHtml(ROOT).sort();
  let updated = 0;

  for (const file of files) {
    const rel = normRel(path.relative(ROOT, file));
    let html = fs.readFileSync(file, 'utf8');
    const description = buildDescription(rel, html);
    const canonical = canonicalUrl(rel);
    const ogUrl = canonical;

    const next = insertSeoTags(stripSeoTags(html), { description, canonical, ogUrl });
    if (next !== html) {
      fs.writeFileSync(file, next, 'utf8');
      updated++;
    }
  }

  console.log(`Updated SEO tags on ${updated} of ${files.length} HTML pages`);
}

main();