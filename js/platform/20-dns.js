/**
 * DNS management UI — admin (all sites) + member (own sites)
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  function escDns(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function dnsFetch(path, opts) {
    const token = localStorage.getItem('urdfw_api_token');
    const res = await fetch('/api' + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...opts,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'DNS request failed');
    return data;
  }

  function recordStatusBadge(status) {
    const colors = { active: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800', external: 'bg-sky-100 text-sky-800', error: 'bg-red-100 text-red-800' };
    return `<span class="text-[10px] px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100'}">${status || 'pending'}</span>`;
  }

  function siteTypeBadge(type) {
    const labels = { platform: 'Platform', quantum: 'Quantum Pages', client: 'Client' };
    return `<span class="text-[10px] uppercase tracking-wide text-slate-500">${labels[type] || type}</span>`;
  }

  P.renderDnsPanel = async function (el, opts) {
    opts = opts || {};
    const isAdmin = opts.admin === true;
    el.innerHTML = '<p class="text-sm text-slate-500">Loading DNS…</p>';

    if (P.apiConfig?.mode !== 'remote' || !localStorage.getItem('urdfw_api_token')) {
      el.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">Connect to the platform API and sign in to manage DNS records via Route53.</div>`;
      return;
    }

    try {
      const [{ sites }, status] = await Promise.all([
        dnsFetch('/dns/sites'),
        dnsFetch('/dns/status').catch(() => ({ route53: { ok: false } })),
      ]);

      const selectedId = el.dataset.selectedSite || (sites[0]?.id || '');
      let records = [];
      let nameservers = [];
      if (selectedId) {
        const rec = await dnsFetch('/dns/sites/' + selectedId + '/records');
        records = rec.records || [];
        const detail = await dnsFetch('/dns/sites/' + selectedId);
        nameservers = detail.nameservers || [];
      }

      el.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-lg flex items-center gap-2"><i class="fa-solid fa-globe text-sky-600"></i> DNS Management</h3>
              <p class="text-xs text-slate-500 mt-1">${isAdmin ? 'All platform, Quantum Pages, and client sites' : 'Domains linked to your church listing'}</p>
            </div>
            <div class="text-xs ${status.route53?.ok ? 'text-emerald-600' : 'text-amber-600'}">
              <i class="fa-solid fa-circle text-[6px] mr-1"></i>
              Route53 ${status.route53?.ok ? 'connected' : 'configure ROUTE53_HOSTED_ZONE_ID'}
            </div>
          </div>

          <div class="grid lg:grid-cols-3 gap-4">
            <div class="lg:col-span-1 bg-white border rounded-2xl p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-sm">Sites</h4>
                <button type="button" id="dns-add-site" class="text-xs px-2 py-1 bg-sky-600 text-white rounded-lg">+ Add</button>
              </div>
              <div class="space-y-2 max-h-72 overflow-auto" id="dns-site-list">
                ${sites.length ? sites.map((s) => `
                  <button type="button" data-site-id="${escDns(s.id)}" class="dns-site-pick w-full text-left border rounded-xl p-3 text-sm hover:border-sky-400 ${s.id === selectedId ? 'border-sky-500 bg-sky-50' : ''}">
                    <div class="font-medium">${escDns(s.domain)}</div>
                    <div class="flex gap-2 mt-1">${siteTypeBadge(s.type)}<span class="text-[10px] text-slate-400">${s.recordCount || 0} records</span></div>
                  </button>`).join('') : '<p class="text-xs text-slate-400">No sites yet. Add a domain to get started.</p>'}
              </div>
            </div>

            <div class="lg:col-span-2 space-y-4">
              ${selectedId ? `
              <div class="bg-white border rounded-2xl p-4">
                <div class="flex flex-wrap justify-between gap-2 mb-3">
                  <h4 class="font-semibold text-sm">Records — ${escDns(sites.find((s) => s.id === selectedId)?.domain || '')}</h4>
                  ${isAdmin ? '<button type="button" id="dns-sync-route53" class="text-xs px-2 py-1 border rounded-lg">Sync from Route53</button>' : ''}
                </div>
                ${nameservers.length ? `<p class="text-[11px] text-slate-500 mb-3">Nameservers: ${nameservers.map((n) => `<code class="bg-slate-100 px-1 rounded">${escDns(n)}</code>`).join(' ')}</p>` : ''}
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead><tr class="text-left text-slate-500 border-b"><th class="py-2">Name</th><th>Type</th><th>Value</th><th>TTL</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      ${records.length ? records.map((r) => `
                        <tr class="border-b border-slate-100">
                          <td class="py-2 font-mono">${r.name}</td>
                          <td>${r.type}</td>
                          <td class="max-w-[200px] truncate font-mono" title="${(r.value || '').replace(/"/g, '&quot;')}">${r.value}</td>
                          <td>${r.ttl}</td>
                          <td>${recordStatusBadge(r.status)}</td>
                          <td><button type="button" data-del-record="${r.id}" class="text-red-600 hover:underline">Delete</button></td>
                        </tr>`).join('') : '<tr><td colspan="6" class="py-4 text-slate-400">No records — add one below.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="bg-white border rounded-2xl p-4">
                <h4 class="font-semibold text-sm mb-3">Add DNS Record</h4>
                <form id="dns-add-record" class="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
                  <input name="name" placeholder="Name (@, www, api)" class="border rounded-lg px-2 py-1.5" value="@">
                  <select name="type" class="border rounded-lg px-2 py-1.5">
                    <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>NS</option>
                  </select>
                  <input name="value" placeholder="Value" class="border rounded-lg px-2 py-1.5 sm:col-span-2" required>
                  <input name="ttl" type="number" placeholder="TTL" class="border rounded-lg px-2 py-1.5" value="300">
                  <button type="submit" class="sm:col-span-2 lg:col-span-5 px-4 py-2 bg-[#0369a1] text-white rounded-xl text-sm">Add Record (live Route53 when configured)</button>
                </form>
                <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="@" data-type="A" data-value="alias:d4lzb9pq4mfuf.cloudfront.net">→ CloudFront</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="www" data-type="CNAME" data-value="upperroomdfw.com">www → apex</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="api" data-type="CNAME" data-value="main.dbtc2f3y8pyam.amplifyapp.com">api → Amplify</button>
                </div>
              </div>` : '<div class="bg-slate-50 border rounded-2xl p-6 text-sm text-slate-500">Select or add a site to manage DNS records.</div>'}
            </div>
          </div>
        </div>`;

      el.querySelectorAll('.dns-site-pick').forEach((btn) => {
        btn.onclick = () => {
          el.dataset.selectedSite = btn.dataset.siteId;
          P.renderDnsPanel(el, opts);
        };
      });

      el.querySelector('#dns-add-site')?.addEventListener('click', async () => {
        const domain = prompt('Domain name (e.g. mychurch.org):', '');
        if (!domain) return;
        const name = prompt('Site label:', domain) || domain;
        const createZone = isAdmin && confirm('Create a new Route53 hosted zone for this domain? (Required for external domains not in upperroomdfw.com)');
        try {
          await dnsFetch('/dns/sites', { method: 'POST', body: { domain, name, autoDefaults: true, createZone } });
          P.portalToast?.('Site added: ' + domain);
          P.renderDnsPanel(el, opts);
        } catch (err) {
          P.portalToast?.(err.message);
        }
      });

      el.querySelector('#dns-add-record')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await dnsFetch('/dns/sites/' + selectedId + '/records', {
            method: 'POST',
            body: {
              name: fd.get('name'),
              type: fd.get('type'),
              value: fd.get('value'),
              ttl: parseInt(fd.get('ttl') || '300', 10),
            },
          });
          P.portalToast?.('DNS record added');
          P.renderDnsPanel(el, opts);
        } catch (err) {
          P.portalToast?.(err.message);
        }
      });

      el.querySelectorAll('.dns-preset').forEach((btn) => {
        btn.onclick = () => {
          const form = el.querySelector('#dns-add-record');
          if (!form) return;
          form.name.value = btn.dataset.name;
          form.type.value = btn.dataset.type;
          form.value.value = btn.dataset.value;
        };
      });

      el.querySelectorAll('[data-del-record]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this DNS record?')) return;
          try {
            await dnsFetch('/dns/records/' + btn.dataset.delRecord, { method: 'DELETE' });
            P.portalToast?.('Record deleted');
            P.renderDnsPanel(el, opts);
          } catch (err) {
            P.portalToast?.(err.message);
          }
        };
      });

      el.querySelector('#dns-sync-route53')?.addEventListener('click', async () => {
        try {
          const r = await dnsFetch('/dns/sites/' + selectedId + '/sync', { method: 'POST' });
          P.portalToast?.('Imported ' + (r.imported || 0) + ' records from Route53');
          P.renderDnsPanel(el, opts);
        } catch (err) {
          P.portalToast?.(err.message);
        }
      });
    } catch (err) {
      el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">${err.message}</div>`;
    }
  };

  P.renderAdminDns = function (el) {
    return P.renderDnsPanel(el, { admin: true });
  };

  P.renderMemberDns = function (el) {
    return P.renderDnsPanel(el, { admin: false });
  };
})(window);