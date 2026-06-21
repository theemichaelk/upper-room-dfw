/**
 * Category 4: Custom fields, form builder, shortcode params
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.getCustomFields = function () {
    return P.get('custom_fields', [
      { id: 'pastor', label: 'Lead Pastor', type: 'text', categories: ['Church'], icon: 'fa-user' },
      { id: 'capacity', label: 'Seating Capacity', type: 'number', categories: ['Church'], icon: 'fa-users' },
      { id: 'bilingual', label: 'Bilingual Services', type: 'checkbox', categories: ['Church'], icon: 'fa-language' },
      { id: 'youtube', label: 'YouTube Channel', type: 'youtube', categories: ['Church', 'Ministry'], icon: 'fa-brands fa-youtube' },
      { id: 'denomination_detail', label: 'Denomination Detail', type: 'select', options: ['Baptist', 'Methodist', 'Non-denominational', 'Catholic', 'Anglican'], categories: ['Church'], icon: 'fa-church' },
    ]);
  };

  P.saveCustomFields = function (fields) {
    P.set('custom_fields', fields);
  };

  P.getFieldsForCategory = function (category) {
    return P.getCustomFields().filter((f) => !f.categories?.length || f.categories.includes(category));
  };

  P.renderFieldInput = function (field, value) {
    const v = value || '';
    const icon = field.icon ? `<i class="fa-solid ${field.icon} mr-1 text-slate-400"></i>` : '';
    switch (field.type) {
      case 'textarea': return `${icon}<textarea name="${field.id}" class="w-full border rounded px-3 py-2 text-sm" rows="2">${v}</textarea>`;
      case 'select': return `${icon}<select name="${field.id}" class="w-full border rounded px-3 py-2 text-sm">${(field.options || []).map((o) => `<option ${v === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      case 'checkbox': return `<label class="flex items-center gap-2 text-sm">${icon}<input type="checkbox" name="${field.id}" ${v ? 'checked' : ''}> ${field.label}</label>`;
      case 'youtube': return `${icon}<input name="${field.id}" value="${v}" placeholder="https://youtube.com/..." class="w-full border rounded px-3 py-2 text-sm">`;
      default: return `${icon}<input name="${field.id}" value="${v}" type="${field.type === 'number' ? 'number' : 'text'}" class="w-full border rounded px-3 py-2 text-sm" placeholder="${field.label}">`;
    }
  };

  P.generateShortcode = function (type, params) {
    const pairs = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
    const attr = pairs.map(([k, v]) => `${k}="${String(v).replace(/"/g, '')}"`).join(' ');
    return `[urdfw_${type}${attr ? ' ' + attr : ''}]`;
  };

  P.parseShortcodeParams = function () {
    return {
      type: ['listings', 'map', 'categories', 'locations', 'search', 'slider', 'button', 'featured'],
      count: [1, 3, 5, 10, 20],
      category: ['Church', 'Ministry', 'Youth', 'Outreach', 'Event'],
      area: ['Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Frisco'],
      layout: ['grid', 'list', 'slider'],
      height: ['300', '400', '500'],
      zoom: ['8', '10', '12'],
      featured: ['true', 'false'],
      sticky: ['true', 'false'],
      radius: ['10', '25', '50'],
      sort: ['rating', 'distance', 'name', 'featured'],
      template: P.templates?.single || [],
      color: ['#0369a1', '#0c4a6e', '#0284c7'],
      columns: [1, 2, 3, 4],
    };
  };

  P.initDragDrop = function (containerId, onReorder) {
    const zone = document.getElementById(containerId);
    if (!zone) return;
    let dragEl = null;
    zone.querySelectorAll('.dd-item').forEach((item) => {
      item.draggable = true;
      item.ondragstart = () => { dragEl = item; item.classList.add('dragging'); };
      item.ondragend = () => item.classList.remove('dragging');
    });
    zone.ondragover = (e) => { e.preventDefault(); };
    zone.ondrop = (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const after = [...zone.querySelectorAll('.dd-item:not(.dragging)')].find((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (after) zone.insertBefore(dragEl, after);
      else zone.appendChild(dragEl);
      if (onReorder) onReorder([...zone.querySelectorAll('.dd-item')].map((el) => el.dataset.id));
    };
  };
})(window);