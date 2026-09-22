/**
 * İÜ Tıp Fakültesi Dönem 3 — Veri Yükleme ve Senkronizasyon (Offline First + Google Sheets)
 */

// Son canlı güncelleme zamanını takip et
let _lastLiveUpdate = null;

async function loadDatabase() {
  showLoading(true);
  hideError();

  try {
    // 1. Önce dahili JSON dosyasını çekmeyi dene (Offline / Hızlı)
    const resp = await fetch('./data/schedule_2026_2027.json').catch(() => null);
    if (resp && resp.ok) {
      const db = await resp.json();
      state.db = db;
      state.cacheData['3A'] = db.lectures_3A || [];
      state.cacheData['3B'] = db.lectures_3B || [];
      state.cacheData.amfi = db.amfi_default || {};
      
      _updateStatusText('Güncel Program', 'emerald');

      // ★ CANLI KONTROL: JSON yüklendikten sonra arka planda Google Sheets'i kontrol et
      // Son dakika amfi değişiklikleri (hoca 5dk önce değiştirse bile) böylece yakalanır
      setTimeout(() => {
        fetchLiveSheets().then(() => {
          if (typeof renderSchedule === 'function') renderSchedule();
          _updateStatusText(`Canlı Kontrol (${_formatTime()})`, 'emerald');
          _showLiveUpdateBanner('✓ Program canlı kaynaktan kontrol edildi');
        }).catch(() => {
          // Offline ise sessizce geç — JSON verisi zaten yüklü
          _updateStatusText('Çevrimdışı — Kayıtlı Program', 'amber');
        });
      }, 500); // Sayfa render'ını bloklamadan 500ms sonra başla

      return;
    }
  } catch (err) {
    console.warn('Dahili JSON okunamadı, canlı bağlantı denenecek:', err);
  }

  // 2. Canlı Google Sheet JSONP bağlantısı
  await fetchLiveSheets();
}

/**
 * ★ Yenile butonu için — doğrudan canlı Google Sheets'ten çeker.
 * loadDatabase()'den farklı olarak JSON'a bakmaz, her zaman Sheets'e gider.
 */
async function refreshFromLiveSheets() {
  showLoading(true);
  hideError();
  try {
    await fetchLiveSheets();
    _lastLiveUpdate = new Date();
    _updateStatusText(`Canlı Güncellendi (${_formatTime()})`, 'emerald');
    if (typeof renderSchedule === 'function') renderSchedule();
    showLoading(false);
    return true;
  } catch (e) {
    showLoading(false);
    showError('Canlı veri çekilemedi: ' + e.message);
    return false;
  }
}

function _formatTime() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function _updateStatusText(text, color) {
  const statusElem = document.getElementById('liveStatusText');
  if (statusElem) {
    const dotColor = color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : 'bg-slate-400';
    statusElem.innerHTML = `
      <span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span>
      ${text}
    `;
  }
}

/**
 * Arka plan canlı güncelleme tamamlandığında kısa süre bildirim banner'ı gösterir.
 * 4 saniye sonra otomatik gizlenir.
 */
function _showLiveUpdateBanner(message) {
  const banner = document.getElementById('liveUpdateBanner');
  const bannerText = document.getElementById('liveUpdateBannerText');
  if (!banner) return;
  if (bannerText) bannerText.textContent = message;
  banner.classList.remove('hidden');
  // Lucide ikonlarını güncelle (yeni eklenen ikon için)
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons({ nodes: [banner] });
  }
  // 4 saniye sonra gizle
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 4000);
}

function fetchSheetJSONP(conf) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gviz_cb_' + Math.random().toString(36).substring(2, 9);
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Zaman aşımı. İnternet bağlantınızı kontrol edin.'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(data) {
      cleanup();
      if (!data || !data.table || !data.table.rows) {
        reject(new Error('Google Tablosu geçersiz formatta.'));
        return;
      }
      const rows = [];
      if (data.table.cols) {
        rows.push(data.table.cols.map(c => c ? (c.label || '') : ''));
      }
      for (const r of data.table.rows) {
        const vals = [];
        for (const cell of (r.c || [])) {
          vals.push(cell ? (cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : (cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '')) : '');
        }
        rows.push(vals);
      }
      resolve(rows);
    };

    script.src = `https://docs.google.com/spreadsheets/d/${conf.id}/gviz/tq?gid=${conf.gid}&tqx=responseHandler:${callbackName}&_t=${Date.now()}`;
    script.onerror = function() {
      cleanup();
      reject(new Error('Google E-Tabloya erişilemedi.'));
    };

    document.head.appendChild(script);
  });
}

