/**
 * Category 10: Admin stats, email templates, automation
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.emailTemplates = {
    welcome: { subject: 'Welcome to Upper Room DFW', body: 'Hi {{name}}, welcome! Your account is ready.' },
    forgot_password: { subject: 'Reset your password', body: 'Click here to reset: {{link}}' },
    order: { subject: 'Order confirmation #{{orderId}}', body: 'Thank you! ${{amount}} charged via {{gateway}}.' },
    subscription_reminder: { subject: 'Subscription renews soon', body: 'Your {{plan}} plan renews in 3 days.' },
    contact_auto_reply: { subject: 'We received your message', body: 'Thanks for contacting Upper Room DFW. We reply within 24h.' },
    contact_admin: { subject: 'New contact form submission', body: 'From: {{email}}\n{{message}}' },
    digest: { subject: 'Weekly DFW Church Digest', body: 'This week in DFW faith communities...' },
  };

  P.sendEmail = function (templateKey, data) {
    const tpl = P.emailTemplates[templateKey];
    if (!tpl) return;
    let body = tpl.body;
    let subject = tpl.subject;
    Object.entries(data || {}).forEach(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
      body = body.replace(new RegExp('{{' + k + '}}', 'g'), val);
      subject = subject.replace(new RegExp('{{' + k + '}}', 'g'), val);
    });
    if (data.order) {
      body = body.replace('{{orderId}}', data.order.id).replace('{{amount}}', data.order.amount).replace('{{gateway}}', data.order.gateway);
      subject = subject.replace('{{orderId}}', data.order.id);
    }
    const log = P.get('email_log', []);
    log.unshift({ template: templateKey, subject, body, to: data.email || 'admin@upperroomdfw.local', sentAt: new Date().toISOString() });
    P.set('email_log', log);
    P.emit('email:sent', { templateKey, subject });
  };

  P.getClickStats = function () {
    const stats = P.get('click_stats', []);
    const byType = {};
    stats.forEach((s) => { byType[s.type] = (byType[s.type] || 0) + 1; });
    return { total: stats.length, byType, recent: stats.slice(-20) };
  };

  P.autoGenerateSEO = function (listing) {
    const title = `${listing.name} | ${listing.area}, TX | Upper Room DFW`;
    const desc = `${listing.description || listing.name} — Find ${listing.name} in ${listing.area} on Upper Room DFW church directory.`;
    return { title, description: desc.slice(0, 160) };
  };

  P.getPageSettings = function (pageId) {
    const settings = P.get('page_settings', {});
    return settings[pageId] || { title: '', description: '', noindex: false };
  };

  P.setPageSettings = async function (pageId, settings) {
    const all = P.get('page_settings', {});
    all[pageId] = { ...all[pageId], ...settings };
    P.set('page_settings', all);
    if (P.apiConfig?.mode === 'remote' && P.getTokenRole?.() === 'admin') {
      try {
        await P.api?.seo?.savePage(pageId, settings);
      } catch { /* local cache still updated */ }
    }
    return all[pageId];
  };

  P.loadPageSeoFromApi = async function () {
    const pageId = (location.pathname || '').split('/').pop() || 'index.html';
    if (!pageId.endsWith('.html')) return;
    try {
      const res = await fetch('/api/seo/page/' + encodeURIComponent(pageId));
      if (!res.ok) return;
      const data = await res.json();
      if (data.title || data.description) {
        P.applySEO({ title: data.title, description: data.description });
      }
      if (data.noindex) {
        let el = document.querySelector('meta[name="robots"]');
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', 'robots');
          document.head.appendChild(el);
        }
        el.setAttribute('content', 'noindex,nofollow');
      }
    } catch { /* ignore */ }
  };
})(window);