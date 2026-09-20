/**
 * İÜ Tıp Fakültesi Dönem 3 — Uygulama Durumu (State) ve Profil Yönetimi
 */

let state = {
  group: '3A',
  subgroup: 'all', // 'all', 'A1'..'A8', 'B1'..'B8'
  currentMonday: getMondayOfDate(new Date(2026, 8, 21)), // 21 Eylül 2026 haftası varsayılan
  showFreeStudy: false,
  searchQuery: '',
  db: null, // schedule_2026_2027.json
  cacheData: {
    amfi: null,
    '3A': null,
    '3B': null
  }
};

// Modal profil geçici seçimi
let profileModalSelection = {
  group: '3A',
  subgroup: 'all'
};

function saveUserProfile(group, subgroup) {
  localStorage.setItem('iutip_user_profile', JSON.stringify({ group, subgroup }));
}

function loadUserProfile() {
  // 1. URL Hash kontrolü: #3A-A3 gibi
  const hash = window.location.hash.replace('#', '').trim().toUpperCase();
  if (hash) {
    const parts = hash.split('-');
    if (parts.length >= 1 && (parts[0] === '3A' || parts[0] === '3B')) {
      state.group = parts[0];
      state.subgroup = parts[1] || 'all';
      return true;
    }
  }

  // 2. localStorage kontrolü
  const saved = localStorage.getItem('iutip_user_profile');
  if (saved) {
    try {
      const prof = JSON.parse(saved);
      if (prof.group) state.group = prof.group;
      if (prof.subgroup) state.subgroup = prof.subgroup;
      return true;
    } catch (e) {}
  }

  return false; // Hiç profil yoksa modal açılacak
}
