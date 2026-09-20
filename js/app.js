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
      localStorage.removeItem('iutip_disclaimer_dismissed');
      const bannerDisclaimer = document.getElementById('bannerDisclaimer');
      if (bannerDisclaimer) bannerDisclaimer.classList.remove('hidden');
      showToast('Varsayılan ayarlar ve linkler geri yüklendi.');
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

  // Doktor Bilgilendirme Notu (Şeffaf / Kapatılabilir)
  const bannerDisclaimer = document.getElementById('bannerDisclaimer');
  const btnDismissDisclaimer = document.getElementById('btnDismissDisclaimer');
  if (bannerDisclaimer) {
    const isDismissed = localStorage.getItem('iutip_disclaimer_dismissed');
    if (!isDismissed) {
      bannerDisclaimer.classList.remove('hidden');
    }
    if (btnDismissDisclaimer) {
      btnDismissDisclaimer.addEventListener('click', () => {
        bannerDisclaimer.classList.add('hidden');
        localStorage.setItem('iutip_disclaimer_dismissed', 'true');
      });
    }
  }

  // PWA Service Worker Kaydı & Otomatik Yenileme (Cache-Busting)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Sekme odaklandığında arka planda güncelleme kontrolü
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });

      // Yeni bir service worker yüklendiğinde kullanıcıyı bilgilendir
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Uygulama güncellendi! Yenileniyor...');
              setTimeout(() => {
                window.location.reload();
              }, 1200);
            }
          });
        }
      });
    }).catch(err => {
      console.log('SW kaydı başarısız:', err);
    });

    // Yeni SW kontrolü devraldığında temiz yenileme
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // PWA Yükleme & Kurulum Modalı
  const modalPwa = document.getElementById('modalPwaInstall');
  const btnPwa = document.getElementById('btnPwaInstall');
  const btnClosePwa = document.getElementById('btnClosePwaModal');
  const btnDismissPwa = document.getElementById('btnDismissPwaModal');
  const btnNative = document.getElementById('btnNativeInstall');

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  if (btnPwa && modalPwa) {
    btnPwa.addEventListener('click', () => {
      modalPwa.classList.remove('hidden');
    });
  }

  if (btnClosePwa && modalPwa) {
    btnClosePwa.addEventListener('click', () => modalPwa.classList.add('hidden'));
  }
  if (btnDismissPwa && modalPwa) {
    btnDismissPwa.addEventListener('click', () => modalPwa.classList.add('hidden'));
  }

  if (btnNative) {
    btnNative.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Uygulama başarıyla kuruldu!');
          if (modalPwa) modalPwa.classList.add('hidden');
        }
        deferredInstallPrompt = null;
      } else {
        showToast('Tarayıcı menüsünden "Ana Ekrana Ekle"yi seçebilirsiniz.');
      }
    });
  }

  // Canlı Ağ Durumu Dinleyicileri (Online / Offline)
  function updateNetworkStatus() {
    const statusElem = document.getElementById('liveStatusText');
    if (!statusElem) return;
    if (navigator.onLine) {
      statusElem.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Güncel Program
      `;
    } else {
      statusElem.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        Çevrimdışı (Kayıtlı Program)
      `;
      showToast('İnternet bağlantısı yok. Çevrimdışı yerel veritabanı aktif.');
    }
  }

  window.addEventListener('online', () => {
    updateNetworkStatus();
    showToast('İnternet bağlantısı sağlandı.');
  });
  window.addEventListener('offline', () => {
    updateNetworkStatus();
  });

  if (!navigator.onLine) {
    updateNetworkStatus();
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
