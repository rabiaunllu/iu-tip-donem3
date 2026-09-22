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
      state.selectedMobileDay = 'auto';
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
      updateSelectionBadge(true);
      renderSchedule();
      showToast('Grubun kaydedildi!');
    });
  }

  const btnCloseProf = document.getElementById('btnCloseProfileModal');
  if (btnCloseProf) {
    btnCloseProf.addEventListener('click', () => {
      const modal = document.getElementById('modalProfile');
      if (modal) modal.classList.add('hidden');
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

  // Daha Fazla Menüsü (Dropdown)
  const btnMoreMenu = document.getElementById('btnMoreMenu');
  const dropdownMoreMenu = document.getElementById('dropdownMoreMenu');
  if (btnMoreMenu && dropdownMoreMenu) {
    btnMoreMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMoreMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMoreMenu.contains(e.target) && !btnMoreMenu.contains(e.target)) {
        dropdownMoreMenu.classList.add('hidden');
      }
    });

    dropdownMoreMenu.querySelectorAll('button, a').forEach(el => {
      el.addEventListener('click', () => {
        dropdownMoreMenu.classList.add('hidden');
      });
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
      const fbInp = document.getElementById('settingFeedbackUrl');
      if (amfiInp) amfiInp.value = localStorage.getItem('iutip_url_amfi') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS.amfi.id}/edit#gid=${DEFAULT_CONFIGS.amfi.gid}`;
      if (s3AInp) s3AInp.value = localStorage.getItem('iutip_url_3A') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS['3A'].id}/edit#gid=${DEFAULT_CONFIGS['3A'].gid}`;
      if (s3BInp) s3BInp.value = localStorage.getItem('iutip_url_3B') || `https://docs.google.com/spreadsheets/d/${DEFAULT_CONFIGS['3B'].id}/edit#gid=${DEFAULT_CONFIGS['3B'].gid}`;
      if (fbInp) fbInp.value = localStorage.getItem('iutip_feedback_webhook_url') || DEFAULT_FEEDBACK_WEBHOOK_URL;
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
      localStorage.removeItem('iutip_feedback_webhook_url');
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
      const fbInp = document.getElementById('settingFeedbackUrl');
      if (amfiInp) localStorage.setItem('iutip_url_amfi', amfiInp.value.trim());
      if (s3AInp) localStorage.setItem('iutip_url_3A', s3AInp.value.trim());
      if (s3BInp) localStorage.setItem('iutip_url_3B', s3BInp.value.trim());
      if (fbInp) localStorage.setItem('iutip_feedback_webhook_url', fbInp.value.trim());
      modalSettings.classList.add('hidden');
      showToast('Yeni linkler kaydedildi!');
      loadDatabase().then(renderSchedule);
    });
  }

  // 💬 Geri Bildirim Modalı & Google Sheets Entegrasyonu
  const modalFeedback = document.getElementById('modalFeedback');
  const btnOpenFeedback = document.getElementById('btnOpenFeedbackModal');
  const btnCloseFeedback = document.getElementById('btnCloseFeedbackModal');
  const btnCancelFeedback = document.getElementById('btnCancelFeedback');
  const btnCloseFeedbackSuccess = document.getElementById('btnCloseFeedbackSuccess');
  const formFeedback = document.getElementById('formFeedback');
  const feedbackFormView = document.getElementById('feedbackFormView');
  const feedbackSuccessView = document.getElementById('feedbackSuccessView');
  const feedbackCategoryContainer = document.getElementById('feedbackCategoryContainer');
  const feedbackMessage = document.getElementById('feedbackMessage');
  const feedbackCharCount = document.getElementById('feedbackCharCount');
  const feedbackRelatedGroup = document.getElementById('feedbackRelatedGroup');
  const feedbackHoneypot = document.getElementById('feedbackHoneypot');
  const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');

  const CATEGORY_PLACEHOLDERS = {
    '📅 Ders Programı Hatası': "Örn: Salı günü 13:30'da Kardiyoloji teorik dersi görünmüyor / yerine serbest çalışma vardı...",
    '🩺 Staj / Rotasyon Hatası': "Örn: A4 grubunun bu haftaki Çocuk Cerrahisi rotasyon saati çakışıyor / yer bilgisi uyuşmuyor...",
    '💡 Öneri & Yeni Fikir': "Örn: Boş saatler filtresi seçildiğinde kütüphane çalışma alanları da eklense harika olurdu...",
    '💬 Diğer / Genel': "Görüş, soru veya iletmek istediğiniz detayları buraya yazabilirsiniz..."
  };

  let selectedFeedbackCategory = '📅 Ders Programı Hatası';

  function populateFeedbackGroupOptions() {
    if (!feedbackRelatedGroup) return;
    const currentSub = (!state.subgroup || state.subgroup.toLowerCase() === 'all') ? 'ALL' : state.subgroup.toUpperCase();
    const currentKey = `${state.group}-${currentSub}`;

    const groups = [
      { key: '3A-ALL', label: 'Dönem 3A — Tüm Sınıf (Genel)' },
      { key: '3A-A1', label: 'Dönem 3A — Grup A1' },
      { key: '3A-A2', label: 'Dönem 3A — Grup A2' },
      { key: '3A-A3', label: 'Dönem 3A — Grup A3' },
      { key: '3A-A4', label: 'Dönem 3A — Grup A4' },
      { key: '3A-A5', label: 'Dönem 3A — Grup A5' },
      { key: '3A-A6', label: 'Dönem 3A — Grup A6' },
      { key: '3A-A7', label: 'Dönem 3A — Grup A7' },
      { key: '3A-A8', label: 'Dönem 3A — Grup A8' },
      { key: '3B-ALL', label: 'Dönem 3B — Tüm Sınıf (Genel)' },
      { key: '3B-B1', label: 'Dönem 3B — Grup B1' },
      { key: '3B-B2', label: 'Dönem 3B — Grup B2' },
      { key: '3B-B3', label: 'Dönem 3B — Grup B3' },
      { key: '3B-B4', label: 'Dönem 3B — Grup B4' },
      { key: '3B-B5', label: 'Dönem 3B — Grup B5' },
      { key: '3B-B6', label: 'Dönem 3B — Grup B6' },
      { key: '3B-B7', label: 'Dönem 3B — Grup B7' },
      { key: '3B-B8', label: 'Dönem 3B — Grup B8' },
      { key: 'ALL-GENEL', label: 'Genel / Tüm Dönem 3 (3A & 3B)' }
    ];

    feedbackRelatedGroup.innerHTML = groups.map(g => {
      const isSelected = g.key === currentKey;
      return `<option value="${g.label}" ${isSelected ? 'selected' : ''}>${g.label} ${isSelected ? '★ (Seçili Profilin)' : ''}</option>`;
    }).join('');
  }

  function resetFeedbackForm() {
    if (feedbackFormView) feedbackFormView.classList.remove('hidden');
    if (feedbackSuccessView) feedbackSuccessView.classList.add('hidden');
    if (feedbackMessage) {
      feedbackMessage.value = '';
      feedbackMessage.placeholder = CATEGORY_PLACEHOLDERS['📅 Ders Programı Hatası'];
    }
    if (feedbackHoneypot) feedbackHoneypot.value = '';
    if (feedbackCharCount) feedbackCharCount.innerText = '0 / 1000';
    if (btnSubmitFeedback) {
      btnSubmitFeedback.disabled = false;
      btnSubmitFeedback.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Gönder</span>`;
    }
    selectedFeedbackCategory = '📅 Ders Programı Hatası';
    if (feedbackCategoryContainer) {
      feedbackCategoryContainer.querySelectorAll('.feedback-cat-btn').forEach(btn => {
        if (btn.dataset.cat === selectedFeedbackCategory) {
          btn.className = 'feedback-cat-btn flex items-center gap-2 p-2.5 rounded-xl border text-left font-semibold transition-all border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-2xs ring-1 ring-indigo-500/20';
        } else {
          btn.className = 'feedback-cat-btn flex items-center gap-2 p-2.5 rounded-xl border text-left font-semibold transition-all border-slate-200 hover:border-slate-300 text-slate-700 bg-white';
        }
      });
    }
    if (window.lucide) lucide.createIcons();
  }

  if (btnOpenFeedback && modalFeedback) {
    btnOpenFeedback.addEventListener('click', () => {
      populateFeedbackGroupOptions();
      resetFeedbackForm();
      modalFeedback.classList.remove('hidden');
    });
  }

  const closeFeedbackModal = () => {
    if (modalFeedback) modalFeedback.classList.add('hidden');
  };

  if (btnCloseFeedbackModal) btnCloseFeedbackModal.addEventListener('click', closeFeedbackModal);
  if (btnCancelFeedback) btnCancelFeedback.addEventListener('click', closeFeedbackModal);
  if (btnCloseFeedbackSuccess) btnCloseFeedbackSuccess.addEventListener('click', closeFeedbackModal);

  // Kategori Butonları Seçimi
  if (feedbackCategoryContainer) {
    feedbackCategoryContainer.querySelectorAll('.feedback-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFeedbackCategory = btn.dataset.cat || '💬 Diğer / Genel';
        feedbackCategoryContainer.querySelectorAll('.feedback-cat-btn').forEach(b => {
          b.className = 'feedback-cat-btn flex items-center gap-2 p-2.5 rounded-xl border text-left font-semibold transition-all border-slate-200 hover:border-slate-300 text-slate-700 bg-white';
        });
        btn.className = 'feedback-cat-btn flex items-center gap-2 p-2.5 rounded-xl border text-left font-semibold transition-all border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-2xs ring-1 ring-indigo-500/20';

        if (feedbackMessage) {
          feedbackMessage.placeholder = CATEGORY_PLACEHOLDERS[selectedFeedbackCategory] || 'Mesajınızı buraya yazabilirsiniz...';
        }
      });
    });
  }

  // Karakter Sayacı
  if (feedbackMessage && feedbackCharCount) {
    feedbackMessage.addEventListener('input', () => {
      const len = feedbackMessage.value.length;
      feedbackCharCount.innerText = `${len} / 1000`;
      if (len > 900) {
        feedbackCharCount.className = 'text-[11px] text-amber-600 font-bold';
      } else {
        feedbackCharCount.className = 'text-[11px] text-slate-400';
      }
    });
  }

  // Form Gönderimi (Savunmacı Mühendislik: Rate-limit + Honeypot + Fetch)
  async function submitFeedback() {
    // 1. Bot Kapanı (Honeypot) Kontrolü
    if (feedbackHoneypot && feedbackHoneypot.value.trim() !== '') {
      resetFeedbackForm();
      closeFeedbackModal();
      return;
    }

    // 2. Karakter Doğrulaması
    const msg = feedbackMessage ? feedbackMessage.value.trim() : '';
    if (msg.length < 10) {
      showToast('Lütfen en az 10 karakterlik bir açıklama yazınız.');
      if (feedbackMessage) feedbackMessage.focus();
      return;
    }

    // 3. İstemci Hız Sınırı (Rate-Limit: 5 dakika)
    const lastSent = localStorage.getItem('iutip_feedback_last_sent');
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000;
    if (lastSent && (now - parseInt(lastSent, 10) < cooldownMs)) {
      const remainingMin = Math.ceil((cooldownMs - (now - parseInt(lastSent, 10))) / 60000);
      showToast(`Yeni bir bildirim için lütfen ${remainingMin} dakika bekleyiniz.`);
      return;
    }

    const isAll = !state.subgroup || state.subgroup.toLowerCase() === 'all';
    const groupInfo = feedbackRelatedGroup && feedbackRelatedGroup.value
      ? feedbackRelatedGroup.value
      : (isAll ? `Dönem ${state.group} — Tüm Sınıf` : `Dönem ${state.group} — Grup ${state.subgroup.toUpperCase()}`);
    const webhookUrl = localStorage.getItem('iutip_feedback_webhook_url') || DEFAULT_FEEDBACK_WEBHOOK_URL;

    if (btnSubmitFeedback) {
      btnSubmitFeedback.disabled = true;
      btnSubmitFeedback.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span><span>Gönderiliyor...</span>`;
    }

    try {
      if (webhookUrl && webhookUrl.startsWith('http')) {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            category: selectedFeedbackCategory,
            groupInfo: groupInfo,
            message: msg,
            contact: 'Anonim',
            botCheck: ''
          })
        });
      }
      
      localStorage.setItem('iutip_feedback_last_sent', now.toString());
      if (feedbackFormView) feedbackFormView.classList.add('hidden');
      if (feedbackSuccessView) feedbackSuccessView.classList.remove('hidden');
      showToast('Geri bildiriminiz iletildi!');
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Feedback submit error:', err);
      showToast('Bildirim gönderilirken bir hata oluştu, lütfen tekrar deneyin.');
      if (btnSubmitFeedback) {
        btnSubmitFeedback.disabled = false;
        btnSubmitFeedback.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Gönder</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  if (formFeedback) {
    formFeedback.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFeedback();
    });
  }

  if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', (e) => {
      e.preventDefault();
      submitFeedback();
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
    const hadExistingController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Sekme odaklandığında arka planda güncelleme kontrolü
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });

      // Yeni bir service worker yüklendiğinde
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && hadExistingController) {
              console.log('Yeni Service Worker versiyonu hazır.');
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
      // İlk ziyarette veya kullanıcı henüz grup seçerken sayfayı yenileyip modalı kapatma!
      const modalProf = document.getElementById('modalProfile');
      const isModalOpen = modalProf && !modalProf.classList.contains('hidden');
      if (!hadExistingController || isModalOpen) {
        return;
      }
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

  // Uygulama telefonda zaten yüklüyse (iOS/Android Standalone mod) "Telefona Yükle" butonunu gizle
  function checkAndHideInstalledPwa() {
    const isStandalone = window.navigator.standalone === true ||
                         window.matchMedia('(display-mode: standalone)').matches ||
                         window.matchMedia('(display-mode: fullscreen)').matches ||
                         localStorage.getItem('iutip_pwa_installed') === 'true';

    if (isStandalone && btnPwa) {
      btnPwa.classList.add('hidden');
      localStorage.setItem('iutip_pwa_installed', 'true');
    }
  }
  checkAndHideInstalledPwa();

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    if (btnPwa) btnPwa.classList.add('hidden');
    localStorage.setItem('iutip_pwa_installed', 'true');
    showToast('Uygulama başarıyla kuruldu!');
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
      showToast('İnternet bağlantısı yok. Aktif ders programı çevrimdışı kullanımda.');
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
  updateSelectionBadge(false);

  await loadDatabase();
  renderSchedule();

  // Eğer daha önce hiç grup seçmemişse onboarding modalını aç
  if (!hasProfile) {
    openProfileModal();
  }
});
