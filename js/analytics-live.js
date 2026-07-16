/**
 * Live analytics charts — Chart.js dashboards fed by /api/analytics/*
 */
(function (global) {
  const A = global.URDFWAnalytics = global.URDFWAnalytics || {};

  const palette = {
    primary: '#0369a1',
    accent: '#0ea5e9',
    glow: 'rgba(14, 165, 233, 0.15)',
    grid: 'rgba(148, 163, 184, 0.2)',
  };

  function destroyCharts(el) {
    if (!el._urdfwCharts) return;
    el._urdfwCharts.forEach((c) => c.destroy());
    el._urdfwCharts = [];
  }

  function trackChart(el, chart) {
    el._urdfwCharts = el._urdfwCharts || [];
    el._urdfwCharts.push(chart);
  }

  A.renderKpiGrid = function (container, kpis) {
    const items = [
      { label: 'Live Listings', value: kpis.listings, icon: 'fa-church', color: 'from-sky-600 to-cyan-500' },
      { label: 'Registered Churches', value: kpis.clients, icon: 'fa-users', color: 'from-indigo-600 to-violet-500' },
      { label: 'Paid Members', value: kpis.paid, icon: 'fa-credit-card', color: 'from-emerald-600 to-teal-500' },
      { label: 'Open Leads', value: kpis.leads, icon: 'fa-envelope', color: 'from-amber-500 to-orange-500' },
      { label: 'Subscribers', value: kpis.subscribers, icon: 'fa-bell', color: 'from-rose-500 to-pink-500' },
      { label: 'Revenue', value: '$' + (kpis.revenue || 0).toLocaleString(), icon: 'fa-chart-line', color: 'from-slate-700 to-slate-900' },
    ];
    container.innerHTML = `
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        ${items.map((k) => `
          <div class="relative overflow-hidden rounded-2xl p-4 text-white bg-gradient-to-br ${k.color} shadow-lg">
            <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10"></div>
            <i class="fa-solid ${k.icon} text-white/80 text-sm"></i>
            <div class="text-2xl font-bold mt-2">${k.value ?? 0}</div>
            <div class="text-[10px] uppercase tracking-wider text-white/80 mt-1">${k.label}</div>
          </div>`).join('')}
      </div>`;
  };

  function escText(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  A.renderAdminCharts = function (el, data) {
    destroyCharts(el);
    const charts = data.charts || {};
    /* Unique canvas IDs so Overview + Analytics tabs never collide */
    const uid = 'ac' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const idAreas = uid + '-areas';
    const idRegs = uid + '-regs';
    const idLeads = uid + '-leads';
    const idFeed = uid + '-feed';
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2"><i class="fa-solid fa-map-location-dot text-sky-400"></i> Listings by DFW Area</h3>
          <canvas id="${idAreas}" height="200"></canvas>
        </div>
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2"><i class="fa-solid fa-user-plus text-emerald-400"></i> Church Registrations</h3>
          <canvas id="${idRegs}" height="200"></canvas>
        </div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="portal-panel">
          <h3 class="font-semibold text-sm mb-3">Lead Pipeline</h3>
          <canvas id="${idLeads}" height="180"></canvas>
        </div>
        <div class="portal-panel">
          <h3 class="font-semibold text-sm mb-3">Recent Activity Feed</h3>
          <div class="text-xs space-y-2 max-h-52 overflow-auto" id="${idFeed}"></div>
        </div>
      </div>`;

    const canvas = (id) => el.querySelector('#' + id);

    const areas = charts.listingsByArea || [];
    if (areas.length && global.Chart && canvas(idAreas)) {
      trackChart(el, new Chart(canvas(idAreas), {
        type: 'bar',
        data: {
          labels: areas.map((a) => a.area),
          datasets: [{ data: areas.map((a) => a.count), backgroundColor: palette.accent, borderRadius: 6 }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: palette.grid } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: palette.grid } },
          },
        },
      }));
    }

    const regs = charts.registrationsByMonth || [];
    if (regs.length && global.Chart && canvas(idRegs)) {
      trackChart(el, new Chart(canvas(idRegs), {
        type: 'line',
        data: {
          labels: regs.map((r) => r.month),
          datasets: [{
            data: regs.map((r) => r.count),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.2)',
            fill: true,
            tension: 0.35,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b' } },
            y: { ticks: { color: '#64748b' }, beginAtZero: true },
          },
        },
      }));
    }

    const leadStatus = charts.leadsByStatus || [];
    if (leadStatus.length && global.Chart && canvas(idLeads)) {
      trackChart(el, new Chart(canvas(idLeads), {
        type: 'doughnut',
        data: {
          labels: leadStatus.map((l) => l.status),
          datasets: [{
            data: leadStatus.map((l) => l.count),
            backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'],
          }],
        },
        options: { plugins: { legend: { position: 'bottom' } } },
      }));
    } else if (canvas(idLeads) && !leadStatus.length) {
      canvas(idLeads).parentElement.insertAdjacentHTML('beforeend', '<p class="text-xs text-slate-500 mt-2">No lead data yet.</p>');
    }

    const feed = el.querySelector('#' + idFeed);
    const items = [
      ...(data.recent?.leads || []).map((l) => ({ type: 'lead', text: `${l.name || 'Lead'} → ${l.church_email || l.churchEmail || ''}`, at: l.created_at || l.createdAt })),
      ...(data.recent?.tickets || []).map((t) => ({ type: 'ticket', text: `${t.topic || 'Support'}: ${t.name || t.email || ''}`, at: t.created_at || t.createdAt })),
      ...(data.recent?.orders || []).map((o) => ({ type: 'order', text: `$${o.amount} ${o.plan || ''} — ${o.email || ''}`, at: o.created_at || o.createdAt })),
    ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 12);

    if (feed) {
      feed.innerHTML = items.length
        ? items.map((i) => `<div class="flex justify-between gap-2 py-1.5 border-b border-slate-100">
            <span><span class="text-sky-600 font-medium">${escText(i.type)}</span> ${escText(i.text)}</span>
            <span class="text-slate-400 shrink-0">${i.at ? new Date(i.at).toLocaleDateString() : ''}</span></div>`).join('')
        : '<span class="text-slate-500">No activity yet — forms and registrations will appear here.</span>';
    }

    /* Google traffic (GA4 + GSC) — appended below platform charts */
    const trafficHost = document.createElement('div');
    trafficHost.id = uid + '-traffic';
    trafficHost.className = 'mt-6';
    el.appendChild(trafficHost);
    A.renderGoogleTraffic(trafficHost, data.traffic || null);
  };

  A.renderGoogleTraffic = function (el, traffic) {
    if (!el) return;
    destroyCharts(el);
    if (!traffic || traffic.configured === false) {
      el.innerHTML = `
        <div class="portal-panel border border-dashed border-sky-200 bg-sky-50/50">
          <h3 class="font-semibold text-sm mb-2 flex items-center gap-2"><i class="fa-brands fa-google text-sky-600"></i> Google Search Console &amp; GA4</h3>
          <p class="text-xs text-slate-600 mb-3">Connect a Google Cloud service account to pull live Search Console queries and GA4 sessions into this dashboard.</p>
          <ol class="text-xs text-slate-600 list-decimal pl-5 space-y-1 mb-3">
            <li>Create a GCP service account with <strong>Analytics Data API</strong> + <strong>Search Console API</strong> enabled.</li>
            <li>Add the SA email as GA4 <em>Viewer</em> and as a Search Console user for your property.</li>
            <li>Set env: <code class="bg-white px-1 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code class="bg-white px-1 rounded">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>, <code class="bg-white px-1 rounded">GA4_PROPERTY_ID</code>, <code class="bg-white px-1 rounded">GSC_SITE_URL</code>.</li>
          </ol>
          <p class="text-[11px] text-slate-500">${escText(traffic?.reason || traffic?.error || 'Not configured yet — platform KPIs above still work from your database.')}</p>
        </div>`;
      return;
    }

    const ga4 = traffic.ga4 || {};
    const gsc = traffic.gsc || {};
    const gaErr = ga4.error ? `<p class="text-xs text-amber-700 mt-1">GA4: ${escText(ga4.error)}</p>` : '';
    const gscErr = gsc.error ? `<p class="text-xs text-amber-700 mt-1">GSC: ${escText(gsc.error)}</p>` : '';
    const t = ga4.totals || {};
    const gt = gsc.totals || {};
    const uid = 'gt' + Date.now().toString(36);
    const idSessions = uid + '-sess';
    const idGsc = uid + '-gsc';

    el.innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold text-sm flex items-center gap-2"><i class="fa-brands fa-google text-sky-600"></i> Traffic · GA4 &amp; Search Console</h3>
        <span class="text-[10px] text-slate-400">Last ${escText(String(ga4.rangeDays || gsc.rangeDays || 28))} days · updated ${traffic.generatedAt ? new Date(traffic.generatedAt).toLocaleString() : '—'}</span>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div class="rounded-2xl p-3 bg-gradient-to-br from-sky-600 to-cyan-500 text-white">
          <div class="text-[10px] uppercase opacity-80">GA4 Sessions</div>
          <div class="text-2xl font-bold">${(t.sessions || 0).toLocaleString()}</div>
        </div>
        <div class="rounded-2xl p-3 bg-gradient-to-br from-indigo-600 to-violet-500 text-white">
          <div class="text-[10px] uppercase opacity-80">Users</div>
          <div class="text-2xl font-bold">${(t.users || 0).toLocaleString()}</div>
        </div>
        <div class="rounded-2xl p-3 bg-gradient-to-br from-slate-700 to-slate-900 text-white">
          <div class="text-[10px] uppercase opacity-80">Page views</div>
          <div class="text-2xl font-bold">${(t.pageViews || 0).toLocaleString()}</div>
        </div>
        <div class="rounded-2xl p-3 bg-gradient-to-br from-emerald-600 to-teal-500 text-white">
          <div class="text-[10px] uppercase opacity-80">GSC Clicks</div>
          <div class="text-2xl font-bold">${(gt.clicks || 0).toLocaleString()}</div>
        </div>
        <div class="rounded-2xl p-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <div class="text-[10px] uppercase opacity-80">Impressions</div>
          <div class="text-2xl font-bold">${(gt.impressions || 0).toLocaleString()}</div>
        </div>
      </div>
      ${gaErr}${gscErr}
      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h4 class="font-semibold text-sm mb-3">GA4 sessions by day</h4>
          <canvas id="${idSessions}" height="180"></canvas>
        </div>
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h4 class="font-semibold text-sm mb-3">Search Console clicks</h4>
          <canvas id="${idGsc}" height="180"></canvas>
        </div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="portal-panel">
          <h4 class="font-semibold text-sm mb-2">Top search queries (GSC)</h4>
          <div class="text-xs max-h-48 overflow-auto space-y-1">
            ${(gsc.topQueries || []).length
              ? (gsc.topQueries || []).map((q) => `
                <div class="flex justify-between gap-2 border-b border-slate-100 py-1">
                  <span class="truncate" title="${escText(q.query)}">${escText(q.query)}</span>
                  <span class="text-slate-500 shrink-0">${q.clicks} clk · ${q.impressions} imp · pos ${Number(q.position || 0).toFixed(1)}</span>
                </div>`).join('')
              : '<span class="text-slate-500">No query data (or GSC not linked).</span>'}
          </div>
        </div>
        <div class="portal-panel">
          <h4 class="font-semibold text-sm mb-2">Top pages (GA4)</h4>
          <div class="text-xs max-h-48 overflow-auto space-y-1">
            ${(ga4.topPages || []).length
              ? (ga4.topPages || []).map((p) => `
                <div class="flex justify-between gap-2 border-b border-slate-100 py-1">
                  <span class="truncate font-mono" title="${escText(p.path)}">${escText(p.path)}</span>
                  <span class="text-slate-500 shrink-0">${(p.pageViews || 0).toLocaleString()} views</span>
                </div>`).join('')
              : '<span class="text-slate-500">No page data yet.</span>'}
          </div>
        </div>
      </div>`;

    const byDay = ga4.byDay || [];
    if (byDay.length && global.Chart) {
      const c = el.querySelector('#' + idSessions);
      if (c) {
        trackChart(el, new Chart(c, {
          type: 'line',
          data: {
            labels: byDay.map((d) => (d.date || '').slice(5)),
            datasets: [{
              data: byDay.map((d) => d.sessions),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              fill: true,
              tension: 0.35,
            }],
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
              y: { ticks: { color: '#94a3b8' }, beginAtZero: true },
            },
          },
        }));
      }
    }

    const gscDays = gsc.byDay || [];
    if (gscDays.length && global.Chart) {
      const c = el.querySelector('#' + idGsc);
      if (c) {
        trackChart(el, new Chart(c, {
          type: 'bar',
          data: {
            labels: gscDays.map((d) => (d.date || '').slice(5)),
            datasets: [{
              data: gscDays.map((d) => d.clicks),
              backgroundColor: '#34d399',
              borderRadius: 4,
            }],
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
              y: { ticks: { color: '#94a3b8' }, beginAtZero: true },
            },
          },
        }));
      }
    }
  };

  A.renderMemberCharts = function (el, data) {
    destroyCharts(el);
    const kpis = data.kpis || {};
    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="rounded-2xl p-4 bg-gradient-to-br from-sky-600 to-cyan-500 text-white">
          <div class="text-xs opacity-80">Total Leads</div><div class="text-3xl font-bold">${kpis.totalLeads || 0}</div></div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <div class="text-xs opacity-80">New</div><div class="text-3xl font-bold">${kpis.newLeads || 0}</div></div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-teal-500 text-white">
          <div class="text-xs opacity-80">Contacted</div><div class="text-3xl font-bold">${kpis.contacted || 0}</div></div>
        <div class="rounded-2xl p-4 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <div class="text-xs opacity-80">Response Rate</div><div class="text-3xl font-bold">${kpis.responseRate || 0}%</div></div>
      </div>
      <div class="portal-panel mb-4">
        <h3 class="font-semibold text-sm mb-2">Lead Trend (14 days)</h3>
        <canvas id="member-lead-chart" height="120"></canvas>
      </div>
      <div class="portal-panel text-xs">
        <h3 class="font-semibold text-sm mb-2">Listing Status</h3>
        <p><strong>${data.listing?.name || 'No listing linked'}</strong> — ${kpis.listingStatus} · ${kpis.package} ${kpis.isPaid ? '(paid)' : '(trial/free)'}</p>
      </div>`;

    const days = data.charts?.leadsByDay || [];
    if (days.length && global.Chart) {
      trackChart(el, new Chart(document.getElementById('member-lead-chart'), {
        type: 'line',
        data: {
          labels: days.map((d) => d.day.slice(5)),
          datasets: [{
            data: days.map((d) => d.count),
            borderColor: palette.primary,
            backgroundColor: palette.glow,
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      }));
    }
  };

  A.fetchAdmin = async function () {
    const token = localStorage.getItem('urdfw_api_token');
    const res = await fetch('/api/analytics/admin', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) throw new Error('Analytics unavailable');
    return res.json();
  };

  A.fetchMember = async function () {
    const token = localStorage.getItem('urdfw_api_token');
    const res = await fetch('/api/analytics/member', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) throw new Error('Member analytics unavailable');
    return res.json();
  };
})(window);