async function fetchLiveSheets() {
  try {
    const amfiConf = parseSheetLink(localStorage.getItem('iutip_url_amfi'), DEFAULT_CONFIGS.amfi);
    const groupConf = parseSheetLink(localStorage.getItem('iutip_url_' + state.group), DEFAULT_CONFIGS[state.group]);

    const [amfiRows, rawGroupRows] = await Promise.all([
      fetchSheetJSONP(amfiConf),
      fetchSheetJSONP(groupConf)
    ]);

    state.cacheData.amfi = parseAmfiSchedule(amfiRows);
    state.cacheData[state.group] = normalizeRawSheetRows(rawGroupRows);
    _lastLiveUpdate = new Date();

    _updateStatusText(`Canlı E-Tablo (${_formatTime()})`, 'emerald');
  } catch (e) {
    console.error(e);
    showError('Tablo verileri çekilemedi: ' + e.message);
    throw e; // refreshFromLiveSheets'in catch'ine düşsün
  }
}

function normalizeRawSheetRows(rows) {
  const lectures = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;
    const dateStr = (r[1] || '').trim();
    const iso = toISOFromStr(dateStr);
    if (!iso) continue;
    lectures.push({
      date: iso,
      date_str: dateStr,
      start: (r[2] || '').trim(),
      end: (r[3] || '').trim(),
      subject: (r[4] || '').trim(),
      department: (r[5] || '').trim(),
      location_raw: (r[6] || '').trim()
    });
  }
  return lectures;
}

function parseAmfiSchedule(rows) {
  const daysMap = {};
  let currentDay = null;
  let currentHeaders = [];
  const dayKeywords = ['cumartesi', 'cuma', 'pazartesi', 'salı', 'sali', 'çarşamba', 'carsamba', 'perşembe', 'persembe', 'pazar'];

  for (const row of rows) {
    const line = row.join(' ').toLowerCase();
    let matched = null;
    for (const dk of dayKeywords) {
      if (line.includes(dk) && (line.includes('eyl') || line.includes('ekim') || line.includes('kas') || line.includes('ara') || line.includes('202') || line.includes('/'))) {
        matched = dk;
        break;
      }
    }
    if (matched) {
      currentDay = matched;
      currentHeaders = [];
      daysMap[currentDay] = daysMap[currentDay] || {};
      continue;
    }

    if ((row[0] || '').toUpperCase().includes('SAAT')) {
      currentHeaders = row;
      continue;
    }

    if (currentDay && currentHeaders.length > 0 && row.length > 1) {
      const saatRaw = (row[0] || '').trim();
      if (/\d/.test(saatRaw)) {
        const bas = saatRaw.split(/[-–]/)[0].trim().replace(':', '.');
        daysMap[currentDay][bas] = daysMap[currentDay][bas] || {};
        for (let c = 1; c < Math.min(row.length, currentHeaders.length); c++) {
          const val = row[c].trim();
          const amfi = currentHeaders[c];
          if (val && amfi) daysMap[currentDay][bas][amfi] = val;
        }
      }
    }
  }
  return daysMap;
}

