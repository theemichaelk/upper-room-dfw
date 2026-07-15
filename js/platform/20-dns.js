/**
 * DNS management UI — admin (all sites) + member (own sites)
 * Supports add / edit / delete for A, AAAA, CNAME, TXT, NS, MX (+ presets).
 * Used by DNS tab and SEO Hub.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'NS', 'MX', 'SRV', 'CAA'];

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
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'DNS request failed');
    return data;
  }

  function recordStatusBadge(status) {
    const colors = {
      active: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-amber-100 text-amber-800',
      external: 'bg-sky-100 text-sky-800',
      error: 'bg-red-100 text-red-800',
    };
    return `<span class="text-[10px] px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100'}">${escDns(status || 'pending')}</span>`;
  }

  function siteTypeBadge(type) {
    const labels = { platform: 'Platform', quantum: 'Quantum Pages', client: 'Client' };
    return `<span class="text-[10px] uppercase tracking-wide text-slate-500">${labels[type] || type}</span>`;
  }

  function typeOptions(selected) {
    return RECORD_TYPES.map((t) =>
      `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`
    ).join('');
  }

  function groupRecords(records) {
    const order = ['NS', 'A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'CAA'];
    const groups = {};
    (records || []).forEach((r) => {
      const t = (r.type || 'A').toUpperCase();
      if (!groups[t]) groups[t] = [];
      groups[t].push(r);
    });
    return order.filter((t) => groups[t]?.length).map((t) => ({ type: t, rows: groups[t] }));
  }

  function fillRecordForm(form, data) {
    if (!form) return;
    if (form.name) form.name.value = data.name ?? '@';
    if (form.type) form.type.value = data.type || 'A';
    if (form.value) form.value.value = data.value || '';
    if (form.ttl) form.ttl.value = data.ttl != null ? data.ttl : 300;
    if (form.priority) form.priority.value = data.priority != null ? data.priority : '';
  }

  P.renderDnsPanel = async function (el, opts) {
    opts = opts || {};
    const isAdmin = opts.admin === true;
    const compact = opts.compact === true;
    el.innerHTML = '<p class="text-sm text-slate-500 py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading DNS…</p>';

    if (P.apiConfig?.mode !== 'remote' || !localStorage.getItem('urdfw_api_token')) {
      el.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
        <strong>API required.</strong> Sign in as admin with the platform API connected to manage DNS (nameservers, A, TXT, CNAME) via Route53.
      </div>`;
      return;
    }

    try {
      const [{ sites }, status] = await Promise.all([
        dnsFetch('/dns/sites'),
        dnsFetch('/dns/status').catch(() => ({ route53: { ok: false }, ready: false })),
      ]);

      const selectedId = el.dataset.selectedSite || (sites[0]?.id || '');
      let records = [];
      let nameservers = [];
      let selectedSite = sites.find((s) => s.id === selectedId) || null;

      if (selectedId) {
        const [rec, detail] = await Promise.all([
          dnsFetch('/dns/sites/' + selectedId + '/records'),
          dnsFetch('/dns/sites/' + selectedId),
        ]);
        records = rec.records || [];
        nameservers = detail.nameservers || [];
        selectedSite = detail.site || selectedSite;
      }

      const filterType = el.dataset.filterType || 'all';
      const filtered = filterType === 'all'
        ? records
        : records.filter((r) => (r.type || '').toUpperCase() === filterType);
      const groups = groupRecords(filtered);
      const nsRecords = records.filter((r) => (r.type || '').toUpperCase() === 'NS');

      el.innerHTML = `
        <div class="space-y-5 ${compact ? '' : ''}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold ${compact ? 'text-base' : 'text-lg'} flex items-center gap-2">
                <i class="fa-solid fa-globe text-sky-600"></i> DNS Records
              </h3>
              <p class="text-xs text-slate-500 mt-1">
                Add, edit, and delete <strong>NS</strong>, <strong>A</strong>, <strong>TXT</strong>, and <strong>CNAME</strong>
                ${isAdmin ? ' for platform and client domains' : ' for your linked domains'}.
                Changes sync to Route53 when configured.
              </p>
            </div>
            <div class="text-xs ${status.route53?.ok || status.ready ? 'text-emerald-600' : 'text-amber-600'}">
              <i class="fa-solid fa-circle text-[6px] mr-1"></i>
              Route53 ${status.route53?.ok || status.ready ? 'connected' : 'not configured (local DB only)'}
            </div>
          </div>

          <div class="grid lg:grid-cols-3 gap-4">
            <div class="lg:col-span-1 bg-white border rounded-2xl p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-sm">Sites / Domains</h4>
                <button type="button" id="dns-add-site" class="text-xs px-2 py-1 bg-sky-600 text-white rounded-lg">+ Add</button>
              </div>
              <div class="space-y-2 max-h-80 overflow-auto" id="dns-site-list">
                ${sites.length ? sites.map((s) => `
                  <button type="button" data-site-id="${escDns(s.id)}"
                    class="dns-site-pick w-full text-left border rounded-xl p-3 text-sm hover:border-sky-400 ${s.id === selectedId ? 'border-sky-500 bg-sky-50' : ''}">
                    <div class="font-medium break-all">${escDns(s.domain)}</div>
                    <div class="flex flex-wrap gap-2 mt-1">${siteTypeBadge(s.type)}
                      <span class="text-[10px] text-slate-400">${s.recordCount || 0} records</span>
                    </div>
                  </button>`).join('') : '<p class="text-xs text-slate-400">No sites yet. Add a domain to get started.</p>'}
              </div>
            </div>

            <div class="lg:col-span-2 space-y-4">
              ${selectedId ? `
              <div class="bg-white border rounded-2xl p-4">
                <div class="flex flex-wrap justify-between gap-2 mb-3 items-center">
                  <h4 class="font-semibold text-sm">Zone — ${escDns(selectedSite?.domain || '')}</h4>
                  <div class="flex flex-wrap gap-2">
                    ${isAdmin ? '<button type="button" id="dns-sync-route53" class="text-xs px-2 py-1 border rounded-lg"><i class="fa-solid fa-cloud-arrow-down mr-1"></i>Sync Route53</button>' : ''}
                    <button type="button" id="dns-refresh" class="text-xs px-2 py-1 border rounded-lg">Refresh</button>
                  </div>
                </div>

                <div class="mb-4 p-3 rounded-xl bg-slate-50 border text-xs">
                  <div class="font-semibold text-slate-700 mb-1"><i class="fa-solid fa-server text-sky-600 mr-1"></i> Nameservers (zone delegation)</div>
                  ${nameservers.length
                    ? `<div class="flex flex-wrap gap-2 mt-1">${nameservers.map((n) =>
                        `<code class="bg-white border px-2 py-1 rounded text-[11px] dns-copy-ns" data-copy="${escDns(n)}" title="Click to copy">${escDns(n)}</code>`
                      ).join('')}</div>
                      <p class="text-[10px] text-slate-500 mt-2">Point your registrar to these NS values for this hosted zone. Subdomain NS rows can still be added/edited below.</p>`
                    : `<p class="text-slate-500">No Route53 nameservers returned — create a hosted zone or set ROUTE53_HOSTED_ZONE_ID. You can still manage NS records in the table below.</p>`}
                  ${nsRecords.length ? `<p class="mt-2 text-[10px] text-slate-500">${nsRecords.length} NS record(s) in table (including apex/subdomain).</p>` : ''}
                </div>

                <div class="flex flex-wrap gap-1.5 mb-3" id="dns-type-filters">
                  <button type="button" data-filter="all" class="dns-filter text-[11px] px-2.5 py-1 rounded-full border ${filterType === 'all' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white'}">All (${records.length})</button>
                  ${['NS', 'A', 'CNAME', 'TXT', 'AAAA', 'MX'].map((t) => {
                    const c = records.filter((r) => (r.type || '').toUpperCase() === t).length;
                    return `<button type="button" data-filter="${t}" class="dns-filter text-[11px] px-2.5 py-1 rounded-full border ${filterType === t ? 'bg-sky-600 text-white border-sky-600' : 'bg-white'}">${t} (${c})</button>`;
                  }).join('')}
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="text-left text-slate-500 border-b">
                        <th class="py-2 pr-2">Name</th>
                        <th class="pr-2">Type</th>
                        <th class="pr-2">Value</th>
                        <th class="pr-2">TTL</th>
                        <th class="pr-2">Status</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="dns-records-body">
                      ${filtered.length ? filtered.map((r) => `
                        <tr class="border-b border-slate-100 align-top" data-record-row="${escDns(r.id)}">
                          <td class="py-2 pr-2 font-mono">${escDns(r.name)}</td>
                          <td class="pr-2"><span class="font-semibold text-slate-700">${escDns(r.type)}</span></td>
                          <td class="pr-2 max-w-[220px]">
                            <span class="font-mono break-all" title="${escDns(r.value)}">${escDns(r.value)}</span>
                            ${r.error ? `<div class="text-[10px] text-red-600 mt-0.5">${escDns(r.error)}</div>` : ''}
                          </td>
                          <td class="pr-2">${escDns(r.ttl)}</td>
                          <td class="pr-2">${recordStatusBadge(r.status)}</td>
                          <td class="py-2 text-right whitespace-nowrap">
                            <button type="button" class="dns-edit text-sky-700 hover:underline mr-2"
                              data-id="${escDns(r.id)}"
                              data-name="${escDns(r.name)}"
                              data-type="${escDns(r.type)}"
                              data-value="${escDns(r.value)}"
                              data-ttl="${escDns(r.ttl)}"
                              data-priority="${escDns(r.priority ?? '')}">Edit</button>
                            <button type="button" data-del-record="${escDns(r.id)}" class="text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>`).join('') : '<tr><td colspan="6" class="py-6 text-center text-slate-400">No records for this filter — add one below.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="bg-white border rounded-2xl p-4" id="dns-record-editor">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 class="font-semibold text-sm" id="dns-form-title">Add DNS Record</h4>
                  <button type="button" id="dns-form-cancel" class="hidden text-xs text-slate-500 underline">Cancel edit</button>
                </div>
                <form id="dns-record-form" class="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 text-sm">
                  <input type="hidden" name="recordId" value="">
                  <label class="block text-[10px] text-slate-500 sm:col-span-1">Name
                    <input name="name" placeholder="@, www, api, mail" class="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono" value="@" required>
                  </label>
                  <label class="block text-[10px] text-slate-500">Type
                    <select name="type" class="w-full border rounded-lg px-2 py-1.5 mt-0.5">${typeOptions('A')}</select>
                  </label>
                  <label class="block text-[10px] text-slate-500 sm:col-span-2 lg:col-span-2">Value
                    <input name="value" placeholder="IP, hostname, or text" class="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono" required>
                  </label>
                  <label class="block text-[10px] text-slate-500">TTL
                    <input name="ttl" type="number" min="60" step="1" class="w-full border rounded-lg px-2 py-1.5 mt-0.5" value="300">
                  </label>
                  <label class="block text-[10px] text-slate-500">MX priority
                    <input name="priority" type="number" min="0" placeholder="10" class="w-full border rounded-lg px-2 py-1.5 mt-0.5">
                  </label>
                  <button type="submit" id="dns-form-submit" class="sm:col-span-2 lg:col-span-6 px-4 py-2.5 bg-[#0369a1] text-white rounded-xl text-sm font-medium">
                    <i class="fa-solid fa-plus mr-1"></i> Add Record
                  </button>
                </form>
                <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span class="text-slate-400 self-center">Presets:</span>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="@" data-type="A" data-value="alias:d4lzb9pq4mfuf.cloudfront.net">A @ → CloudFront</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="www" data-type="CNAME" data-value="${escDns(selectedSite?.domain || 'upperroomdfw.com')}">CNAME www → apex</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="api" data-type="CNAME" data-value="main.dbtc2f3y8pyam.amplifyapp.com">CNAME api → Amplify</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="@" data-type="TXT" data-value="v=spf1 include:_spf.google.com ~all">TXT SPF</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="_dmarc" data-type="TXT" data-value="v=DMARC1; p=none;">TXT DMARC</button>
                  <button type="button" class="dns-preset px-2 py-1 border rounded-lg" data-name="@" data-type="NS" data-value="ns-xxx.awsdns-xx.com">NS (subdomain/apex)</button>
                </div>
                <p class="mt-2 text-[10px] text-slate-400">
                  <strong>NS:</strong> apex NS usually come from the hosted zone (shown above). Use NS rows to delegate a subdomain (e.g. <code>shop</code> → partner nameservers) or document zone NS after Sync.
                  <strong>A:</strong> IPv4 or <code>alias:cloudfront…</code>. <strong>CNAME:</strong> hostname. <strong>TXT:</strong> verification/SPF strings (quotes optional).
                </p>
                <div id="dns-form-status" class="text-xs mt-2 text-slate-500"></div>
              </div>` : `
              <div class="bg-slate-50 border rounded-2xl p-6 text-sm text-slate-500">
                Select or add a site to manage nameservers, A, TXT, and CNAME records.
              </div>`}
            </div>
          </div>
        </div>`;

      const refresh = () => P.renderDnsPanel(el, opts);

      el.querySelectorAll('.dns-site-pick').forEach((btn) => {
        btn.onclick = () => {
          el.dataset.selectedSite = btn.dataset.siteId;
          delete el.dataset.filterType;
          refresh();
        };
      });

      el.querySelectorAll('.dns-filter').forEach((btn) => {
        btn.onclick = () => {
          el.dataset.filterType = btn.dataset.filter || 'all';
          refresh();
        };
      });

      el.querySelector('#dns-refresh')?.addEventListener('click', refresh);

      el.querySelectorAll('.dns-copy-ns').forEach((code) => {
        code.style.cursor = 'pointer';
        code.onclick = async () => {
          try {
            await navigator.clipboard.writeText(code.dataset.copy || code.textContent);
            P.portalToast?.('Nameserver copied');
          } catch {
            P.portalToast?.(code.dataset.copy || 'Copy failed');
          }
        };
      });

      el.querySelector('#dns-add-site')?.addEventListener('click', async () => {
        const domain = prompt('Domain name (e.g. mychurch.org or upperroomdfw.com):', '');
        if (!domain) return;
        const name = prompt('Site label:', domain) || domain;
        const createZone = isAdmin && confirm('Create a new Route53 hosted zone for this domain?\n(Required for domains outside the platform zone)');
        try {
          await dnsFetch('/dns/sites', {
            method: 'POST',
            body: { domain, name, autoDefaults: true, createZone },
          });
          P.portalToast?.('Site added: ' + domain);
          refresh();
        } catch (err) {
          P.portalToast?.(err.message);
        }
      });

      const form = el.querySelector('#dns-record-form');
      const formTitle = el.querySelector('#dns-form-title');
      const formSubmit = el.querySelector('#dns-form-submit');
      const formCancel = el.querySelector('#dns-form-cancel');
      const formStatus = el.querySelector('#dns-form-status');

      const setEditMode = (record) => {
        if (!form) return;
        if (record) {
          form.recordId.value = record.id || '';
          fillRecordForm(form, record);
          if (formTitle) formTitle.textContent = 'Edit DNS Record';
          if (formSubmit) formSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Save Changes';
          formCancel?.classList.remove('hidden');
          el.querySelector('#dns-record-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          form.recordId.value = '';
          fillRecordForm(form, { name: '@', type: 'A', value: '', ttl: 300 });
          if (formTitle) formTitle.textContent = 'Add DNS Record';
          if (formSubmit) formSubmit.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Add Record';
          formCancel?.classList.add('hidden');
        }
        if (formStatus) formStatus.textContent = '';
      };

      formCancel?.addEventListener('click', () => setEditMode(null));

      el.querySelectorAll('.dns-edit').forEach((btn) => {
        btn.onclick = () => {
          setEditMode({
            id: btn.dataset.id,
            name: btn.dataset.name,
            type: btn.dataset.type,
            value: btn.dataset.value,
            ttl: btn.dataset.ttl,
            priority: btn.dataset.priority,
          });
        };
      });

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const recordId = (fd.get('recordId') || '').trim();
        const payload = {
          name: String(fd.get('name') || '@').trim(),
          type: String(fd.get('type') || 'A').toUpperCase(),
          value: String(fd.get('value') || '').trim(),
          ttl: parseInt(fd.get('ttl') || '300', 10) || 300,
        };
        const pri = fd.get('priority');
        if (pri !== '' && pri != null) payload.priority = parseInt(pri, 10);

        if (!payload.value) {
          if (formStatus) formStatus.textContent = 'Value is required.';
          return;
        }

        if (formSubmit) {
          formSubmit.disabled = true;
          formSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving…';
        }
        if (formStatus) formStatus.textContent = recordId ? 'Updating record…' : 'Creating record…';

        try {
          if (recordId) {
            await dnsFetch('/dns/records/' + encodeURIComponent(recordId), {
              method: 'PATCH',
              body: payload,
            });
            P.portalToast?.('DNS record updated');
          } else {
            await dnsFetch('/dns/sites/' + selectedId + '/records', {
              method: 'POST',
              body: payload,
            });
            P.portalToast?.('DNS record added');
          }
          refresh();
        } catch (err) {
          if (formStatus) formStatus.innerHTML = `<span class="text-red-600">${escDns(err.message)}</span>`;
          P.portalToast?.(err.message);
          if (formSubmit) {
            formSubmit.disabled = false;
            formSubmit.innerHTML = recordId
              ? '<i class="fa-solid fa-floppy-disk mr-1"></i> Save Changes'
              : '<i class="fa-solid fa-plus mr-1"></i> Add Record';
          }
        }
      });

      el.querySelectorAll('.dns-preset').forEach((btn) => {
        btn.onclick = () => {
          setEditMode(null);
          fillRecordForm(form, {
            name: btn.dataset.name,
            type: btn.dataset.type,
            value: btn.dataset.value,
            ttl: 300,
          });
          if (form?.recordId) form.recordId.value = '';
        };
      });

      el.querySelectorAll('[data-del-record]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this DNS record? This cannot be undone and will remove it from Route53 when synced.')) return;
          try {
            await dnsFetch('/dns/records/' + encodeURIComponent(btn.dataset.delRecord), { method: 'DELETE' });
            P.portalToast?.('Record deleted');
            refresh();
          } catch (err) {
            P.portalToast?.(err.message);
          }
        };
      });

      el.querySelector('#dns-sync-route53')?.addEventListener('click', async () => {
        try {
          const r = await dnsFetch('/dns/sites/' + selectedId + '/sync', { method: 'POST' });
          P.portalToast?.('Imported ' + (r.imported || 0) + ' records from Route53');
          refresh();
        } catch (err) {
          P.portalToast?.(err.message);
        }
      });
    } catch (err) {
      el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
        <strong>DNS panel error</strong>
        <p class="mt-1 text-xs font-mono">${escDns(err.message)}</p>
        <button type="button" class="mt-3 text-xs underline" id="dns-retry">Retry</button>
      </div>`;
      el.querySelector('#dns-retry')?.addEventListener('click', () => P.renderDnsPanel(el, opts));
    }
  };

  P.renderAdminDns = function (el) {
    return P.renderDnsPanel(el, { admin: true });
  };

  P.renderMemberDns = function (el) {
    return P.renderDnsPanel(el, { admin: false });
  };

  /** Embed full DNS editor inside SEO Hub (or any host element). */
  P.renderSeoDnsManager = function (el) {
    return P.renderDnsPanel(el, { admin: true, compact: true });
  };
})(window);
