// Upper Room DFW - Local Directory Website
// Fully static, works when you open index.html directly
// Data persists using localStorage

let churches = [];
let savedChurches = new Set();
let currentCategoryFilter = '';
let currentAreaFilter = '';

// Seed data — realistic DFW churches and ministries (based on the spirit of upperroomdfw.com)
const seedData = [
  {
    id: 1,
    name: "The Grove Community Church",
    area: "Arlington",
    category: "Church",
    address: "1425 S Collins St, Arlington, TX 76010",
    phone: "(817) 555-0192",
    email: "hello@thegrovearlington.org",
    website: "https://thegrovearlington.org",
    times: "Sundays 9:00am & 11:00am",
    description: "A vibrant, multi-generational church with powerful worship and deep community. Known for excellent kids and youth ministries.",
    tags: ["Contemporary", "Multi-ethnic", "Youth"],
    image: "https://picsum.photos/id/1015/600/400"
  },
  {
    id: 2,
    name: "The Sanctuary Worship Center",
    area: "Dallas",
    category: "Church",
    address: "3100 S Lancaster Rd, Dallas, TX 75216",
    phone: "(214) 555-8721",
    email: "connect@sanctuarydfw.org",
    website: "https://sanctuarydfw.org",
    times: "Sundays 8:30am & 10:45am | Wednesdays 7pm",
    description: "Historic Dallas congregation focused on authentic worship, prayer, and serving the South Dallas community.",
    tags: ["Traditional", "Prayer", "Outreach"],
    image: "https://picsum.photos/id/1005/600/400"
  },
  {
    id: 3,
    name: "United Faith Chapel",
    area: "Fort Worth",
    category: "Church",
    address: "6100 W 7th St, Fort Worth, TX 76107",
    phone: "(682) 555-3310",
    email: "info@unitedfaithfw.org",
    website: "https://unitedfaithfw.org",
    times: "Sundays 10:00am",
    description: "A warm, welcoming church in the heart of Fort Worth with strong small groups and a heart for families.",
    tags: ["Family", "Small Groups", "Contemporary"],
    image: "https://picsum.photos/id/1016/600/400"
  },
  {
    id: 4,
    name: "Hope & Healing Ministry Center",
    area: "Dallas",
    category: "Ministry",
    address: "2500 McKinney Ave, Dallas, TX 75201",
    phone: "(214) 555-4400",
    email: "care@hopeandhealingdfw.org",
    website: "https://hopeandhealingdfw.org",
    times: "Support groups Tue & Thu evenings",
    description: "Christian counseling, recovery programs, and support groups for grief, addiction, and marriage restoration.",
    tags: ["Counseling", "Recovery", "Support"],
    image: "https://picsum.photos/id/106/600/400"
  },
  {
    id: 5,
    name: "DFW Faith Fest",
    area: "Frisco",
    category: "Event",
    address: "The Star in Frisco • Multiple Venues",
    phone: "(972) 555-0188",
    email: "info@dfwfaithfest.com",
    website: "https://dfwfaithfest.com",
    times: "Annual: March 28-30, 2026",
    description: "The largest multi-church worship and community festival in North Texas. Free concerts, food trucks, kids zone, and outreach.",
    tags: ["Festival", "Worship", "Family"],
    image: "https://picsum.photos/id/201/600/400"
  },
  {
    id: 6,
    name: "Hands of Compassion Outreach",
    area: "Mesquite",
    category: "Outreach",
    address: "Serving East Dallas & Mesquite",
    phone: "(469) 555-7722",
    email: "volunteer@handsofcompassion.org",
    website: "https://handsofcompassion.org",
    times: "Food pantry: Tue & Sat 9am-12pm",
    description: "Mobile food pantry, clothing, and job training. Partners with 27 local churches to serve the homeless and working poor.",
    tags: ["Food Pantry", "Homeless", "Service"],
    image: "https://picsum.photos/id/251/600/400"
  },
  {
    id: 7,
    name: "New Life Fellowship Irving",
    area: "Irving",
    category: "Church",
    address: "1800 W Airport Fwy, Irving, TX 75062",
    phone: "(972) 555-9034",
    email: "office@newlifeirving.org",
    website: "https://newlifeirving.org",
    times: "Sundays 9:30am (English) & 1:00pm (Spanish)",
    description: "Bilingual, multi-ethnic congregation passionate about reaching the diverse Irving community and internationals.",
    tags: ["Bilingual", "Multi-ethnic", "Missions"],
    image: "https://picsum.photos/id/160/600/400"
  },
  {
    id: 8,
    name: "Elevate Youth Dallas",
    area: "Dallas",
    category: "Youth",
    address: "Programs at multiple partner churches",
    phone: "(214) 555-6677",
    email: "hello@elevateyouthdfw.org",
    website: "https://elevateyouthdfw.org",
    times: "Wednesdays 6:30pm + monthly events",
    description: "High-energy, discipleship-focused youth ministry serving 6th–12th graders across North and East Dallas.",
    tags: ["Students", "Discipleship", "Events"],
    image: "https://picsum.photos/id/1009/600/400"
  },
  {
    id: 9,
    name: "Grace Community Church Plano",
    area: "Plano",
    category: "Church",
    address: "5000 Legacy Dr, Plano, TX 75024",
    phone: "(469) 555-2100",
    email: "info@graceplanotx.org",
    website: "https://graceplanotx.org",
    times: "Sundays 9am & 11:15am",
    description: "Contemporary church with excellent production, deep teaching, and a large, welcoming singles and young professionals community.",
    tags: ["Contemporary", "Young Adults", "Teaching"],
    image: "https://picsum.photos/id/180/600/400"
  },
  {
    id: 10,
    name: "The Table Church",
    area: "Fort Worth",
    category: "Church",
    address: "1201 W Magnolia Ave, Fort Worth, TX 76104",
    phone: "(817) 555-8844",
    email: "hello@thetablefw.org",
    website: "https://thetablefw.org",
    times: "Sundays 10:30am",
    description: "A church plant in the Near Southside with a heart for the arts, justice, and beautiful, thoughtful worship.",
    tags: ["Arts", "Justice", "Church Plant"],
    image: "https://picsum.photos/id/29/600/400"
  },
  {
    id: 11,
    name: "Kingdom Builders Network",
    area: "Garland",
    category: "Ministry",
    address: "Garland + Virtual",
    phone: "(972) 555-1209",
    email: "connect@kingdombuildersdfw.org",
    website: "https://kingdombuildersdfw.org",
    times: "Monthly leadership roundtables",
    description: "Network of pastors and leaders across DFW focused on church planting, leadership development, and city-wide impact.",
    tags: ["Leadership", "Pastors", "Planting"],
    image: "https://picsum.photos/id/133/600/400"
  },
  {
    id: 12,
    name: "Restoration House Frisco",
    area: "Frisco",
    category: "Outreach",
    address: "Frisco & surrounding areas",
    phone: "(469) 555-5566",
    email: "info@restorationhousefrisco.org",
    website: "https://restorationhousefrisco.org",
    times: "By appointment + weekly groups",
    description: "Support and housing assistance for women and children escaping domestic violence. Faith-based trauma recovery.",
    tags: ["Women", "Trauma Recovery", "Housing"],
    image: "https://picsum.photos/id/312/600/400"
  },
  {
    id: 13,
    name: "LifePoint Church Richardson",
    area: "Richardson",
    category: "Church",
    address: "1401 E Campbell Rd, Richardson, TX 75081",
    phone: "(972) 555-3000",
    email: "hello@lifepointrichardson.org",
    website: "https://lifepointrichardson.org",
    times: "Sundays 9:00am, 10:45am & 5:00pm",
    description: "Large, modern church known for strong community groups and practical teaching that applies to everyday life.",
    tags: ["Modern", "Community Groups", "Practical"],
    image: "https://picsum.photos/id/177/600/400"
  }
];