function resolveLectureAmfi(lec, gunStr, groupName) {
  const s = (lec.subject || '').trim();
  const rawLoc = (lec.location_raw || '').trim();
  const g = (gunStr || '').trim();
  const gLower = g.toLowerCase();
  const startHour = normalizeTime(lec.start);
  const isAfternoon = startHour >= '13:00';

  // 1. Ortak / Özel ders konu kontrolleri
  if (/b[iİı]yo[iİı]stat[iİı]st[iİı]k/i.test(s) || /ortak\s*ders|tüm\s*dönem\s*3/i.test(s)) {
    return { name: 'Kemal Atay Amfisi (Ortak Ders)', isKnown: true };
  }
  if (/ingilizce\s*tıp|i̇ngilizce\s*tıp/i.test(s)) {
    return { name: 'Cemil Topuzlu Amfisi (Ortak)', isKnown: true };
  }

  // 2. Seçmeli Dersler (Çarşamba Öğleden Sonraları)
  if (/(seçmeli|secmeli)\s*ders/i.test(s) || /(seçmeli|secmeli)\s*ders/i.test(rawLoc)) {
    return {
      name: 'Seçmeli Derslikleri (Öğrenci Portalı)',
      url: 'https://ogrenci-istanbultip.istanbul.edu.tr/tr/content/amfi-programi/amfi-programi',
      isPortal: true,
      isSecmeli: true
    };
  }

  // 3. Çarşamba Günü Amfi Değişimi (Öğleden Önce / Sonra Ayrımı - Tüm Yıl İçin Genel Kural)
  if (/çarşamba|carsamba/i.test(g)) {
    if (groupName === '3A') {
      const name = isAfternoon ? 'Kemal Atay Amfisi' : 'Aziz Sancar Amfisi';
      return { name, isKnown: true };
    } else if (groupName === '3B') {
      const name = isAfternoon ? 'Sami Zan Amfisi' : 'Kemal Atay Amfisi';
      return { name, isKnown: true };
    }
  }

  // 4. Fakülte resmi amfi tablosundan doğrulanmış gün bazlı amfi dağılımı (Pazartesi, Salı, Perşembe, Cuma)
  const weeklyMap = (state.db && state.db.amfi_default && state.db.amfi_default.weekly_mapping)
    ? state.db.amfi_default.weekly_mapping[groupName]
    : {
        '3A': {
          'pazartesi': 'Kemal Atay Amfisi',
          'salı': 'Aziz Sancar Amfisi',
          'perşembe': 'Tevfik Sağlam Amfisi',
          'cuma': 'Tevfik Sağlam Amfisi'
        },
        '3B': {
          'pazartesi': 'Aziz Sancar Amfisi',
          'salı': 'Kemal Atay Amfisi',
          'perşembe': 'Sami Zan Amfisi',
          'cuma': 'Aziz Sancar Amfisi'
        }
      }[groupName];

  if (weeklyMap) {
    for (const [dayKey, amfiName] of Object.entries(weeklyMap)) {
      if (dayKey === 'cuma' && gLower.includes('cumartesi')) continue;
      if (gLower.includes(dayKey) || dayKey.includes(gLower)) {
        return { name: amfiName, isKnown: true };
      }
    }
  }

  // 5. Eğer konum metninde bilinen bir amfi adı doğrudan yazıyorsa
  // FIX-3: locationUpper değişkeni rawLoc'tan türetilmelidir (önceki kod tanımsızdı → ReferenceError)
  const locationUpper = rawLoc.toUpperCase();
  const amfiKeywords = [
    { key: 'KEMAL ATAY', name: 'Kemal Atay Amfisi' },
    { key: 'SAMİ ZAN', name: 'Sami Zan Amfisi' },
    { key: 'AZİZ SANCAR', name: 'Aziz Sancar Amfisi' },
    { key: 'TEVFİK SAĞLAM', name: 'Tevfik Sağlam Amfisi' },
    { key: 'CEMİL TOPUZLU', name: 'Cemil Topuzlu Amfisi' },
    { key: 'MUZAFFER AKSOY', name: 'Muzaffer Aksoy Amfisi' },
    { key: 'TEMEL BİLİMLER', name: 'Temel Bilimler Amfi III' },
    { key: 'ESKİ FİZİK TEDAVİ', name: 'Eski Fizik Tedavi Dersliği' }
  ];

  for (const item of amfiKeywords) {
    if (locationUpper.includes(item.key)) {
      return { name: item.name, isKnown: true };
    }
  }

  // 6. Kesin bilinmeyen durumlarda asla yanlış tahmin yapma; doğrudan resmi portala yönlendir
  return {
    name: 'Resmi Amfi Portalı (Kontrol Ediniz)',
    url: 'https://ogrenci-istanbultip.istanbul.edu.tr/tr/content/amfi-programi/amfi-programi',
    isPortal: true
  };
}

/**
 * Hasta Başı Uygulama dersinin konu başlığındaki klinik kısaltmasını (İç H. / ÇSvH)
 * öğrencinin bulunduğu gruba (3A / 3B) göre kesin olarak çözer.
 */
