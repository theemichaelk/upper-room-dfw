/**
 * Phase 5 — Control Panel expansion: SEO Hub, Site Settings, Header & Footer, Page Lifecycle.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const HUBS = [
    { id: 'seo-hub', label: 'SEO Hub', icon: 'fa-chart-line' },
    { id: 'site-settings', label: 'Site Settings', icon: 'fa-sliders' },
    { id: 'header-footer', label: 'Header & Footer', icon: 'fa-window-maximize' },
    { id: 'content-studio', label: 'Content Studio', icon: 'fa-pen-nib' },
    { id: 'page-lifecycle', label: 'Page Lifecycle', icon: 'fa-sitemap' },
  ];

  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Strip full meta tags — scrapers need content value only. */
  function normalizeVerificationToken(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const m = s.match(/content\s*=\s*["']([^"']+)["']/i);
    return m ? m[1].trim() : s;
  }

  function dnsRow(label, values, ok, error) {
    const vals = (values || []).length
      ? values.map((v) => `<code class="bg-slate-100 px-1 rounded">${esc(v)}</code>`).join(' ')
      : '<span class="text-slate-400">—</span>';
    const status = ok
      ? '<span class="text-emerald-700"><i class="fa-solid fa-circle-check"></i></span>'
      : '<span class="text-amber-700"><i class="fa-solid fa-circle-exclamation"></i></span>';
    return `<tr class="border-b border-slate-100"><td class="py-2 pr-3 font-medium">${label}</td><td class="py-2 pr-3">${vals}</td><td class="py-2">${status}${error ? `<div class="text-[10px] text-red-600">${esc(error)}</div>` : ''}</td></tr>`;
  }

  function hubNav(active) {
    return `<div class="flex flex-wrap gap-2 mb-5" role="tablist">${HUBS.map((h) => `
      <button type="button" data-control-hub="${h.id}" role="tab" aria-selected="${active === h.id ? 'true' : 'false'}"
        class="px-4 py-2 rounded-2xl text-xs font-semibold border ${active === h.id ? 'bg-[#0369a1] text-white border-[#0369a1]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}">
        <i class="fa-solid ${h.icon} mr-1"></i>${h.label}
      </button>`).join('')}</div>`;
  }

  function statusBadge(status) {
    const colors = {
      live: 'bg-emerald-100 text-emerald-800',
      draft: 'bg-amber-100 text-amber-800',
      scheduled: 'bg-sky-100 text-sky-800',
      archived: 'bg-slate-200 text-slate-600',
      redirect: 'bg-violet-100 text-violet-800',
    };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status] || 'bg-slate-100'}">${status || 'live'}</span>`;
  }

  P.renderControlPanelShell = function (el, activeHub) {
    el.innerHTML = `${hubNav(activeHub)}<div id="control-panel-hub-panel"></div>`;
    el.querySelectorAll('[data-control-hub]').forEach((btn) => {
      btn.addEventListener('click', () => P.renderControlPanelHub(el, btn.dataset.controlHub));
    });
    return el.querySelector('#control-panel-hub-panel');
  };

  P.renderControlPanelHub = async function (rootEl, hubId) {
    const panel = rootEl.querySelector('#control-panel-hub-panel') || P.renderControlPanelShell(rootEl, hubId);
    rootEl.querySelectorAll('[data-control-hub]').forEach((btn) => {
      const on = btn.dataset.controlHub === hubId;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.className = `px-4 py-2 rounded-2xl text-xs font-semibold border ${on ? 'bg-[#0369a1] text-white border-[#0369a1]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`;
    });

    if (hubId === 'seo-hub') return P.renderSeoHubPanel(panel);
    if (hubId === 'site-settings') return P.renderSiteSettingsPanel(panel);
    if (hubId === 'header-footer') return P.renderHeaderFooterPanel(panel);
    if (hubId === 'content-studio') return P.renderContentStudioPanel?.(panel);
    if (hubId === 'page-lifecycle') return P.renderPageLifecyclePanel(panel);
  };

  P.renderSeoHubPanel = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading SEO Hub…</div>';
    let stats404 = { total: 0, topPaths: [] };
    let edgeDns = null;
    const token = localStorage.getItem('urdfw_api_token');
    try {
      const [statsRes, dnsRes] = await Promise.all([
        fetch('/api/platform/404-stats', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/platform/edge-dns', { headers: { Authorization: 'Bearer ' + token } }),
      ]);
      if (statsRes.ok) stats404 = await statsRes.json();
      if (dnsRes.ok) edgeDns = await dnsRes.json();
    } catch { /* ignore */ }

    const prop = edgeDns?.propagation || {};
    const propColor = prop.status === 'healthy' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : prop.status === 'partial' ? 'text-amber-800 bg-amber-50 border-amber-200'
        : 'text-red-800 bg-red-50 border-red-200';

    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="bg-white border rounded-3xl p-5 text-sm">
          <h3 class="font-semibold mb-2"><i class="fa-solid fa-life-ring text-sky-600 mr-1"></i> 404 Rescue Analytics</h3>
          <p class="text-xs text-slate-500 mb-3">Recent rescue hits logged from production 404 page.</p>
          <div class="text-2xl font-bold text-slate-800">${stats404.total || 0}</div>
          <div class="text-xs text-slate-500">logged events (last 100)</div>
          ${(stats404.topPaths || []).length ? `<ul class="mt-3 text-xs space-y-1">${stats404.topPaths.slice(0, 8).map(([p, n]) => `<li class="font-mono truncate"><span class="text-slate-400">${n}×</span> ${esc(p)}</li>`).join('')}</ul>` : '<p class="text-xs text-slate-400 mt-3">No hits yet.</p>'}
        </div>
        <div class="bg-white border rounded-3xl p-5 text-sm">
          <h3 class="font-semibold mb-2"><i class="fa-solid fa-code-branch text-amber-600 mr-1"></i> Duplicates &amp; Redirects</h3>
          <p class="text-xs text-slate-500 mb-3">Scan duplicate HTML, merge canonical redirects, rebuild to propagate.</p>
          <button type="button" id="cp-duplicates-btn" class="px-3 py-1.5 border rounded-xl text-xs">Run Duplicate Audit</button>
          <div id="cp-duplicates-status" class="text-xs text-slate-500 mt-2"></div>
        </div>
      </div>

      <!-- Full DNS editor: add / edit / delete NS, A, TXT, CNAME (+ more) -->
      <div class="mt-4 bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-3xl p-5" id="seo-dns-manager-wrap">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 class="font-semibold text-sky-950"><i class="fa-solid fa-pen-to-square text-sky-600 mr-1"></i> DNS Manager</h3>
            <p class="text-xs text-slate-500 mt-0.5">Edit, add, and delete <strong>nameservers (NS)</strong>, <strong>A</strong>, <strong>TXT</strong>, and <strong>CNAME</strong> records. Synced to Route53 when configured.</p>
          </div>
          <button type="button" id="seo-open-dns-tab" class="text-xs px-3 py-1.5 border border-sky-200 rounded-xl bg-white text-sky-800">Open full DNS tab →</button>
        </div>
        <div id="seo-dns-manager" class="min-h-[12rem]"></div>
      </div>

      <div class="mt-4 bg-white border rounded-3xl p-5 text-sm" id="edge-dns-monitor">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 class="font-semibold"><i class="fa-solid fa-shield-halved text-sky-600 mr-1"></i> Edge DNS Integrity Monitor</h3>
            <p class="text-xs text-slate-500 mt-1">Public resolver view — what the internet currently resolves for <code>${esc(edgeDns?.domain || 'upperroomdfw.com')}</code> (read-only check after you edit above)</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs px-3 py-1 rounded-full border ${propColor}">${prop.status || 'unknown'} · ${prop.score || '—'}</span>
            <button type="button" id="cp-edge-dns-refresh" class="text-xs px-3 py-1 border rounded-xl">Refresh probe</button>
          </div>
        </div>
        <table class="w-full text-xs">
          <thead><tr class="text-slate-500 border-b text-left"><th class="py-2">Record</th><th>Resolved at edge</th><th>Status</th></tr></thead>
          <tbody>
            ${dnsRow('Nameservers (NS)', edgeDns?.nameservers?.resolved, edgeDns?.nameservers?.propagated, edgeDns?.nameservers?.error)}
            ${dnsRow('A @ apex', edgeDns?.aRecords?.apex?.resolved, edgeDns?.aRecords?.apex?.ok, edgeDns?.aRecords?.apex?.error)}
            ${dnsRow('A/CNAME www', edgeDns?.cnames?.www?.resolved?.length ? edgeDns.cnames.www.resolved : edgeDns?.aRecords?.www?.resolved, edgeDns?.cnames?.www?.pointsToCdn, edgeDns?.cnames?.www?.error || edgeDns?.aRecords?.www?.error)}
            ${dnsRow('CNAME api', edgeDns?.cnames?.api?.resolved, edgeDns?.cnames?.api?.pointsToAmplify, edgeDns?.cnames?.api?.error)}
          </tbody>
        </table>
        <div class="mt-3 text-[11px] text-slate-500 font-mono">
          Expected CDN: ${esc(edgeDns?.expected?.cloudfront || '—')} · Amplify: ${esc(edgeDns?.expected?.amplify || '—')}
          ${edgeDns?.expected?.route53Nameservers?.length ? ` · Route53 NS: ${edgeDns.expected.route53Nameservers.join(', ')}` : ''}
        </div>
      </div>`;

    /* Embed interactive DNS manager (add / edit / delete) */
    const dnsHost = el.querySelector('#seo-dns-manager');
    if (dnsHost) {
      if (typeof P.renderSeoDnsManager === 'function') {
        P.renderSeoDnsManager(dnsHost);
      } else if (typeof P.renderDnsPanel === 'function') {
        P.renderDnsPanel(dnsHost, { admin: true, compact: true });
      } else {
        dnsHost.innerHTML = `<div class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          DNS module not loaded. Hard-refresh the page, or use the <button type="button" class="underline" data-jump-dns>DNS</button> sidebar tab.
        </div>`;
        dnsHost.querySelector('[data-jump-dns]')?.addEventListener('click', () => P.showAdminTab?.('dns'));
      }
    }

    el.querySelector('#seo-open-dns-tab')?.addEventListener('click', () => P.showAdminTab?.('dns'));

    el.querySelector('#cp-edge-dns-refresh')?.addEventListener('click', async () => {
      const mon = el.querySelector('#edge-dns-monitor');
      if (!mon) return;
      mon.querySelector('tbody')?.insertAdjacentHTML('beforeend', '<tr id="edge-probe-busy"><td colspan="3" class="py-2 text-slate-500">Probing…</td></tr>');
      try {
        const dnsRes = await fetch('/api/platform/edge-dns', { headers: { Authorization: 'Bearer ' + token } });
        if (dnsRes.ok) {
          /* Re-render full hub so monitor + manager stay in sync */
          return P.renderSeoHubPanel(el);
        }
      } catch { /* ignore */ }
      mon.querySelector('#edge-probe-busy')?.remove();
    });

    el.querySelector('#cp-duplicates-btn')?.addEventListener('click', async () => {
      const status = el.querySelector('#cp-duplicates-status');
      status.textContent = 'Scanning…';
      try {
        const auditRes = await fetch('/api/platform/duplicates', { headers: { Authorization: 'Bearer ' + token } });
        const auditData = await auditRes.json();
        const applyRes = await fetch('/api/platform/duplicates/apply', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
        const applyData = await applyRes.json();
        status.innerHTML = `${auditData.audit?.duplicateSetCount || 0} duplicate sets — ${applyData.redirectCount || 0} redirects saved`;
      } catch (err) {
        status.textContent = err.message;
      }
    });
  };

  P.renderSiteSettingsPanel = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading site settings…</div>';
    /* Prefer live API so customBodyHtml / head fields match production DB */
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        if (P.api?.siteSettings?.get) {
          const res = await P.api.siteSettings.get();
          if (res?.settings) P.set('site_settings', res.settings);
        } else {
          const token = localStorage.getItem('urdfw_api_token');
          const r = await fetch('/api/platform/site-settings', { headers: { Authorization: 'Bearer ' + token } });
          if (r.ok) {
            const j = await r.json();
            if (j.settings) P.set('site_settings', j.settings);
          }
        }
      } catch { /* use cached */ }
    }
    const siteSettings = P.get('site_settings', {});
    const sc = siteSettings.searchConsole || {};
    const nl = siteSettings.newsletterPopup || {};
    el.innerHTML = `
      <form id="cp-site-settings-form" class="space-y-4 text-sm">
        <section class="bg-violet-50 border border-violet-200 rounded-3xl p-5" aria-labelledby="omnichannel-console-heading">
          <h3 id="omnichannel-console-heading" class="font-semibold text-violet-900 mb-1"><i class="fa-solid fa-tower-broadcast mr-1"></i> Omnichannel Console Center</h3>
          <p class="text-xs text-violet-800 mb-4">Paste verification strings from Google, Bing, or Yahoo — full <code>&lt;meta&gt;</code> tags or content values are accepted. Saved tokens are baked into static HTML at rebuild so scrapers detect them without JavaScript.</p>
          <div class="grid md:grid-cols-1 gap-4 text-xs">
            <label class="block">
              <span class="font-semibold text-slate-800">Google Search Console</span>
              <span class="block text-[10px] text-slate-500 mb-1">meta name="google-site-verification"</span>
              <textarea name="scGoogle" rows="2" placeholder="Paste verification content or full meta tag…" class="w-full border rounded-xl px-3 py-2 mt-0.5 font-mono text-[11px] leading-relaxed">${esc(sc.google)}</textarea>
            </label>
            <label class="block">
              <span class="font-semibold text-slate-800">Bing Webmaster Tools</span>
              <span class="block text-[10px] text-slate-500 mb-1">meta name="msvalidate.01"</span>
              <textarea name="scBing" rows="2" placeholder="Paste Bing msvalidate token…" class="w-full border rounded-xl px-3 py-2 mt-0.5 font-mono text-[11px] leading-relaxed">${esc(sc.bing)}</textarea>
            </label>
            <label class="block">
              <span class="font-semibold text-slate-800">Yahoo Site Explorer</span>
              <span class="block text-[10px] text-slate-500 mb-1">meta name="y_key"</span>
              <textarea name="scYahoo" rows="2" placeholder="Paste Yahoo y_key token…" class="w-full border rounded-xl px-3 py-2 mt-0.5 font-mono text-[11px] leading-relaxed">${esc(sc.yahoo)}</textarea>
            </label>
          </div>
        </section>

        <section class="bg-sky-50 border border-sky-200 rounded-3xl p-5">
          <h3 class="font-semibold text-sky-900 mb-2"><i class="fa-solid fa-satellite-dish mr-1"></i> Telemetry &amp; Head Injection</h3>
          <div class="grid md:grid-cols-2 gap-4 text-xs">
            <label class="block">GTM Container ID<input name="gtmId" value="${esc(siteSettings.gtmId)}" placeholder="GTM-XXXX" class="w-full border rounded px-2 py-1.5 mt-1 font-mono"></label>
            <label class="block">GA4 Measurement ID<input name="ga4Id" value="${esc(siteSettings.ga4Id)}" placeholder="G-XXXX" class="w-full border rounded px-2 py-1.5 mt-1 font-mono"></label>
            <label class="block md:col-span-2">Custom Head HTML<span class="block text-[10px] text-slate-500 font-normal mb-0.5">Injected inside <code>&lt;head&gt;</code> (meta tags, scripts, etc.)</span><textarea name="customHeadHtml" rows="3" class="w-full border rounded px-2 py-1.5 mt-1 font-mono text-[11px]" placeholder="&lt;meta …&gt; or &lt;script …&gt;">${esc(siteSettings.customHeadHtml)}</textarea></label>
            <label class="flex items-center gap-2"><input type="checkbox" name="nlEnabled" ${nl.enabled !== false ? 'checked' : ''}> Newsletter popup enabled</label>
          </div>
        </section>

        <section class="bg-amber-50 border border-amber-200 rounded-3xl p-5">
          <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <h3 class="font-semibold text-amber-950"><i class="fa-solid fa-code mr-1 text-amber-700"></i> Custom Body HTML</h3>
              <p class="text-xs text-amber-900/80 mt-1">HTML inserted immediately after the opening <code class="bg-white/70 px-1 rounded">&lt;body&gt;</code> tag on public pages. Use for noscript tags, pixels, chat widgets, or markup that must run at the top of the body.</p>
            </div>
            <div class="flex flex-wrap gap-1.5 text-[11px]">
              <button type="button" id="cp-body-clear" class="px-2.5 py-1 border border-amber-300 bg-white rounded-lg text-amber-900">Clear / Delete</button>
              <button type="button" id="cp-body-snippet-gtm" class="px-2.5 py-1 border border-amber-300 bg-white rounded-lg">+ GTM noscript</button>
              <button type="button" id="cp-body-snippet-comment" class="px-2.5 py-1 border border-amber-300 bg-white rounded-lg">+ Comment</button>
            </div>
          </div>
          <label class="block text-xs">
            <span class="font-semibold text-slate-800">After <code>&lt;body&gt;</code></span>
            <textarea id="cp-custom-body-html" name="customBodyHtml" rows="8" class="w-full border rounded-xl px-3 py-2 mt-1 font-mono text-[11px] leading-relaxed bg-white" placeholder="<!-- e.g. pixel, chat, or markup -->&#10;&lt;div id=&quot;my-widget&quot;&gt;&lt;/div&gt;">${esc(siteSettings.customBodyHtml)}</textarea>
          </label>
          <p class="text-[10px] text-slate-500 mt-2">Saved to the database immediately with <strong>Save Settings</strong>. Use <strong>Save &amp; Rebuild</strong> to bake into static HTML on deploy-capable hosts (on Amplify, live pages also pick this up via API/runtime when applicable).</p>
        </section>

        <div class="flex flex-wrap gap-2">
          <button type="button" id="cp-save-btn" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl font-medium">
            <i class="fa-solid fa-floppy-disk mr-1"></i> Save Settings
          </button>
          <button type="button" id="cp-rebuild-btn" class="px-4 py-2 bg-emerald-700 text-white rounded-xl font-medium">
            <i class="fa-solid fa-hammer mr-1"></i> Save &amp; Rebuild
          </button>
          <button type="button" id="cp-verify-btn" class="px-4 py-2 border rounded-xl font-medium">
            <i class="fa-solid fa-magnifying-glass mr-1"></i> Verify Live HTML
          </button>
        </div>
        <div id="cp-settings-status" class="text-xs text-slate-500 min-h-[1.25rem]" role="status" aria-live="polite"></div>
        <div id="cp-verify-detail" class="hidden text-[10px] font-mono bg-slate-50 border rounded-2xl p-3 overflow-auto max-h-48"></div>
      </form>`;

    const form = el.querySelector('#cp-site-settings-form');
    const statusEl = () => el.querySelector('#cp-settings-status');
    const setStatus = (html, kind) => {
      const s = statusEl();
      if (!s) return;
      if (!html) { s.textContent = ''; return; }
      if (kind === 'ok') s.innerHTML = `<span class="text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>${html}</span>`;
      else if (kind === 'err') s.innerHTML = `<span class="text-red-700"><i class="fa-solid fa-circle-xmark mr-1"></i>${html}</span>`;
      else if (kind === 'warn') s.innerHTML = `<span class="text-amber-800"><i class="fa-solid fa-circle-exclamation mr-1"></i>${html}</span>`;
      else s.textContent = html;
    };
    const authHeaders = () => {
      const token = localStorage.getItem('urdfw_api_token') || sessionStorage.getItem('urdfw_api_token') || '';
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      };
    };
    const requireToken = () => {
      const token = localStorage.getItem('urdfw_api_token') || sessionStorage.getItem('urdfw_api_token');
      if (!token) throw new Error('Not signed in — refresh and log in as admin again.');
      return token;
    };

    function collectSiteSettingsPatch(formEl) {
      if (!formEl) throw new Error('Settings form not found');
      const val = (name) => {
        const node = formEl.elements?.namedItem?.(name) || formEl.querySelector(`[name="${name}"]`);
        if (!node) return '';
        if (node.type === 'checkbox') return node.checked;
        return node.value != null ? String(node.value) : '';
      };
      return {
        gtmId: val('gtmId').trim(),
        ga4Id: val('ga4Id').trim(),
        customHeadHtml: val('customHeadHtml'),
        customBodyHtml: val('customBodyHtml'),
        searchConsole: {
          google: normalizeVerificationToken(val('scGoogle')),
          bing: normalizeVerificationToken(val('scBing')),
          yahoo: normalizeVerificationToken(val('scYahoo')),
        },
        newsletterPopup: {
          ...(siteSettings.newsletterPopup || {}),
          enabled: !!val('nlEnabled'),
        },
      };
    }

    const bodyTa = el.querySelector('#cp-custom-body-html');
    el.querySelector('#cp-body-clear')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!bodyTa) return;
      if (bodyTa.value.trim() && !confirm('Clear all custom body HTML? Save Settings afterward to persist.')) return;
      bodyTa.value = '';
      bodyTa.focus();
      P.portalToast?.('Body HTML cleared — click Save Settings to store');
    });
    el.querySelector('#cp-body-snippet-gtm')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!bodyTa) return;
      const gtm = (form?.querySelector('[name="gtmId"]')?.value || 'GTM-XXXX').trim() || 'GTM-XXXX';
      const snip = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
      bodyTa.value = (bodyTa.value ? bodyTa.value.replace(/\s*$/, '') + '\n\n' : '') + snip + '\n';
      bodyTa.focus();
    });
    el.querySelector('#cp-body-snippet-comment')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!bodyTa) return;
      bodyTa.value = (bodyTa.value ? bodyTa.value.replace(/\s*$/, '') + '\n' : '') + '<!-- custom body inject -->\n';
      bodyTa.focus();
    });

    async function saveSiteSettingsDirect(opts) {
      opts = opts || {};
      requireToken();
      const patch = collectSiteSettingsPatch(form);
      setStatus(opts.quiet ? '' : 'Saving…');

      /* Prefer direct fetch so we never depend on api-bridge quirks */
      const res = await fetch('/api/platform/site-settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.message || ('Save failed (HTTP ' + res.status + ')'));
      }
      if (data.settings) P.set('site_settings', data.settings);
      else P.set('site_settings', { ...P.get('site_settings', {}), ...patch });
      try { P.applySiteTelemetry?.(data.settings || patch); } catch (e) {
        console.warn('[URDFW] applySiteTelemetry after save', e);
      }
      const exportWarn = data.exported && data.exported.ok === false
        ? ' (static export note: ' + esc(data.exported.error || 'skipped') + ')'
        : '';
      const msg = (data.message || 'Site settings saved') + exportWarn;
      if (!opts.quiet) {
        setStatus(esc(msg), 'ok');
        P.portalToast?.(msg);
      }
      return data;
    }

    async function withBusy(btn, fn) {
      const buttons = [el.querySelector('#cp-save-btn'), el.querySelector('#cp-rebuild-btn'), el.querySelector('#cp-verify-btn')];
      buttons.forEach((b) => { if (b) b.disabled = true; });
      const prev = btn ? btn.innerHTML : '';
      if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Working…';
      try {
        return await fn();
      } finally {
        buttons.forEach((b) => { if (b) b.disabled = false; });
        if (btn && prev) btn.innerHTML = prev;
      }
    }

    /* Prevent native form submit (Enter key) from navigating away */
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      el.querySelector('#cp-save-btn')?.click();
    });

    el.querySelector('#cp-save-btn')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget;
      try {
        await withBusy(btn, () => saveSiteSettingsDirect({ quiet: false }));
      } catch (err) {
        console.error('[URDFW] Save Settings failed', err);
        setStatus(esc(err.message || 'Save failed'), 'err');
        P.portalToast?.(err.message || 'Save failed');
      }
    });

    el.querySelector('#cp-rebuild-btn')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget;
      try {
        await withBusy(btn, async () => {
          requireToken();
          setStatus('Saving settings & rebuilding…');
          let patch;
          try {
            await saveSiteSettingsDirect({ quiet: true });
            patch = collectSiteSettingsPatch(form);
          } catch (e) {
            console.warn('[URDFW] pre-rebuild save', e);
            patch = collectSiteSettingsPatch(form);
          }
          const res = await fetch('/api/platform/rebuild', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ invalidateCache: true, settings: patch }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok && data.ok === false) throw new Error(data.error || ('Rebuild failed (HTTP ' + res.status + ')'));

          const warn = (data.warnings || []).length
            ? ' · notes: ' + (data.warnings || []).slice(0, 2).join('; ')
            : '';
          const cacheStep = (data.steps || []).find((s) => s.step === 'cacheInvalidation');
          const cacheNote = cacheStep && cacheStep.ok === false
            ? ' Cache purge incomplete — settings are still saved.'
            : '';
          const softOk = data.ok !== false
            || (data.serverless && (data.steps || []).some((s) => s.step === 'saveSettings' && s.ok))
            || (data.steps || []).some((s) => s.step === 'exportSiteSettings' && s.ok);

          const msg = (data.message || (softOk ? 'Settings saved' : 'Rebuild failed')) + warn + cacheNote;
          setStatus(esc(msg), softOk ? 'ok' : 'err');
          P.portalToast?.(data.message || (softOk ? 'Settings saved' : 'Rebuild failed'));
          return data;
        });
      } catch (err) {
        console.error('[URDFW] Rebuild failed', err);
        setStatus(esc(err.message || 'Rebuild failed'), 'err');
        P.portalToast?.(err.message || 'Rebuild failed');
      }
    });

    el.querySelector('#cp-verify-btn')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget;
      const detail = el.querySelector('#cp-verify-detail');
      try {
        await withBusy(btn, async () => {
          requireToken();
          setStatus('Probing live HTML (apex + /index.html)…');
          const res = await fetch('/api/platform/telemetry/verify', {
            method: 'POST',
            headers: authHeaders(),
            body: '{}',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok && data.ok === false && !data.reason) {
            throw new Error(data.error || ('Verify failed (HTTP ' + res.status + ')'));
          }
          if (data.ok) {
            setStatus(esc(data.reason || 'Verified — configured tags found in live HTML'), 'ok');
          } else {
            setStatus(esc(data.reason || data.error || 'Not fully verified on static HTML (save & deploy bake may still be needed)'), 'warn');
          }
          if (detail && (data.checks || data.probes || data.configured)) {
            detail.classList.remove('hidden');
            detail.textContent = JSON.stringify({
              ok: data.ok,
              reason: data.reason,
              checks: data.checks,
              configured: data.configured,
              probes: data.probes,
            }, null, 2);
          }
          return data;
        });
      } catch (err) {
        console.error('[URDFW] Verify failed', err);
        setStatus(esc(err.message || 'Verify failed'), 'err');
        P.portalToast?.(err.message || 'Verify failed');
      }
    });
  };

  P.renderHeaderFooterPanel = function (el) {
    const siteSettings = P.get('site_settings', {});
    el.innerHTML = `
      <div class="bg-white border rounded-3xl p-5 text-sm space-y-4">
        <h3 class="font-semibold"><i class="fa-solid fa-window-maximize text-sky-600 mr-1"></i> Header &amp; Footer Shell</h3>
        <p class="text-xs text-slate-500">Runtime widgets and global shell inheritance via <code>data-urdfw-shell="global"</code>.</p>
        <form id="cp-header-footer-form" class="grid gap-4 text-xs">
          <label class="block">Header Banner HTML<textarea name="headerBannerHtml" rows="2" class="w-full border rounded px-2 py-1.5 mt-1 font-mono text-[11px]">${esc(siteSettings.headerBannerHtml)}</textarea></label>
          <label class="block">Sidebar Widget HTML<textarea name="sidebarWidgetHtml" rows="2" class="w-full border rounded px-2 py-1.5 mt-1 font-mono text-[11px]">${esc(siteSettings.sidebarWidgetHtml)}</textarea></label>
          <label class="block">Footer Script URL<input name="footerScriptSrc" value="${esc((siteSettings.footerScripts || [])[0]?.src)}" placeholder="https://..." class="w-full border rounded px-2 py-1.5 mt-1 font-mono"></label>
          <div class="p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-600">
            <div class="font-semibold text-slate-800 mb-1">Shell inheritance map</div>
            <div><code>global</code> — full nav, footer, saved button (index, directory, 404)</div>
            <div><code>minimal</code> — embed, go redirect stubs</div>
            <div><code>embed</code> — iframe-safe chrome</div>
            <div><code>none</code> — bare page</div>
          </div>
          <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl w-fit">Save Header &amp; Footer</button>
        </form>
      </div>`;

    el.querySelector('#cp-header-footer-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const footerSrc = (fd.get('footerScriptSrc') || '').trim();
      const patch = {
        headerBannerHtml: fd.get('headerBannerHtml'),
        sidebarWidgetHtml: fd.get('sidebarWidgetHtml'),
        footerScripts: footerSrc ? [{ id: 'custom-footer', src: footerSrc }] : [],
      };
      if (P.api?.siteSettings?.save) {
        const res = await P.api.siteSettings.save(patch);
        P.set('site_settings', res.settings || patch);
        P.initSiteWidgets?.(res.settings || patch);
        P.portalToast?.('Header & Footer saved');
      } else {
        P.set('site_settings', { ...siteSettings, ...patch });
        P.portalToast?.('Saved locally');
      }
    });
  };

  P.renderPageLifecyclePanel = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading page inventory…</div>';
    const token = localStorage.getItem('urdfw_api_token');
    let data = { pages: [], count: 0, totalInventory: 0 };

    const load = async (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      const res = await fetch('/api/platform/pages' + (qs ? '?' + qs : ''), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) return res.json();
      return data;
    };

    try {
      data = await load();
    } catch { /* local fallback */ }

    const renderTable = (payload, filters) => {
      el.innerHTML = `
        <div class="bg-white border rounded-3xl p-5 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 class="font-semibold"><i class="fa-solid fa-sitemap text-sky-600 mr-1"></i> Page Lifecycle Manager</h3>
              <p class="text-xs text-slate-500">${payload.count || 0} shown · ${payload.totalInventory || 0} total URLs</p>
            </div>
            <button type="button" id="cp-page-add-btn" class="px-3 py-1.5 bg-[#0369a1] text-white rounded-xl text-xs font-semibold"><i class="fa-solid fa-plus mr-1"></i> Add URL</button>
          </div>
          <form id="cp-page-filter-form" class="flex flex-wrap gap-2 mb-4 text-xs">
            <input name="q" value="${esc(filters?.q)}" placeholder="Filter URLs, titles…" class="border rounded-xl px-3 py-1.5 flex-1 min-w-[12rem]">
            <select name="status" class="border rounded-xl px-2 py-1.5">
              <option value="">All statuses</option>
              ${['live', 'draft', 'scheduled', 'archived', 'redirect'].map((s) => `<option value="${s}" ${filters?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <select name="type" class="border rounded-xl px-2 py-1.5">
              <option value="">All types</option>
              ${['static', 'church', 'portal', 'system', 'template'].map((t) => `<option value="${t}" ${filters?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <button type="submit" class="px-3 py-1.5 border rounded-xl">Filter</button>
          </form>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="text-slate-500 border-b">
                <tr><th class="py-2 pr-2">URL</th><th class="py-2 pr-2">Title</th><th class="py-2 pr-2">Status</th><th class="py-2 pr-2">Type</th><th class="py-2">Actions</th></tr>
              </thead>
              <tbody>
                ${(payload.pages || []).slice(0, 80).map((p) => `<tr class="border-b border-slate-100 hover:bg-slate-50" data-page-row="${esc(p.id)}">
                  <td class="py-2 pr-2 font-mono max-w-[14rem] truncate" title="${esc(p.urlPath)}">${esc(p.id)}</td>
                  <td class="py-2 pr-2 max-w-[12rem] truncate">${esc((p.title || '').replace(/<[^>]+>/g, ''))}</td>
                  <td class="py-2 pr-2">${statusBadge(p.status)}</td>
                  <td class="py-2 pr-2">${esc(p.type)}</td>
                  <td class="py-2 whitespace-nowrap">
                    <a href="${esc(p.productionUrl)}" target="_blank" rel="noopener" class="text-sky-700 mr-2">View</a>
                    <button type="button" data-page-edit="${esc(p.id)}" class="text-slate-700 mr-2">Edit</button>
                    <button type="button" data-page-delete="${esc(p.id)}" class="text-red-700">Delete</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${(payload.pages || []).length > 80 ? '<p class="text-xs text-slate-400 mt-2">Showing first 80 — refine filters to narrow results.</p>' : ''}
        </div>
        <div id="cp-page-editor" class="hidden mt-4 bg-slate-50 border rounded-3xl p-5 text-xs"></div>`;

      el.querySelector('#cp-page-filter-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const filters = { q: fd.get('q'), status: fd.get('status'), type: fd.get('type') };
        const next = await load(filters);
        renderTable(next, filters);
      });

      el.querySelector('#cp-page-add-btn')?.addEventListener('click', () => {
        P.openPageEditor(el, null, async () => {
          const next = await load();
          renderTable(next, {});
        });
      });

      el.querySelectorAll('[data-page-edit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.pageEdit;
          const res = await fetch('/api/platform/pages/' + encodeURIComponent(id), {
            headers: { Authorization: 'Bearer ' + token },
          });
          const pageData = res.ok ? await res.json() : { page: (payload.pages || []).find((p) => p.id === id) };
          P.openPageEditor(el, pageData.page, async () => {
            const next = await load();
            renderTable(next, {});
          });
        });
      });

      el.querySelectorAll('[data-page-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Archive this URL? (soft delete — sets status to archived)')) return;
          await fetch('/api/platform/pages/' + encodeURIComponent(btn.dataset.pageDelete), {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token },
          });
          const next = await load();
          renderTable(next, {});
          P.portalToast?.('Page archived');
        });
      });
    };

    renderTable(data, {});
  };

  P.openPageEditor = function (rootEl, page, onSave) {
    const editor = rootEl.querySelector('#cp-page-editor');
    if (!editor) return;
    const isNew = !page;
    editor.classList.remove('hidden');
    editor.innerHTML = `
      <h4 class="font-semibold text-sm mb-3">${isNew ? 'Add URL' : 'Edit URL'}</h4>
      <form id="cp-page-form" class="grid md:grid-cols-2 gap-3">
        <label class="block md:col-span-2">File path (e.g. landing/summer.html)<input name="id" value="${esc(page?.id)}" ${isNew ? '' : 'readonly'} class="w-full border rounded px-2 py-1.5 mt-1 font-mono" required></label>
        <label class="block md:col-span-2">Title<input name="title" value="${esc(page?.title)}" class="w-full border rounded px-2 py-1.5 mt-1"></label>
        <label class="block md:col-span-2">Description<textarea name="description" rows="2" class="w-full border rounded px-2 py-1.5 mt-1">${esc(page?.description)}</textarea></label>
        <label class="block">Status<select name="status" class="w-full border rounded px-2 py-1.5 mt-1">
          ${['live', 'draft', 'scheduled', 'archived', 'redirect'].map((s) => `<option value="${s}" ${page?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></label>
        <label class="block">Type<select name="type" class="w-full border rounded px-2 py-1.5 mt-1">
          ${['static', 'church', 'portal', 'system', 'template'].map((t) => `<option value="${t}" ${page?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
        <label class="block">Shell<select name="shell" class="w-full border rounded px-2 py-1.5 mt-1">
          ${['global', 'minimal', 'embed', 'none'].map((s) => `<option value="${s}" ${page?.shell === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></label>
        <label class="flex items-center gap-2 mt-5"><input type="checkbox" name="noindex" ${page?.noindex ? 'checked' : ''}> noindex</label>
        <label class="block md:col-span-2">Redirect to (if status=redirect)<input name="redirectTo" value="${esc(page?.redirectTo)}" placeholder="/directory.html" class="w-full border rounded px-2 py-1.5 mt-1 font-mono"></label>
        <div class="md:col-span-2 flex gap-2">
          <button type="submit" class="px-4 py-2 bg-[#0369a1] text-white rounded-xl">Save</button>
          <button type="button" id="cp-page-cancel" class="px-4 py-2 border rounded-xl">Cancel</button>
        </div>
      </form>`;

    editor.querySelector('#cp-page-cancel')?.addEventListener('click', () => editor.classList.add('hidden'));

    editor.querySelector('#cp-page-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        id: fd.get('id'),
        title: fd.get('title'),
        description: fd.get('description'),
        status: fd.get('status'),
        type: fd.get('type'),
        shell: fd.get('shell'),
        noindex: fd.get('noindex') === 'on',
        redirectTo: fd.get('redirectTo') || null,
        seo: { title: fd.get('title'), description: fd.get('description'), noindex: fd.get('noindex') === 'on' },
      };
      const token = localStorage.getItem('urdfw_api_token');
      const url = isNew
        ? '/api/platform/pages'
        : '/api/platform/pages/' + encodeURIComponent(page.id);
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.ok) {
        editor.classList.add('hidden');
        P.portalToast?.('Page saved');
        if (onSave) onSave();
      } else {
        alert(result.error || 'Save failed');
      }
    });
  };

  P.renderAdminSeoControlPanel = async function (el) {
    P.renderControlPanelShell(el, 'seo-hub');
    await P.renderControlPanelHub(el, 'seo-hub');
  };
})(window);