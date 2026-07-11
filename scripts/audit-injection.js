#!/usr/bin/env node
/**
 * Zero-detection injection pipeline audit.
 * Finds silent failures: wrong paths, missing assets, duplicates, stale loaders.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'injection-config.json'), 'utf8'));
const SKIP = new Set(CONFIG.skipPages || []);

function walkHtml(dir, list = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, list);
    else if (name.endsWith('.html')) list.push(full);
  }
  return list;
}

function depthFromRoot(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  parts.pop();
  return parts.length;
}

function expectedPrefix(depth) {
  return depth > 0 ? '../'.repeat(depth) : '';
}

function extractHrefs(html, pattern) {
  const re = new RegExp(pattern, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function auditFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (SKIP.has(path.basename(filePath)) || SKIP.has(rel)) return { rel, skipped: true };

  const html = fs.readFileSync(filePath, 'utf8');
  const depth = depthFromRoot(filePath);
  const prefix = expectedPrefix(depth);
  const issues = [];
  const warnings = [];

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    issues.push('MISSING_VIEWPORT');
  }
  if (!/name=["']theme-color["']/i.test(html)) {
    warnings.push('MISSING_THEME_COLOR');
  }
  const requiredOrigins = CONFIG.preconnect || [];
  const missingOrigins = requiredOrigins.filter((o) => !html.includes(o));
  if (missingOrigins.length === requiredOrigins.length) {
    warnings.push('MISSING_PRECONNECT');
  } else if (missingOrigins.length) {
    warnings.push(`PARTIAL_PRECONNECT:${missingOrigins.map((o) => o.replace('https://', '')).join(',')}`);
  }

  for (const sheet of CONFIG.stylesheets || []) {
    const expected = prefix + sheet.href;
    const hasExpected = html.includes(`href="${expected}"`) || html.includes(`href='${expected}'`);
    const hasWrongRoot = depth > 0 && (html.includes(`href="${sheet.href}"`) || html.includes(`href='${sheet.href}'`));
    if (!hasExpected && !html.includes(sheet.href.split('/').pop())) {
      issues.push(`MISSING_STYLESHEET:${sheet.id}`);
    }
    if (hasWrongRoot) {
      issues.push(`WRONG_CSS_DEPTH:${sheet.id} (uses root path, depth=${depth})`);
    }
  }

  const loaders = extractHrefs(html, 'src=["\']([^"\']*platform/loader\\.js)["\']');
  if (loaders.length === 0) {
    issues.push('MISSING_LOADER');
  } else if (loaders.length > 1) {
    issues.push(`DUPLICATE_LOADER:${loaders.length}`);
  } else {
    const expected = prefix + 'js/platform/loader.js';
    if (loaders[0] !== expected) {
      issues.push(`WRONG_LOADER_PATH: got "${loaders[0]}", want "${expected}"`);
    }
    const loaderTag = html.match(/<script[^>]*platform\/loader\.js[^>]*>/i);
    if (loaderTag && !/defer/i.test(loaderTag[0])) {
      warnings.push('LOADER_NO_DEFER');
    }
  }

  const platformCssCount = (html.match(/platform\.css/gi) || []).length;
  const responsiveCssCount = (html.match(/responsive\.css/gi) || []).length;
  if (platformCssCount > 1) warnings.push(`DUPLICATE_PLATFORM_CSS:${platformCssCount}`);
  if (responsiveCssCount > 1) warnings.push(`DUPLICATE_RESPONSIVE_CSS:${responsiveCssCount}`);

  if (html.includes('platform/loader.js') && !html.includes('css/platform.css') && !html.includes('platform.css')) {
    issues.push('LOADER_WITHOUT_PLATFORM_CSS');
  }

  const hasMainJs = /<script[^>]+src=["'][^"']*main\.js/i.test(html);
  const loaderIdx = html.indexOf('platform/loader.js');
  const mainIdx = html.indexOf('main.js');
  if (hasMainJs && loaderIdx > -1 && mainIdx > loaderIdx) {
    warnings.push('MAIN_JS_AFTER_LOADER');
  }

  return { rel, depth, issues, warnings, skipped: false };
}

function main() {
  const files = walkHtml(ROOT).sort();
  const results = files.map(auditFile);
  const active = results.filter((r) => !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  const failed = active.filter((r) => r.issues.length > 0);
  const warned = active.filter((r) => r.warnings.length > 0);

  console.log('\n  URDFW Injection Pipeline — Zero-Detection Audit\n');
  console.log(`  HTML files scanned:  ${files.length}`);
  console.log(`  Active (injected):   ${active.length}`);
  console.log(`  Skipped (config):    ${skipped.length}`);
  console.log(`  Critical issues:     ${failed.length}`);
  console.log(`  Warnings:            ${warned.length}\n`);

  if (failed.length) {
    console.log('  ── CRITICAL ──');
    for (const r of failed.slice(0, 40)) {
      console.log(`  ✗ ${r.rel} (depth ${r.depth})`);
      r.issues.forEach((i) => console.log(`      ${i}`));
    }
    if (failed.length > 40) console.log(`  ... +${failed.length - 40} more`);
  }

  const warnCounts = {};
  for (const r of warned) {
    for (const w of r.warnings) {
      const key = w.split(':')[0];
      warnCounts[key] = (warnCounts[key] || 0) + 1;
    }
  }
  if (Object.keys(warnCounts).length) {
    console.log('\n  ── WARNING SUMMARY ──');
    for (const [k, v] of Object.entries(warnCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ⚠ ${k}: ${v} files`);
    }
  }

  const byIssue = {};
  for (const r of failed) {
    for (const i of r.issues) {
      const key = i.split(':')[0];
      byIssue[key] = (byIssue[key] || 0) + 1;
    }
  }
  if (Object.keys(byIssue).length) {
    console.log('\n  ── ISSUE SUMMARY ──');
    for (const [k, v] of Object.entries(byIssue).sort((a, b) => b[1] - a[1])) {
      console.log(`  ✗ ${k}: ${v} files`);
    }
  }

  console.log('');
  process.exit(failed.length > 0 ? 1 : 0);
}

main();