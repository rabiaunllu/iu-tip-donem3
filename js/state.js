/**
 * İÜ Tıp Fakültesi Dönem 3 — Uygulama Durumu (State) ve Profil Yönetimi
 */

let state = {
  group: '3A',
  subgroup: 'all', // 'all', 'A1'..'A8', 'B1'..'B8'
  currentMonday: getMondayOfDate(new Date(2026, 8, 21)), // 21 Eylül 2026 haftası varsayılan
  showFreeStudy: false,
  searchQuery: '',
  selectedMobileDay: 'auto', // 'auto', 0..4 (Pzt..Cum), or 'all'
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
  const cleanSub = (!subgroup || subgroup.toLowerCase() === 'all') ? 'all' : subgroup.toUpperCase();
  localStorage.setItem('iutip_user_profile', JSON.stringify({ group, subgroup: cleanSub }));
}

function loadUserProfile() {
  // 1. Önce localStorage'dan kayıtlı profili kontrol et
  const saved = localStorage.getItem('iutip_user_profile');
  let hasSavedProfile = false;
  if (saved) {
    try {
      const prof = JSON.parse(saved);
      if (prof.group && (prof.group === '3A' || prof.group === '3B')) {
        state.group = prof.group;
        const rawSub = (prof.subgroup || 'all').trim().toLowerCase();
        state.subgroup = (rawSub === 'all') ? 'all' : prof.subgroup.trim().toUpperCase();
        hasSavedProfile = true;
      }
    } catch (e) {}
  }

  // 2. URL Hash kontrolü: Doğrudan paylaşılan linkle gelinmişse (örn: #3A-A4 veya #3B-B2)
  const rawHash = window.location.hash.replace('#', '').trim();
  if (rawHash) {
    const parts = rawHash.split('-');
    const grp = parts[0] ? parts[0].toUpperCase() : '';
    if (grp === '3A' || grp === '3B') {
      state.group = grp;
      if (parts[1]) {
        const rawSub = parts[1].trim().toLowerCase();
        state.subgroup = (rawSub === 'all') ? 'all' : parts[1].trim().toUpperCase();
        return true; // Belirli bir alt grup linkiyle gelindiğinde onboarding'i atla
      }
      if (!hasSavedProfile) {
        state.subgroup = 'all';
      }
    }
  }

  return hasSavedProfile;
}
