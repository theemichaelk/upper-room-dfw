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

  A.renderAdminCharts = function (el, data) {
    destroyCharts(el);
    const charts = data.charts || {};
    el.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2"><i class="fa-solid fa-map-location-dot text-sky-400"></i> Listings by DFW Area</h3>
          <canvas id="chart-areas" height="200"></canvas>
        </div>
        <div class="portal-panel bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2"><i class="fa-solid fa-user-plus text-emerald-400"></i> Church Registrations</h3>
          <canvas id="chart-regs" height="200"></canvas>
        </div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="portal-panel">
          <h3 class="font-semibold text-sm mb-3">Lead Pipeline</h3>
          <canvas id="chart-leads" height="180"></canvas>
        </div>
        <div class="portal-panel">
          <h3 class="font-semibold text-sm mb-3">Recent Activity Feed</h3>
          <div class="text-xs space-y-2 max-h-52 overflow-auto" id="activity-feed"></div>
        </div>
      </div>`;

    const areas = charts.listingsByArea || [];
    if (areas.length && global.Chart) {
      trackChart(el, new Chart(document.getElementById('chart-areas'), {
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
    if (regs.length && global.Chart) {
      trackChart(el, new Chart(document.getElementById('chart-regs'), {
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
    if (leadStatus.length && global.Chart) {
      trackChart(el, new Chart(document.getElementById('chart-leads'), {
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
    }

    const feed = el.querySelector('#activity-feed');
    const items = [
      ...(data.recent?.leads || []).map((l) => ({ type: 'lead', text: `${l.name} → ${l.church_email}`, at: l.created_at })),
      ...(data.recent?.tickets || []).map((t) => ({ type: 'ticket', text: `${t.topic}: ${t.name}`, at: t.created_at })),
      ...(data.recent?.orders || []).map((o) => ({ type: 'order', text: `$${o.amount} ${o.plan} — ${o.email}`, at: o.created_at })),
    ].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 12);

    feed.innerHTML = items.length
      ? items.map((i) => `<div class="flex justify-between gap-2 py-1.5 border-b border-slate-100">
          <span><span class="text-sky-600 font-medium">${i.type}</span> ${i.text}</span>
          <span class="text-slate-400 shrink-0">${new Date(i.at).toLocaleDateString()}</span></div>`).join('')
      : '<span class="text-slate-500">No activity yet — forms and registrations will appear here.</span>';
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