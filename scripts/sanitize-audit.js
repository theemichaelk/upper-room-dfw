#!/usr/bin/env node
/**
 * Code sanitation audit — DOM balance, script escaping, template nesting, CSS collisions.
 * Usage: npm run audit:sanitize
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const CSS_NAMESPACE_PREFIXES = [
  'urdfw-', 'portal-', 'church-', 'member-', 'admin-', 'hero-', 'directory-',
];

const COLLISION_PRONE = [
  '.container', '.wrapper', '.header', '.footer', '.sidebar', '.main', '.content',
  '.card', '.btn', '.nav', '.modal', '.popup', '.grid', '.row', '.col',
];

function walkFiles(dir, ext, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, ext, list);
    else if (full.endsWith(ext)) list.push(full);
  }
  return list;
}

function auditHtmlBalance(file, html) {
  const issues = [];
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)[^>]*\/?>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const full = m[0];
    const name = m[1].toLowerCase();
    if (full.startsWith('<!--') || full.startsWith('<!')) continue;
    if (full.endsWith('/>') || VOID_TAGS.has(name)) continue;
    if (full.startsWith('</')) {
      const expected = stack.pop();
      if (!expected) issues.push({ type: 'UNCLOSED_EXTRA', tag: name, line: lineOf(html, m.index) });
      else if (expected !== name) issues.push({ type: 'MISMATCH', expected, got: name, line: lineOf(html, m.index) });
    } else {
      stack.push(name);
    }
  }
  for (const tag of stack) {
    issues.push({ type: 'UNCLOSED', tag, line: 'end-of-file' });
  }
  return issues;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function auditScriptEscaping(file, content) {
  const issues = [];
  const scriptBlocks = content.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of scriptBlocks) {
    if (/<\/script>/i.test(block.slice(0, -9).replace(/<script[^>]*>/i, ''))) {
      issues.push({ type: 'SCRIPT_CLOSE_IN_STRING', file, detail: 'Literal </script> inside inline script block' });
    }
    if (/`[\s\S]*<\/[\s\S]*`/m.test(block)) {
      issues.push({ type: 'TEMPLATE_IN_SCRIPT', file, detail: 'Nested closing tag inside template literal in script' });
    }
  }
  if (/<script[\s\S]*{{[\s\S]*<\/script>/i.test(content)) {
    issues.push({ type: 'NESTED_TEMPLATE_SCRIPT', file, detail: 'Template/mustache inside script region' });
  }
  const unescaped = content.match(/<script[^>]*>[^<]*<[^/!][^>]*>/gi);
  if (unescaped?.length) {
    issues.push({ type: 'RAW_LT_IN_SCRIPT', file, count: unescaped.length });
  }
  return issues;
}

function auditTemplateNesting(file, content) {
  const issues = [];
  const patterns = [
    { re: /\{\{[^}]*\{\{/, type: 'NESTED_MUSTACHE' },
    { re: /<%[\s\S]*<%/, type: 'NESTED_ERB' },
    { re: /\$\{[^}]*\$\{/, type: 'NESTED_TEMPLATE_LITERAL_MARKERS' },
    { re: /<template[\s\S]*<template/i, type: 'NESTED_TEMPLATE_TAG' },
  ];
  for (const p of patterns) {
    if (p.re.test(content)) issues.push({ type: p.type, file });
  }
  return issues;
}

function auditCssCollisions(files) {
  const classMap = new Map();
  const issues = [];
  const classRe = /\.([a-zA-Z_][\w-]*)\s*[,{\s:#.[]>+~]/g;

  for (const file of files) {
    const css = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    const isNamespaced = CSS_NAMESPACE_PREFIXES.some((p) => rel.includes(p) || css.includes(p));
    let m;
    while ((m = classRe.exec(css))) {
      const cls = m[1];
      if (!classMap.has(cls)) classMap.set(cls, []);
      classMap.get(cls).push(rel);
    }
  }

  for (const cls of COLLISION_PRONE.map((c) => c.replace('.', ''))) {
    const sources = classMap.get(cls) || [];
    if (sources.length > 1) {
      issues.push({ type: 'CSS_GLOBAL_COLLISION', class: cls, files: sources });
    }
  }

  for (const [cls, sources] of classMap) {
    if (sources.length > 1 && !cls.startsWith('urdfw') && !cls.startsWith('fa-') && !cls.startsWith('leaflet')) {
      if (['flex', 'grid', 'hidden', 'block', 'fixed', 'relative', 'absolute'].includes(cls)) continue;
      if (sources.length >= 3 && cls.length < 12) {
        issues.push({ type: 'CSS_MULTI_DEFINE', class: cls, files: sources });
      }
    }
  }

  return issues;
}

function auditFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file);
  const issues = [];

  if (ext === '.html') {
    issues.push(...auditHtmlBalance(rel, content).map((i) => ({ ...i, file: rel })));
    issues.push(...auditScriptEscaping(rel, content));
    issues.push(...auditTemplateNesting(rel, content));
    if (content.includes('</script>') && content.match(/<script[^>]+src=/gi)?.length) {
      const inline = content.replace(/<script[^>]+src=[^>]+><\/script>/gi, '');
      if (/<\/script>\s*[^<]/i.test(inline)) { /* ok */ }
    }
  }

  if (ext === '.js') {
    issues.push(...auditScriptEscaping(rel, content));
    issues.push(...auditTemplateNesting(rel, content));
    if (/innerHTML\s*=\s*`[\s\S]*<script/i.test(content)) {
      issues.push({ type: 'INNERHTML_SCRIPT', file: rel, detail: 'Dynamic innerHTML with script tag — escape carefully' });
    }
  }

  return issues;
}

function main() {
  const htmlFiles = walkFiles(ROOT, '.html');
  const jsFiles = walkFiles(path.join(ROOT, 'js'), '.js');
  const cssFiles = walkFiles(path.join(ROOT, 'css'), '.css');

  const fileIssues = [...htmlFiles, ...jsFiles].flatMap(auditFile);
  const cssIssues = auditCssCollisions(cssFiles);

  const critical = fileIssues.filter((i) =>
    ['UNCLOSED', 'MISMATCH', 'UNCLOSED_EXTRA', 'SCRIPT_CLOSE_IN_STRING', 'NESTED_TEMPLATE_SCRIPT'].includes(i.type)
  );
  const criticalSet = new Set(critical);
  const warnings = fileIssues.filter((i) => !criticalSet.has(i));

  const report = {
    scannedAt: new Date().toISOString(),
    files: { html: htmlFiles.length, js: jsFiles.length, css: cssFiles.length },
    criticalCount: critical.length,
    warningCount: warnings.length + cssIssues.length,
    critical,
    warnings: [...warnings, ...cssIssues],
  };

  const out = path.join(ROOT, 'data', 'sanitize-audit.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

  console.log('\n  URDFW Code Sanitation Audit\n');
  console.log(`  HTML: ${htmlFiles.length}  JS: ${jsFiles.length}  CSS: ${cssFiles.length}`);
  console.log(`  Critical: ${critical.length}  Warnings: ${report.warningCount}`);
  console.log(`  Report: data/sanitize-audit.json\n`);

  if (critical.length) {
    console.log('  ── CRITICAL ──');
    for (const i of critical.slice(0, 30)) {
      console.log(`  ✗ [${i.type}] ${i.file || ''} ${i.tag || i.detail || ''}`);
    }
  }

  if (cssIssues.length) {
    console.log('\n  ── CSS COLLISIONS ──');
    for (const i of cssIssues.slice(0, 15)) {
      console.log(`  ⚠ .${i.class} in ${(i.files || []).join(', ')}`);
    }
  }

  console.log('');
  process.exit(critical.length > 0 ? 1 : 0);
}

main();