function parseHastaBasiDepartment(subject, groupName) {
  if (!subject) return '🏥 Klinik Servisler (Hasta Başı Viziti)';
  const s = subject.replace(/B\s*GrubuÇSvH/gi, 'B Grubu (ÇSvH)');
  const groupLetter = (groupName === '3A') ? 'A' : 'B';

  const pattern = new RegExp(`${groupLetter}\\s*Grubu\\s*\\(?\\s*([^()]+)\\)?`, 'i');
  const match = s.match(pattern);
  if (match && match[1]) {
    const raw = match[1].trim().toUpperCase();
    if (raw.includes('İÇ') || raw.includes('IC') || raw.includes('DAHİL') || raw.includes('DAHIL')) {
      return '🏥 İç Hastalıkları (Dahiliye) Klinik Servisleri';
    }
    if (raw.includes('ÇSVH') || raw.includes('CSVH') || raw.includes('ÇOCUK') || raw.includes('COCUK')) {
      return '🏥 Çocuk Sağlığı ve Hastalıkları (Pediatri) Klinik Servisleri';
    }
    return `🏥 ${match[1].trim()} Klinik Servisleri`;
  }

  // Kaynak verideki yazım hataları için fallback (örn. 'A' harfi unutulup 'Grubu (ÇSvH) B Grubu (İç H.)' yazılması)
  if (groupLetter === 'A') {
    const otherMatch = s.match(/B\s*Grubu\s*\(?\s*([^()]+)\)?/i);
    if (otherMatch && otherMatch[1]) {
      const otherRaw = otherMatch[1].toUpperCase();
      if (otherRaw.includes('İÇ') || otherRaw.includes('IC') || otherRaw.includes('DAHİL')) {
        return '🏥 Çocuk Sağlığı ve Hastalıkları (Pediatri) Klinik Servisleri';
      }
      if (otherRaw.includes('ÇSVH') || otherRaw.includes('CSVH') || otherRaw.includes('ÇOCUK')) {
        return '🏥 İç Hastalıkları (Dahiliye) Klinik Servisleri';
      }
    }
  } else if (groupLetter === 'B') {
    const otherMatch = s.match(/A\s*Grubu\s*\(?\s*([^()]+)\)?/i);
    if (otherMatch && otherMatch[1]) {
      const otherRaw = otherMatch[1].toUpperCase();
      if (otherRaw.includes('İÇ') || otherRaw.includes('IC') || otherRaw.includes('DAHİL')) {
        return '🏥 Çocuk Sağlığı ve Hastalıkları (Pediatri) Klinik Servisleri';
      }
      if (otherRaw.includes('ÇSVH') || otherRaw.includes('CSVH') || otherRaw.includes('ÇOCUK')) {
        return '🏥 İç Hastalıkları (Dahiliye) Klinik Servisleri';
      }
    }
  }

  return '🏥 Klinik Servisler (Hasta Başı Viziti)';
}

/**
 * Dersin amfi, klinik servis, laboratuvar veya rotasyon konumunu
 * alt grup, gün ve ders türüne göre kesin olarak çözümler.
 */
