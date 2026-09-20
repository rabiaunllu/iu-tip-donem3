/**
 * İÜ Tıp Fakültesi Dönem 3 — Ana Uygulama Başlatıcı ve Olay Dinleyicileri
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Profil kontrolü
  const hasProfile = loadUserProfile();

  // Sekmeler (3A / 3B)
  const tab3A = document.getElementById('tab3A');
  const tab3B = document.getElementById('tab3B');
  if (tab3A) tab3A.addEventListener('click', () => setGroup('3A'));
  if (tab3B) tab3B.addEventListener('click', () => setGroup('3B'));

  // Hafta Navigasyonu
  const btnPrev = document.getElementById('btnPrevWeek');
  const btnNext = document.getElementById('btnNextWeek');
  if (btnPrev) btnPrev.addEventListener('click', () => changeWeek(-1));
  if (btnNext) btnNext.addEventListener('click', () => changeWeek(1));

  const btnCurrentWeek = document.getElementById('btnCurrentWeekNow');
  if (btnCurrentWeek) {
    btnCurrentWeek.addEventListener('click', () => {
      state.currentMonday = getMondayOfDate(new Date());
      renderSchedule();
    });
  }

  const btnQuick21 = document.getElementById('btnQuick21Eylul');
  if (btnQuick21) {
    btnQuick21.addEventListener('click', () => {
      state.currentMonday = new Date(2026, 8, 21);
      renderSchedule();
    });
  }

  // Boş saatler toggle
  const toggleFree = document.getElementById('toggleFreeStudy');
  if (toggleFree) {
    toggleFree.addEventListener('change', (e) => {
      state.showFreeStudy = e.target.checked;
      renderSchedule();
    });
  }

  // Arama kutusu
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderSchedule();
    });
  }

  // WhatsApp Kopyala
  const btnWhatsapp = document.getElementById('btnCopyWhatsapp');
  if (btnWhatsapp) btnWhatsapp.addEventListener('click', copyWhatsAppText);

  // PDF İndir / Yazdır Butonu
  const btnPrint = document.getElementById('btnPrintPdf');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // Profil Modalı İşlemleri
  const btnOpenProf = document.getElementById('btnOpenProfileModal');
  if (btnOpenProf) btnOpenProf.addEventListener('click', openProfileModal);

  const btnProf3A = document.getElementById('btnProfile3A');
  if (btnProf3A) {
    btnProf3A.addEventListener('click', () => {
      profileModalSelection.group = '3A';
      profileModalSelection.subgroup = 'all';
      updateProfileModalUI();
    });
  }

  const btnProf3B = document.getElementById('btnProfile3B');
  if (btnProf3B) {
    btnProf3B.addEventListener('click', () => {
      profileModalSelection.group = '3B';
      profileModalSelection.subgroup = 'all';
      updateProfileModalUI();
    });
  }

  const btnSaveProf = document.getElementById('btnSaveProfile');
  if (btnSaveProf) {
    btnSaveProf.addEventListener('click', () => {
      state.group = profileModalSelection.group;
      state.subgroup = profileModalSelection.subgroup;
      saveUserProfile(state.group, state.subgroup);
      const modal = document.getElementById('modalProfile');
      if (modal) modal.classList.add('hidden');
      renderSubgroupButtons();
      updateSelectionBadge();
      renderSchedule();
      showToast('Grubun kaydedildi!');
    });
  }

  // Yenile Butonu
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await loadDatabase();
      renderSchedule();
      showToast('Program güncellendi!');
    });
  }

  // Ayarlar Modalı
  const modalSettings = document.getElementById('modalSettings');
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings && modalSettings) {
    btnSettings.addEventListener('click', () => {
      const amfiInp = document.getElementById('settingAmfiUrl');
      const s3AInp = document.getElementById('setting3AUrl');
      const s3BInp = document.getElementById('setting3BUrl');
      if (amfiInp) amfiInp.value = localStorage.getItem('iutip_url_amfi') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS.amfi.id}/edit#gid=${DEFAULT_CONFIGS.amfi.gid}`;
      if (s3AInp) s3AInp.value = localStorage.getItem('iutip_url_3A') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS['3A'].id}/edit#gid=${DEFAULT_CONFIGS['3A'].gid}`;
      if (s3BInp) s3BInp.value = localStorage.getItem('iutip_url_3B') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS['3B'].id}/edit#gid=${DEFAULT_CONFIGS['3B'].gid}`;
      modalSettings.classList.remove('hidden');
    });
  }

  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal && modalSettings) {
    btnCloseModal.addEventListener('click', () => modalSettings.classList.add('hidden'));
  }

  const btnResetSettings = document.getElementById('btnResetSettings');
  if (btnResetSettings && modalSettings) {
    btnResetSettings.addEventListener('click', () => {
      localStorage.removeItem('iutip_url_amfi');
      localStorage.removeItem('iutip_url_3A');
      localStorage.removeItem('iutip_url_3B');
      showToast('Varsayılan linkler geri yüklendi.');
      modalSettings.classList.add('hidden');
      loadDatabase().then(renderSchedule);
    });
  }

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings && modalSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const amfiInp = document.getElementById('settingAmfiUrl');
      const s3AInp = document.getElementById('setting3AUrl');
      const s3BInp = document.getElementById('setting3BUrl');
      if (amfiInp) localStorage.setItem('iutip_url_amfi', amfiInp.value.trim());
      if (s3AInp) localStorage.setItem('iutip_url_3A', s3AInp.value.trim());
      if (s3BInp) localStorage.setItem('iutip_url_3B', s3BInp.value.trim());
      modalSettings.classList.add('hidden');
      showToast('Yeni linkler kaydedildi!');
      loadDatabase().then(renderSchedule);
    });
  }

  // PWA Service Worker Kaydı
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW kaydı başarısız:', err);
    });
  }

  // Başlatma Sırası
  renderSubgroupButtons();
  updateSelectionBadge();

  await loadDatabase();
  renderSchedule();

  // Eğer daha önce hiç grup seçmemişse onboarding modalını aç
  if (!hasProfile) {
    openProfileModal();
  }
});
