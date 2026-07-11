/**
 * Content Studio — blog management, RSS/sitemap status, site updates audit.
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  P.renderContentStudioPanel = async function (el) {
    el.innerHTML = '<div class="text-sm text-slate-500 p-4">Loading Content Studio…</div>';
    const token = localStorage.getItem('urdfw_api_token');
    let blog = { posts: [] };
    let audit = { recentUpdates: [], inventory: {}, capabilities: {} };

    try {
      const [blogRes, auditRes] = await Promise.all([
        fetch('/api/platform/blog').then((r) => r.ok ? r.json() : blog),
        fetch('/api/platform/site-audit', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.ok ? r.json() : audit),
      ]);
      blog = blogRes;
      audit = auditRes;
    } catch { /* local */ }

    const inv = audit.inventory || {};
    const caps = audit.capabilities || {};

    el.innerHTML = `
      <div class="space-y-4">
        <div class="grid md:grid-cols-3 gap-4">
          <div class="bg-white border rounded-3xl p-5 text-sm">
            <h3 class="font-semibold mb-2"><i class="fa-solid fa-rss text-orange-600 mr-1"></i> RSS Feed</h3>
            <p class="text-xs text-slate-500 mb-2">Public feed for blog subscribers and search engines.</p>
            <a href="/feed.xml" target="_blank" rel="noopener" class="text-sky-700 text-xs font-mono break-all">/feed.xml</a>
            <div class="mt-2 text-xs ${caps.blogRss ? 'text-emerald-700' : 'text-amber-700'}">${caps.blogRss ? '✓ Live on server' : 'Missing — run rebuild'}</div>
          </div>
          <div class="bg-white border rounded-3xl p-5 text-sm">
            <h3 class="font-semibold mb-2"><i class="fa-solid fa-sitemap text-sky-600 mr-1"></i> Sitemap</h3>
            <p class="text-xs text-slate-500 mb-2">${inv.sitemapUrls || 0} URLs indexed including blog posts.</p>
            <a href="/sitemap.xml" target="_blank" rel="noopener" class="text-sky-700 text-xs font-mono">/sitemap.xml</a>
            <div class="mt-2 text-xs ${caps.sitemap ? 'text-emerald-700' : 'text-amber-700'}">${caps.sitemap ? '✓ Live' : 'Missing'}</div>
          </div>
          <div class="bg-white border rounded-3xl p-5 text-sm">
            <h3 class="font-semibold mb-2"><i class="fa-solid fa-newspaper text-violet-600 mr-1"></i> Blog Posts</h3>
            <div class="text-2xl font-bold">${inv.blogPostsJson || blog.posts?.length || 0}</div>
            <div class="text-xs text-slate-500">${inv.blogHtmlPages || 0} HTML pages in /blog/</div>
            <a href="blog.html" target="_blank" class="text-xs text-sky-700 mt-2 inline-block">View blog →</a>
          </div>
        </div>

        <div class="bg-white border rounded-3xl p-5 text-sm">
          <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h3 class="font-semibold"><i class="fa-solid fa-pen-nib text-sky-600 mr-1"></i> Blog Posts (Admin)</h3>
            <div class="flex gap-2">
              <button type="button" id="cs-rebuild-btn" class="px-3 py-1.5 bg-emerald-700 text-white rounded-xl text-xs">Save &amp; Rebuild Site</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-slate-500 border-b"><tr><th class="py-2 text-left">Title</th><th>City</th><th>Slug</th><th>Actions</th></tr></thead>
              <tbody>
                ${(blog.posts || []).map((p) => `<tr class="border-b border-slate-100">
                  <td class="py-2 pr-2 max-w-[16rem] truncate">${esc(p.title)}</td>
                  <td class="py-2">${esc(p.city)}</td>
                  <td class="py-2 font-mono text-[10px]">${esc(p.slug)}</td>
                  <td class="py-2 whitespace-nowrap">
                    <a href="blog/${esc(p.slug)}.html" target="_blank" class="text-sky-700 mr-2">View</a>
                    <button type="button" data-cs-edit="${esc(p.slug)}" class="text-slate-700">Edit JSON</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-slate-500 mt-3">Edit <code>data/blog-posts.json</code> below or use Page Lifecycle for HTML paths. Run <strong>Save &amp; Rebuild</strong> to regenerate blog pages, RSS, and sitemap.</p>
          <textarea id="cs-blog-json" rows="12" class="w-full mt-2 border rounded-xl p-3 font-mono text-[10px]">${esc(JSON.stringify(blog, null, 2))}</textarea>
          <button type="button" id="cs-save-blog" class="mt-2 px-4 py-2 bg-[#0369a1] text-white rounded-xl text-xs">Save Blog JSON</button>
          <div id="cs-blog-status" class="text-xs text-slate-500 mt-2"></div>
        </div>

        <div class="bg-slate-50 border rounded-3xl p-5 text-sm">
          <h3 class="font-semibold mb-3"><i class="fa-solid fa-clock-rotate-left text-slate-600 mr-1"></i> Site Updates Audit</h3>
          <p class="text-xs text-slate-500 mb-4">Recent platform changes you control as admin. Use Page Lifecycle for every HTML URL.</p>
          <div class="space-y-3">
            ${(audit.recentUpdates || []).map((u) => `
              <div class="bg-white border rounded-2xl p-4 text-xs">
                <div class="flex justify-between gap-2">
                  <strong class="text-slate-800">${esc(u.title)}</strong>
                  <span class="text-slate-400">${esc(u.date)}</span>
                </div>
                <p class="text-slate-600 mt-1">${esc(u.summary)}</p>
                <div class="text-slate-400 mt-1">Admin: ${esc(u.adminPath)}</div>
              </div>`).join('') || '<p class="text-slate-400">No updates logged.</p>'}
          </div>
        </div>
      </div>`;

    el.querySelector('#cs-save-blog')?.addEventListener('click', async () => {
      const status = el.querySelector('#cs-blog-status');
      try {
        const data = JSON.parse(el.querySelector('#cs-blog-json').value);
        const res = await fetch('/api/platform/blog', {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        status.textContent = result.ok ? 'Blog JSON saved to server' : (result.error || 'Failed');
        P.portalToast?.('Blog data saved');
      } catch (err) {
        status.textContent = err.message;
      }
    });

    el.querySelector('#cs-rebuild-btn')?.addEventListener('click', async () => {
      const status = el.querySelector('#cs-blog-status');
      status.textContent = 'Rebuilding site (blog + RSS + sitemap + CDN)…';
      const res = await fetch('/api/platform/rebuild', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalidateCache: true }),
      });
      const data = await res.json();
      status.textContent = data.ok ? (data.message || 'Rebuild complete') : (data.error || 'Failed');
      P.portalToast?.(data.ok ? 'Site rebuilt' : 'Rebuild failed');
    });

    el.querySelectorAll('[data-cs-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.csEdit;
        const post = (blog.posts || []).find((p) => p.slug === slug);
        if (post) {
          el.querySelector('#cs-blog-json').value = JSON.stringify(post, null, 2);
          el.querySelector('#cs-blog-json').scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  };
})(window);