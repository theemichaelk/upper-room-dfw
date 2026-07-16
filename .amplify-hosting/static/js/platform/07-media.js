/**
 * Category 7: Media, CSV/PDF export, import, attachments
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P._mediaCache = P._mediaCache || {};

  P.uploadImageAjax = function (file, listingId, clientId) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
          try {
            const res = await P.api?.media?.upload({
              listingId,
              clientId,
              name: file.name,
              dataUrl,
            });
            const asset = res?.asset || res;
            if (asset) {
              P._mediaCache[listingId] = P._mediaCache[listingId] || [];
              P._mediaCache[listingId].unshift(asset);
              resolve(asset);
              return;
            }
          } catch (err) {
            reject(err);
            return;
          }
        }
        const uploads = P.get('media_uploads', {});
        uploads[listingId] = uploads[listingId] || [];
        const item = { id: P.uuid(), dataUrl, url: dataUrl, name: file.name, at: Date.now() };
        uploads[listingId].push(item);
        P.set('media_uploads', uploads);
        resolve(item);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  P.loadListingMedia = async function (listingId) {
    if (!listingId) return [];
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      try {
        const res = await P.api?.media?.list(listingId);
        const assets = res?.assets || [];
        P._mediaCache[listingId] = assets;
        return assets;
      } catch { /* fall through */ }
    }
    return P.get('media_uploads', {})[listingId] || [];
  };

  P.getListingMedia = function (listingId) {
    if (P._mediaCache[listingId]?.length) return P._mediaCache[listingId];
    return P.get('media_uploads', {})[listingId] || [];
  };

  P.deleteListingMedia = async function (assetId, listingId) {
    if (P.apiConfig?.mode === 'remote' && localStorage.getItem('urdfw_api_token')) {
      await P.api?.media?.remove(assetId);
      if (listingId && P._mediaCache[listingId]) {
        P._mediaCache[listingId] = P._mediaCache[listingId].filter((a) => a.id !== assetId);
      }
      return;
    }
    const uploads = P.get('media_uploads', {});
    if (uploads[listingId]) {
      uploads[listingId] = uploads[listingId].filter((a) => a.id !== assetId);
      P.set('media_uploads', uploads);
    }
  };

  P.parseYouTubeId = function (url) {
    const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
    return m ? m[1] : null;
  };

  P.parseVimeoId = function (url) {
    const m = (url || '').match(/vimeo\.com\/(\d+)/);
    return m ? m[1] : null;
  };

  P.embedMedia = function (url) {
    const yt = P.parseYouTubeId(url);
    if (yt) return `<iframe class="w-full aspect-video rounded" src="https://www.youtube.com/embed/${yt}" allowfullscreen></iframe>`;
    const vm = P.parseVimeoId(url);
    if (vm) return `<iframe class="w-full aspect-video rounded" src="https://player.vimeo.com/video/${vm}" allowfullscreen></iframe>`;
    return '';
  };

  P.faviconFromUrl = function (url) {
    try {
      const host = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch { return 'assets/church-placeholder.svg'; }
  };

  P.exportCSV = function (listings, filename) {
    const headers = ['id', 'slug', 'name', 'area', 'category', 'address', 'phone', 'email', 'website', 'times', 'description', 'rating', 'level', 'tags'];
    const rows = listings.map((ch) => headers.map((h) => {
      let v = ch[h];
      if (Array.isArray(v)) v = v.join(';');
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    P.downloadBlob(csv, filename || 'urdfw-export.csv', 'text/csv');
  };

  P.importCSV = function (csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (vals[idx] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      });
      if (row.name) {
        row.id = row.id || P.uuid();
        row.slug = row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (row.tags && typeof row.tags === 'string') row.tags = row.tags.split(';');
        imported.push(row);
      }
    }
    const existing = P.get('custom_listings', []);
    P.set('custom_listings', [...imported, ...existing]);
    return imported.length;
  };

  P.downloadBlob = function (content, filename, type) {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  P.printListing = function (listing) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${listing.name}</title>
      <style>body{font-family:system-ui;padding:2rem;max-width:700px;margin:0 auto}
      h1{color:#0369a1} img{max-width:100%;border-radius:8px}</style></head><body>
      <h1>${listing.name}</h1>
      <p><strong>${listing.area}</strong> • ${listing.category}</p>
      ${listing.image ? `<img src="${listing.image}" alt="">` : ''}
      <p>${listing.description || ''}</p>
      <p>${listing.address || ''}</p>
      <p>${listing.phone || ''} | ${listing.website || ''}</p>
      <p><em>Printed from Upper Room DFW</em></p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  P.exportPDF = function (listing) {
    P.printListing(listing);
  };
})(window);