// Load data from localStorage or seeds
function loadData() {
  const saved = localStorage.getItem('urdfw_churches');
  if (saved) {
    churches = JSON.parse(saved);
  } else {
    churches = [...seedData];
    localStorage.setItem('urdfw_churches', JSON.stringify(churches));
  }

  const savedSet = localStorage.getItem('urdfw_saved');
  if (savedSet) {
    savedChurches = new Set(JSON.parse(savedSet));
  }
  
  updateSavedCount();
}

// Save churches to localStorage
function saveData() {
  localStorage.setItem('urdfw_churches', JSON.stringify(churches));
}

// Persist saved churches
function saveSaved() {
  localStorage.setItem('urdfw_saved', JSON.stringify(Array.from(savedChurches)));
  updateSavedCount();
}

function updateSavedCount() {
  const el = document.getElementById('saved-count');
  if (el) el.textContent = savedChurches.size;
}

// Render the directory grid
function renderDirectory(filteredChurches) {
  const container = document.getElementById('directory-grid');
  if (!container) return;
  
  container.innerHTML = '';

  if (!filteredChurches || filteredChurches.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center">
        <i class="fa-solid fa-search text-4xl text-slate-300 mb-3"></i>
        <p class="text-lg text-slate-500">No churches match your filters.</p>
        <button onclick="resetFilters()" class="mt-4 text-sm text-indigo-700 hover:underline">Clear all filters</button>
      </div>
    `;
    document.getElementById('results-count').textContent = '0';
    return;
  }

  filteredChurches.forEach(church => {
    const isSaved = savedChurches.has(church.id);
    
    const card = document.createElement('div');
    card.className = `church-card bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col shadow-sm`;
    
    card.innerHTML = `
      <div class="relative h-40 bg-slate-200">
        <img src="${church.image}" class="w-full h-full object-cover" alt="${church.name}">
        <div class="absolute top-3 right-3">
          <span class="px-3 py-px text-[10px] font-bold rounded-full bg-white/95 shadow text-slate-700">${church.area}</span>
        </div>
        <div class="absolute top-3 left-3">
          <span class="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/95 shadow text-indigo-800">${church.category}</span>
        </div>
      </div>
      
      <div class="p-5 flex-1 flex flex-col">
        <div>
          <h3 class="font-semibold text-xl tracking-tight">${church.name}</h3>
          <div class="text-emerald-700 text-xs flex items-center gap-1.5 mt-0.5">
            <i class="fa-solid fa-map-marker-alt"></i>
            <span>${church.address}</span>
          </div>
        </div>
        
        <p class="text-sm text-slate-600 mt-3 line-clamp-3 flex-1">${church.description}</p>
        
        <div class="mt-4 flex flex-wrap gap-1.5">
          ${church.tags.map(t => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-px rounded-full">${t}</span>`).join('')}
        </div>
        
        <div class="flex items-center justify-between gap-2 mt-auto pt-5 border-t border-slate-100">
          <button onclick="showChurchDetail(${church.id})" 
                  class="text-sm font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1">
            View details <i class="fa-solid fa-arrow-right text-xs ml-0.5"></i>
          </button>
          
          <button onclick="toggleSave(${church.id}, event)" 
                  class="text-sm px-3 py-1 rounded-2xl flex items-center gap-1 transition-colors ${isSaved ? 'text-amber-600 bg-amber-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}">
            <i class="fa-solid ${isSaved ? 'fa-bookmark' : 'fa-bookmark'}"></i>
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
  
  document.getElementById('results-count').textContent = filteredChurches.length;
}

// Filtering logic
function filterDirectory(preferredCategory = null) {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
  const areaSelect = document.getElementById('area-filter');
  const area = areaSelect ? areaSelect.value : '';
  
  let filtered = churches;

  if (searchTerm) {
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(searchTerm) ||
      c.description.toLowerCase().includes(searchTerm) ||
      c.tags.join(' ').toLowerCase().includes(searchTerm) ||
      (c.address && c.address.toLowerCase().includes(searchTerm))
    );
  }

  if (area) {
    filtered = filtered.filter(c => c.area === area);
  }

  const activeCat = preferredCategory !== null ? preferredCategory : currentCategoryFilter;
  
  if (activeCat) {
    filtered = filtered.filter(c => c.category === activeCat);
  }

  // sort newest first (higher id = more recently added)
  filtered.sort((a, b) => b.id - a.id);

  renderDirectory(filtered);
}

function setCategoryFilter(btn, category) {
  // Deactivate all
  document.querySelectorAll('#category-filters button').forEach(b => b.classList.remove('active', 'bg-indigo-900', 'text-white'));
  document.querySelectorAll('#category-filters button').forEach(b => b.classList.add('border', 'hover:bg-slate-100'));
  
  // Activate clicked
  btn.classList.add('active', 'bg-indigo-900', 'text-white');
  btn.classList.remove('border', 'hover:bg-slate-100');

  currentCategoryFilter = category;
  filterDirectory();
}

function resetFilters() {
  const search = document.getElementById('search-input');
  const area = document.getElementById('area-filter');
  
  if (search) search.value = '';
  if (area) area.value = '';
  
  currentCategoryFilter = '';
  
  // Reset chip styles
  document.querySelectorAll('#category-filters button').forEach(b => b.classList.remove('active', 'bg-indigo-900', 'text-white'));
  document.querySelectorAll('#category-filters button').forEach(b => b.classList.add('border', 'hover:bg-slate-100'));
  
  const allBtn = document.querySelector('#category-filters button[data-category=""]');
  if (allBtn) allBtn.classList.add('active', 'bg-indigo-900', 'text-white');
  
  filterDirectory();
}

// Church detail modal
function showChurchDetail(id) {
  const church = churches.find(c => c.id === id);
  if (!church) return;

  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  const isSaved = savedChurches.has(id);

  content.innerHTML = `
    <div class="relative">
      <img src="${church.image}" class="w-full h-64 object-cover" alt="${church.name}">
      
      <button onclick="hideDetailModal()" 
              class="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow text-slate-600 hover:text-slate-900">
        <i class="fa-solid fa-times"></i>
      </button>
      
      <div class="absolute top-4 left-4 flex gap-2">
        <span class="px-4 py-1 text-sm font-semibold rounded-3xl bg-white shadow">${church.category}</span>
        <span class="px-4 py-1 text-sm font-semibold rounded-3xl bg-white shadow">${church.area}</span>
      </div>
    </div>

    <div class="p-7">
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-3xl font-semibold tracking-tighter">${church.name}</h2>
          <div class="flex items-center gap-x-2 text-slate-500 mt-1">
            <i class="fa-solid fa-map-marker-alt"></i>
            <span>${church.address}</span>
          </div>
        </div>
        <button onclick="toggleSave(${church.id}, event); renderCurrentDirectory()" 
                class="px-5 h-10 text-sm flex items-center rounded-2xl font-semibold gap-x-2 transition-all ${isSaved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 hover:bg-slate-200'}">
          <i class="fa-solid fa-bookmark"></i>
          <span>${isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
        <div>
          <div class="uppercase tracking-widest text-xs font-semibold text-slate-400 mb-1">Service Times</div>
          <div class="font-medium text-slate-800">${church.times || 'Contact for current times'}</div>
        </div>
        
        <div>
          <div class="uppercase tracking-widest text-xs font-semibold text-slate-400 mb-1">Contact</div>
          <div class="space-y-1">
            ${church.phone ? `<div><i class="fa-solid fa-phone w-4 mr-1.5 text-slate-400"></i> ${church.phone}</div>` : ''}
            ${church.email ? `<div><i class="fa-solid fa-envelope w-4 mr-1.5 text-slate-400"></i> <a href="mailto:${church.email}" class="text-indigo-700">${church.email}</a></div>` : ''}
            ${church.website ? `<div><i class="fa-solid fa-globe w-4 mr-1.5 text-slate-400"></i> <a href="${church.website}" target="_blank" class="text-indigo-700 hover:underline">Visit website</a></div>` : ''}
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div class="uppercase tracking-widest text-xs font-semibold text-slate-400 mb-1.5">About this community</div>
        <p class="text-slate-700 leading-relaxed">${church.description}</p>
      </div>

      <div class="flex flex-wrap gap-2 mt-6">
        ${church.tags.map(tag => `<span class="px-4 py-1 bg-slate-100 text-xs rounded-2xl text-slate-600">${tag}</span>`).join('')}
      </div>

      <div class="mt-8 pt-5 border-t flex flex-wrap gap-3">
        <button onclick="fakeAction('Directions to ${church.name}', '${church.address}'); hideDetailModal()" 
                class="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 font-medium rounded-2xl text-sm flex items-center justify-center gap-x-2">
          <i class="fa-solid fa-directions"></i> <span>Get Directions</span>
        </button>
        
        <button onclick="fakeAction('Contact ${church.name}', 'Thank you! We have opened your email client.'); hideDetailModal()" 
                class="flex-1 sm:flex-none px-6 py-3 bg-indigo-900 hover:bg-indigo-950 text-white font-medium rounded-2xl text-sm flex items-center justify-center gap-x-2">
          <i class="fa-solid fa-paper-plane"></i> <span>Contact Church</span>
        </button>
      </div>
      
      <div class="text-center mt-4">
        <button onclick="hideDetailModal()" class="text-xs text-slate-400 hover:text-slate-500">Close</button>
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function hideDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Toggle save to local "My Saved Churches"
function toggleSave(id, event) {
  if (event) event.stopImmediatePropagation();
  
  if (savedChurches.has(id)) {
    savedChurches.delete(id);
  } else {
    savedChurches.add(id);
  }
  saveSaved();
  
  // Re-render current view
  filterDirectory();
}

// Show saved churches (special filter)
function showSavedChurches() {
  const container = document.getElementById('directory-grid');
  const filtered = churches.filter(c => savedChurches.has(c.id));
  
  // Scroll to directory
  document.getElementById('directory').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  setTimeout(() => {
    container.innerHTML = '';
    
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 border border-dashed border-slate-200 rounded-3xl">
          <i class="fa-solid fa-bookmark text-4xl text-slate-300 mb-4"></i>
          <p class="font-medium text-lg">You haven't saved any churches yet.</p>
          <p class="text-sm text-slate-500 mt-1">Click the bookmark icon on any listing to save it here.</p>
        </div>
      `;
      document.getElementById('results-count').textContent = '0';
      return;
    }
    
    renderDirectory(filtered);
    // temporarily show a note
    const note = document.createElement('div');
    note.className = 'col-span-full -mt-3 mb-1 px-1 text-xs text-amber-600 flex items-center gap-1';
    note.innerHTML = `<i class="fa-solid fa-info-circle"></i> <span>Showing your saved churches. Clear filters to see everything.</span>`;
    container.prepend(note);
  }, 420);
}

