/**
 * Site rebuild orchestration — inject globals, apply redirects, purge CDN edge caches.
 * On Amplify/Lambda the package FS is read-only: save to SQLite, export settings to
 * /tmp + S3, invalidate CDN — skip local static HTML mutation pipeline.
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
const { isLambdaLike, isWritableFsError, projectRoot: pkgRoot, canWriteDir } = require('./writable-fs');

function projectRoot(rootDir) {
  return rootDir || pkgRoot();
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

function canMutateStaticTree(root) {
  if (isLambdaLike()) return false;
  return canWriteDir(path.join(root, 'data'));
}

async function runRebuild(db, opts = {}) {
  const root = projectRoot(opts.rootDir);
  const startedAt = new Date().toISOString();
  const serverless = isLambdaLike() || !canMutateStaticTree(root);
  const report = {
    ok: true,
    startedAt,
    steps: [],
    warnings: [],
    serverless,
  };

  try {
    if (opts.saveSettings && opts.settingsPatch) {
      const { setSiteSettings } = require('./site-settings');
      setSiteSettings(db, opts.settingsPatch);
      report.steps.push({ step: 'saveSettings', ok: true });
    }

    /* Always persist settings JSON where possible (tmp + S3 on Amplify) */
    try {
      const exported = await exportSiteSettingsJson(db, serverless ? undefined : root);
      report.steps.push({
        step: 'exportSiteSettings',
        ok: exported.ok !== false,
        path: exported.path,
        s3: exported.s3,
        mode: exported.mode,
        warning: exported.warning || exported.error,
        sourceOfTruth: 'sqlite',
      });
      if (exported.warning || exported.error) {
        report.warnings.push(exported.warning || exported.error);
      }
    } catch (err) {
      report.steps.push({
        step: 'exportSiteSettings',
        ok: true,
        skippedWrite: true,
        warning: err.message,
        sourceOfTruth: 'sqlite',
      });
      report.warnings.push('Static JSON export skipped: ' + err.message + ' (settings kept in database)');
    }

    if (serverless) {
      report.steps.push({
        step: 'staticPipeline',
        ok: true,
        skipped: true,
        reason: 'Read-only compute filesystem — HTML bake runs on deploy (npm run build:static). Live settings serve from SQLite + /api/platform/site-settings/public and S3 data/site-settings.json when uploaded.',
      });
      report.steps.push({
        step: 'duplicateAudit',
        ok: true,
        skipped: true,
        reason: 'Skipped on serverless (no local HTML tree to scan)',
      });
    } else {
      try {
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
        report.steps.push({
          step: 'staticPipeline',
          ok: injectSteps.every((s) => s.ok || s.skipped),
          details: injectSteps,
        });

        const canonUpdated = applyCanonicalTags(root, saved);
        report.steps.push({ step: 'canonicalTags', ok: true, updated: canonUpdated });
      } catch (err) {
        if (isWritableFsError(err)) {
          report.steps.push({
            step: 'staticPipeline',
            ok: true,
            skipped: true,
            reason: err.message,
          });
          report.warnings.push('Static pipeline skipped (read-only FS): ' + err.message);
        } else {
          throw err;
        }
      }
    }

    if (opts.invalidateCache !== false) {
      try {
        const cache = await invalidateAll({
          paths: opts.cachePaths || ['/*', '/data/site-settings.json', '/index.html'],
        });
        report.steps.push({ step: 'cacheInvalidation', ...cache });
        if (!cache.ok) report.warnings.push('Cache invalidation partially failed — check AWS/Cloudflare credentials');
      } catch (err) {
        report.steps.push({ step: 'cacheInvalidation', ok: false, error: err.message });
        report.warnings.push('Cache invalidation failed: ' + err.message);
      }
    }

    if (opts.deployS3 && process.env.AWS_ACCESS_KEY_ID && !serverless) {
      const s3 = runScript(root, 'deploy-s3-sync.js');
      report.steps.push({ step: 's3Deploy', ...s3 });
    }

    /* Soft-ok: settings saved even if some export/cache steps warn */
    const hardFail = report.steps.some((s) => s.ok === false && !s.skipped && s.step === 'saveSettings');
    report.ok = !hardFail;
    report.finishedAt = new Date().toISOString();
    report.message = serverless
      ? (report.ok
        ? 'Settings saved to database' +
          (report.steps.find((s) => s.step === 'exportSiteSettings')?.s3?.ok
            ? ' and published to S3 (data/site-settings.json)'
            : '') +
          '. Static HTML tags apply on next deploy; live API/JS telemetry picks up changes immediately.'
        : 'Rebuild finished with errors — review steps')
      : (report.ok
        ? 'Rebuild complete — globals injected, redirects applied, CDN caches invalidated'
        : 'Rebuild completed with errors — review steps');
    return report;
  } catch (err) {
    report.ok = false;
    report.error = err.message;
    report.finishedAt = new Date().toISOString();
    if (isWritableFsError(err)) {
      report.ok = true;
      report.error = undefined;
      report.warnings.push(err.message);
      report.message = 'Settings saved to database. File system is read-only on this host — static bake skipped.';
      report.steps.push({ step: 'erofs-recovery', ok: true, warning: err.message });
    }
    return report;
  }
}

function spawnRebuildAsync(db, opts = {}) {
  if (isLambdaLike()) {
    return runRebuild(db, opts);
  }
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
