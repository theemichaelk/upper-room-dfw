/**
 * Category 5: Maps — OSM, Google, MapBox, markers, multi-directory
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.mapInstances = {};

  P.getTileLayer = function (provider) {
    provider = provider || P.mapProvider;
    if (provider === 'google') {
      return L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
        className: 'map-tiles google-tiles',
      });
    }
    if (provider === 'mapbox') {
      const style = localStorage.getItem('urdfw_mapbox_style') || 'streets-v11';
      return L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=pk.demo`, {
        tileSize: 512, zoomOffset: -1, attribution: '© Mapbox',
        className: 'map-tiles mapbox-tiles',
      });
    }
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      className: 'map-tiles',
    });
  };

  P.createMap = function (containerId, options) {
    options = options || {};
    const el = document.getElementById(containerId);
    if (!el || !global.L) return null;

    if (P.mapInstances[containerId]) {
      P.mapInstances[containerId].remove();
    }

    const map = L.map(containerId, { zoomControl: true }).setView(
      options.center || [32.78, -96.9],
      options.zoom || 10
    );
    P.getTileLayer(options.provider).addTo(map);
    P.mapInstances[containerId] = map;

    if (options.searchControl !== false) {
      const searchDiv = L.control({ position: 'topright' });
      searchDiv.onAdd = function () {
        const div = L.DomUtil.create('div', 'bg-white p-2 rounded shadow text-xs');
        div.innerHTML = '<input id="map-search-box" placeholder="Search on map..." class="border px-2 py-1 rounded w-36">';
        L.DomEvent.disableClickPropagation(div);
        setTimeout(() => {
          const inp = document.getElementById('map-search-box');
          if (inp) inp.oninput = P.debounce(() => {
            P.searchState.keywords = inp.value;
            P.emit('search:change', P.searchState);
          }, 200);
        }, 100);
        return div;
      };
      searchDiv.addTo(map);
    }

    P.on('map:provider', () => {
      map.eachLayer((l) => { if (l instanceof L.TileLayer) map.removeLayer(l); });
      P.getTileLayer().addTo(map);
    });

    return map;
  };

  P.addListingMarkers = function (map, listings, options) {
    if (!map) return [];
    options = options || {};
    const markers = [];
    const iconColors = { featured: '#f59e0b', sticky: '#7c3aed', vip: '#dc2626', default: '#0369a1' };

    listings.forEach((ch) => {
      if (!ch.lat || !ch.lng) return;
      const color = ch.vip ? iconColors.vip : ch.sticky ? iconColors.sticky : ch.featured ? iconColors.featured : iconColors.default;
      const icon = L.divIcon({
        className: 'urdfw-marker',
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const m = L.marker([ch.lat, ch.lng], { icon, title: ch.name }).addTo(map);
      m.churchId = ch.id;
      const popup = `
        <div class="min-w-[200px] text-sm">
          <strong>${ch.name}</strong>${ch.featured ? ' <span class="badge-featured">Featured</span>' : ''}
          <br><span class="text-xs text-slate-500">${ch.area} • ${(ch.rating || 0).toFixed(1)}★</span>
          <div class="mt-2 flex gap-1">
            <a href="churches/${ch.slug}.html" class="text-xs px-2 py-1 bg-[#0369a1] text-white rounded">Profile</a>
          </div>
        </div>`;
      m.bindPopup(popup);
      markers.push(m);
    });
    return markers;
  };

  P.filterByDirectory = function (listings, directoryId) {
    if (!directoryId || directoryId === 'dfw-churches') return listings.filter((l) => l.category === 'Church' || !l.category);
    if (directoryId === 'dfw-ministries') return listings.filter((l) => ['Ministry', 'Outreach', 'Youth'].includes(l.category));
    if (directoryId === 'dfw-events') return listings.filter((l) => l.category === 'Event');
    return listings;
  };
})(window);