// Add new listing
function showAddListingModal() {
  document.getElementById('add-modal').classList.remove('hidden');
  document.getElementById('add-modal').classList.add('flex');
}

function hideAddModal() {
  const modal = document.getElementById('add-modal');
  modal.classList.remove('flex');
  modal.classList.add('hidden');
  // clear form
  const form = document.getElementById('add-listing-form');
  if (form) form.reset();
}

function submitNewListing(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  const newChurch = {
    id: Date.now(),
    name: formData.get('name'),
    area: formData.get('area'),
    category: formData.get('category'),
    address: formData.get('area') + ', TX (exact address on verification)',
    phone: formData.get('phone') || '(Pending verification)',
    email: '',
    website: formData.get('website') || '',
    times: formData.get('times') || 'Contact for current service times',
    description: formData.get('description'),
    tags: [formData.get('category')],
    image: `https://picsum.photos/id/${Math.floor(Math.random() * 300) + 10}/600/400`
  };
  
  churches.unshift(newChurch); // newest first
  saveData();
  
  hideAddModal();
  
  // Refresh directory view
  filterDirectory();
  
  // Toast
  showToast(`Thank you! "${newChurch.name}" has been added to the local directory.`);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-5 right-5 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm shadow-2xl flex items-center gap-x-2 z-[200]`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.parentNode.removeChild(toast), 300);
  }, 3800);
}

// Simple fake action helper
function fakeAction(title, detail) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-6';
  modal.innerHTML = `
    <div class="bg-white max-w-sm w-full rounded-3xl p-7 shadow">
      <div class="text-xl font-semibold mb-2">${title}</div>
      <p class="text-sm text-slate-600">${detail}</p>
      <button onclick="this.closest('.fixed').remove()" class="mt-6 w-full py-3 bg-indigo-900 text-white text-sm font-semibold rounded-2xl">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Render mini featured listings (right side of testimonials)
function renderFeaturedMini() {
  const container = document.getElementById('featured-mini');
  if (!container) return;
  
  const featured = [...churches].sort((a, b) => b.id - a.id).slice(0, 4);
  
  container.innerHTML = featured.map(ch => `
    <div onclick="showChurchDetail(${ch.id})" class="flex gap-4 bg-white border hover:border-indigo-200 rounded-2xl p-3 cursor-pointer items-center transition-colors">
      <div class="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border">
        <img src="${ch.image}" class="w-full h-full object-cover" />
      </div>
      <div class="min-w-0">
        <div class="font-semibold leading-tight line-clamp-2">${ch.name}</div>
        <div class="text-xs text-emerald-700 flex items-center gap-1 mt-0.5"><i class="fa-solid fa-map-marker-alt text-xs"></i> ${ch.area}</div>
      </div>
    </div>
  `).join('');
}

// Render upcoming events section
function renderEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;
  
  const events = churches.filter(c => c.category === 'Event' || c.name.toLowerCase().includes('fest') || c.tags.includes('Festival'));
  
  // If no real events in data, create a couple synthetic ones
  const displayEvents = events.length > 0 ? events : [
    { id: 999, name: "DFW Prayer Night", area: "Dallas", times: "Feb 21 • 7pm", description: "City-wide night of worship and prayer at American Airlines Center area.", image: "https://picsum.photos/id/160/600/400" },
    { id: 998, name: "Family Serve Day", area: "Arlington", times: "March 8 • 9am–1pm", description: "Serve projects across Arlington parks and neighborhoods with 40+ churches.", image: "https://picsum.photos/id/251/600/400" }
  ];
  
  container.innerHTML = displayEvents.map(ev => `
    <div onclick="showChurchDetail(${ev.id})" class="group bg-white border rounded-3xl overflow-hidden cursor-pointer hover:shadow-lg transition">
      <div class="h-44 relative">
        <img src="${ev.image}" class="w-full h-full object-cover group-hover:scale-[1.02] transition" />
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <div class="text-white">
            <div class="font-semibold text-lg tracking-tight">${ev.name}</div>
            <div class="text-xs opacity-90">${ev.area} • ${ev.times}</div>
          </div>
        </div>
      </div>
      <div class="p-4 text-sm text-slate-600 line-clamp-2">
        ${ev.description}
      </div>
      <div class="px-4 pb-4 text-xs flex items-center text-indigo-700 font-medium">
        View details <i class="ml-1 fa-solid fa-chevron-right text-xs"></i>
      </div>
    </div>
  `).join('');
}

