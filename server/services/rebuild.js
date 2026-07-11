/**
 * Site rebuild orchestration — inject globals, apply redirects, purge CDN edge caches.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { exportSiteSettingsJson } = require('./site-settings');
const {
  scanDuplicates, getRedirects, setRedirects, mergeRedirectsFromAudit,
  applyCanonicalTags, saveRedirectsFile, loadRedirectsFile,
} = require('./duplicate-pages');
const { invalidateAll } = require('./cache-invalidation');

function projectRoot(rootDir) {
  return rootDir || path.join(__dirname, '..', '..');
}

function runScript(root, scriptName, args = []) {
  const script = path.join(root, 'scripts', scriptName);
  if (!fs.existsSync(script)) return { ok: false, skipped: true, script: scriptName };
  try {
    const out = execSync(`node "${script}" ${args.join(' ')}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600000,
    });
    return { ok: true, script: scriptName, output: out.slice(-2000) };
  } catch (err) {
    return { ok: false, script: scriptName, error: err.stderr?.toString() || err.message };
  }
}

function runStaticPipeline(root) {
  const steps = [];
  steps.push(runScript(root, 'generate-blog.js'));
  steps.push(runScript(root, 'inject-platform.js'));
  steps.push(runScript(root, 'add-powered-by-footer.js'));
  steps.push(runScript(root, 'apply-redirects.js', ['--canonicals']));
  steps.push(runScript(root, 'generate-sitemap.js'));
  return steps;
}

async function runRebuild(db, opts = {}) {
  const root = projectRoot(opts.rootDir);
  const startedAt = new Date().toISOString();
  const report = {
    ok: true,
    startedAt,
    steps: [],
    warnings: [],
  };

  try {
    if (opts.saveSettings && opts.settingsPatch) {
      const { setSiteSettings } = require('./site-settings');
      setSiteSettings(db, opts.settingsPatch);
      report.steps.push({ step: 'saveSettings', ok: true });
    }

    const exported = exportSiteSettingsJson(db, root);
    report.steps.push({ step: 'exportSiteSettings', ok: true, ...exported });

    const audit = scanDuplicates(root);
    const mergedRules = mergeRedirectsFromAudit(audit, loadRedirectsFile(root));
    const saved = setRedirects(db, mergedRules, root);
    report.steps.push({
      step: 'duplicateAudit',
      ok: true,
      pageCount: audit.pageCount,
      duplicateSetCount: audit.duplicateSetCount,
      redirectCount: saved.redirects?.length || 0,
    });

    const injectSteps = runStaticPipeline(root);
    report.steps.push({ step: 'staticPipeline', ok: injectSteps.every((s) => s.ok || s.skipped), details: injectSteps });

    const canonUpdated = applyCanonicalTags(root, saved);
    report.steps.push({ step: 'canonicalTags', ok: true, updated: canonUpdated });

    if (opts.invalidateCache !== false) {
      const cache = await invalidateAll({
        paths: opts.cachePaths || ['/*'],
      });
      report.steps.push({ step: 'cacheInvalidation', ...cache });
      if (!cache.ok) report.warnings.push('Cache invalidation partially failed — check AWS/Cloudflare credentials');
    }

    if (opts.deployS3 && process.env.AWS_ACCESS_KEY_ID) {
      const s3 = runScript(root, 'deploy-s3-sync.js');
      report.steps.push({ step: 's3Deploy', ...s3 });
    }

    report.ok = report.steps.every((s) => s.ok !== false);
    report.finishedAt = new Date().toISOString();
    report.message = report.ok
      ? 'Rebuild complete — globals injected, redirects applied, CDN caches invalidated'
      : 'Rebuild completed with errors — review steps';
    return report;
  } catch (err) {
    report.ok = false;
    report.error = err.message;
    report.finishedAt = new Date().toISOString();
    return report;
  }
}

function spawnRebuildAsync(db, opts = {}) {
  const root = projectRoot(opts.rootDir);
  const script = path.join(root, 'scripts', 'rebuild-site.js');
  if (!fs.existsSync(script)) {
    return runRebuild(db, opts);
  }
  return new Promise((resolve) => {
    const child = spawn('node', [script, '--from-api'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        async: true,
        exitCode: code,
        output: out.slice(-4000),
      });
    });
  });
}

module.exports = {
  runRebuild,
  spawnRebuildAsync,
  runStaticPipeline,
};