function resolveLectureDetails(lec, gun, group, subgroup, rotations) {
  const s = (lec.subject || '').trim();
  const su = s.toUpperCase();
  const rawLoc = (lec.location_raw || '').toUpperCase();
  const iso = lec.date || '';

  // 1. Serbest Çalışma / Dinlenme
  const isFree = !s || su === 'SERBEST ÇALIŞMA';
  if (isFree) {
    return {
      cardType: 'free',
      badge: 'Boş',
      resolvedLocation: 'Dinlenme / Bireysel Çalışma',
      note: ''
    };
  }

  // 2. Teorik Ders Yanılgı Koruması
  // "Tıpta uygulamaları" veya "laboratuvar tanı yöntemleri" amfide işlenen teorik derslerdir; klinik pratik değildir.
  const isTheoryFalsePositive =
    su.includes('TIPTA UYGULAMALARI') ||
    su.includes('TEMEL KURALLAR') ||
    (su.includes('LABORATUVAR') && !su.includes('PATOLOJ') && !su.includes('MİKROBİYOLOJ') && !su.includes('MIKROBIYOLOJ')) ||
    su.includes('LABORATUAR');

  if (!isTheoryFalsePositive) {
    // 3. Hasta Başı Uygulama (Dahiliye & Pediatri klinikleri)
    if (su.includes('HASTA BAŞI') || su.includes('HASTABAŞI')) {
      const loc = parseHastaBasiDepartment(s, group);
      return {
        cardType: 'hospital',
        badge: 'Hasta Başı',
        resolvedLocation: loc,
        note: 'Klinik Servis Hasta Başı Viziti'
      };
    }

    // 4. Bilimsel Araştırma Uygulamaları (1..16)
    if (su.includes('BİLİMSEL ARAŞTIRMA') || su.includes('BILIMSEL ARASTIRMA')) {
      return {
        cardType: 'practice',
        badge: 'Araştırma',
        resolvedLocation: '📚 Biyoistatistik & Proje Danışmanı (Dönem Amfisi)',
        note: 'Akademik Araştırma & Proje Çalışması'
      };
    }

    // 5. Simüle Hasta Pratikleri
    if (su.includes('SİMÜLE HASTA') || su.includes('SIMULE HASTA')) {
      let simLoc = '🩺 Tıp Eğitimi AD — Simüle Hasta & Beceri Laboratuvarı';
      if (rawLoc.includes('KÜTÜPHANE') || rawLoc.includes('KUTUPHANE')) {
        simLoc = '🏛️ Hulusi Behçet Kütüphanesi (Simüle Hasta Eğitimi)';
      }
      return {
        cardType: 'practice',
        badge: 'Simüle Hasta',
        resolvedLocation: simLoc,
        note: 'Klinik Beceri ve Anamnez Simülasyonu'
      };
    }

    // 6. Uygulama Sınavları
    if (su.includes('UYGULAMA SINAVI') || su.includes('UYGULAMA BÜTÜNLEME')) {
      return {
        cardType: 'practice',
        badge: 'Sınav',
        resolvedLocation: '📝 İlgili Anabilim Dalları / Sınav Salonları',
        note: 'Uygulama Sınavı'
      };
    }

    // 7. Patoloji / Mikrobiyoloji Laboratuvar Pratiği
    if (su.includes('PATOLOJ') && (su.includes('MİKROBİYOLOJ') || su.includes('MIKROBIYOLOJ'))) {
      return {
        cardType: 'practice',
        badge: 'Laboratuvar',
        resolvedLocation: '🧫 Temel Bilimler Öğrenci Laboratuvarı',
        note: 'Tıbbi Patoloji & Tıbbi Mikrobiyoloji Pratiği'
      };
    }

    // 8. Öğretim Üyesi Uygulama (11:10 - 12:10 Dilim Rotasyonları)
    if (/Öğretim\s+üyesi\s+Uygulama/i.test(s)) {
      const dayRot = rotations ? rotations[iso] : null;
      if (subgroup !== 'all' && dayRot && dayRot[subgroup]) {
        const dept = dayRot[subgroup];
        return {
          cardType: 'practice',
          badge: 'Uygulama',
          resolvedLocation: `🔬 ${dept} Anabilim Dalı`,
          note: `Öğr. Üyesi Uygulaması: ${dept} (Grup ${subgroup})`
        };
      } else {
        return {
          cardType: 'practice',
          badge: 'Uygulama',
          resolvedLocation: '🔬 Klinik Dilim Rotasyonu (Detay İçin Alt Grubunuzu Seçiniz)',
          note: 'Dilim Rotasyonları (8 Anabilim Dalı)'
        };
      }
    }

    // 9. Hasta İzlem / Klinik Servisler
    if (su.includes('HASTA İZLEM') || su.includes('HASTA IZLEM') || rawLoc.includes('ANABİLİM DALLARI')) {
      return {
        cardType: 'hospital',
        badge: 'Hasta İzlem',
        resolvedLocation: '🏥 Klinik Servisler (Hasta İzlem)',
        note: 'Klinik Hasta İzlem Viziti'
      };
    }
  }

  // 10. Teorik Ders — Gün ve ders amfisi eşleme
  const amfiInfo = resolveLectureAmfi(lec, gun, group);
  let resolvedLocation = `🏛️ ${amfiInfo.name}`;
  if (amfiInfo.isPortal) {
    resolvedLocation = `<a href="${amfiInfo.url}" target="_blank" rel="noopener" class="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1 font-semibold">🏛️ ${amfiInfo.name} <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i></a>`;
  }

  const badge = amfiInfo.isSecmeli ? 'Seçmeli' : 'Teorik';
  const note = amfiInfo.isSecmeli ? 'Farklı amfilerde seçtiğiniz derse göre dağılım yapılır' : '';

  return {
    cardType: 'theory',
    badge,
    resolvedLocation,
    note
  };
}