// Newsletter (local only)
function subscribeNewsletter(e) {
  e.preventDefault();
  const input = document.getElementById('newsletter-email');
  const email = input.value.trim();
  
  if (!email) return;
  
  // Store in local "subscribers" (just for the demo)
  let subs = JSON.parse(localStorage.getItem('urdfw_subscribers') || '[]');
  if (!subs.includes(email)) subs.push(email);
  localStorage.setItem('urdfw_subscribers', JSON.stringify(subs));
  
  const original = e.target.innerHTML;
  e.target.innerHTML = `<span class="font-semibold">Thank you! You're subscribed.</span>`;
  
  setTimeout(() => {
    showToast(`Welcome! We'll send the next DFW faith digest to ${email}.`);
    input.value = '';
    e.target.innerHTML = original;
  }, 1600);
}

// Mobile nav
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('hidden');
}

// Re-apply current filters (used after saving from modal)
function renderCurrentDirectory() {
  const searchTerm = document.getElementById('search-input')?.value || '';
  filterDirectory();
}

// Initialize everything
function initialize() {
  loadData();
  
  // Initial render of directory
  const initial = [...churches].sort((a, b) => b.id - a.id);
  renderDirectory(initial);
  
  // Wire up live search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterDirectory());
  }
  
  const areaFilter = document.getElementById('area-filter');
  if (areaFilter) {
    areaFilter.addEventListener('change', () => filterDirectory());
  }
  
  // Initial category chip styling
  const allChip = document.querySelector('#category-filters button[data-category=""]');
  if (allChip) allChip.classList.add('active', 'bg-indigo-900', 'text-white');
  
  // Featured mini listings
  renderFeaturedMini();
  
  // Events
  renderEvents();
  
  // Update stat counters (nice touch)
  animateStats();
  
  // Keyboard: "/" focuses search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName === 'BODY') {
      e.preventDefault();
      const s = document.getElementById('search-input');
      if (s) {
        s.focus();
        s.select();
      }
    }
  });
  
  // Show initial saved count
  updateSavedCount();
  
  // Helpful console message
  console.log('%c[Upper Room DFW] Local directory website ready. All data is stored in your browser.', 'color:#64748b');
}

// Very simple count-up animation for the stats bar
function animateStats() {
  const stats = [
    { id: 'stat-churches', target: 142 },
    { id: 'stat-members', target: 12840 },
    { id: 'stat-events', target: 87 },
    { id: 'stat-years', target: 9 }
  ];
  
  stats.forEach(stat => {
    const el = document.getElementById(stat.id);
    if (!el) return;
    
    let current = 0;
    const increment = Math.max(1, Math.ceil(stat.target / 65));
    const timer = setInterval(() => {
      current += increment;
      if (current >= stat.target) {
        current = stat.target;
        clearInterval(timer);
      }
      
      if (stat.target > 1000) {
        el.textContent = Math.floor(current).toLocaleString();
      } else {
        el.textContent = current;
      }
    }, 38);
  });
}

// Boot app
initialize();

// Expose a couple helpers to console for power users
window.URDFW = {
  resetAllData: () => {
    localStorage.removeItem('urdfw_churches');
    localStorage.removeItem('urdfw_saved');
    location.reload();
  },
  listSaved: () => Array.from(savedChurches),
  getAllChurches: () => churches
};