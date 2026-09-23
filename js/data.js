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
  const KNOWN_END_TIMES = {
    '3A_2026-09-25_11:50': '12:30',
    '3A_2026-12-24_11:00': '11:40',
    '3A_2027-06-03_13:00': '14:20'
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;
    const dateStr = (r[1] || '').trim();
    const iso = toISOFromStr(dateStr);
    if (!iso) continue;

    const start = (r[2] || '').trim();
    let end = (r[3] || '').trim();
    const subject = (r[4] || '').trim();
    const patchKey = `${state.group}_${iso}_${start}`;
    if (!end && KNOWN_END_TIMES[patchKey]) {
      end = KNOWN_END_TIMES[patchKey];
    }

    // Mükerrer boş satır filtresi
    if (subject) {
      for (let j = lectures.length - 1; j >= 0; j--) {
        if (lectures[j].date === iso && lectures[j].start === start && !lectures[j].subject) {
          lectures.splice(j, 1);
        }
      }
    } else if (lectures.some(l => l.date === iso && l.start === start)) {
      continue;
    }

    // FIX-21: Canlı Google Sheet'ten çekilen satırlarda diğer şubeye ait jenerik lab satırlarını filtrele
    const su = subject.toUpperCase();
    if (su.includes('PATOLOJ') && (su.includes('MİKROBİYOLOJ') || su.includes('MIKROBIYOLOJ') || su.includes('UYGULAMA'))) {
      const labs = state.db && state.db.laboratories ? state.db.laboratories : null;
      if (labs && labs[iso]) {
        const groupLetter = state.group === '3A' ? 'A' : 'B';
        const dayLabs = labs[iso];
        const hasMyLab = dayLabs.some(l => l.groups && l.groups.some(g => g.startsWith(groupLetter)));
        if (!hasMyLab) {
          // Bu laboratuvar seansı diğer şube içindir; öğrenci programını yanıltıcı kartla kirletme
          continue;
        }
      }
    }

    lectures.push({
      date: iso,
      date_str: dateStr,
      start,
      end,
      subject,
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
          const val = (row[c] || '').trim();
          const amfi = currentHeaders[c];
          if (val && amfi) daysMap[currentDay][bas][amfi] = val;
        }
      }
    }
  }
  return daysMap;
}

function normalizeAmfiName(rawName) {
  if (!rawName) return 'Resmi Amfi Portalı';
  if (/kemal\s*atay/i.test(rawName)) return 'Kemal Atay Amfisi';
  if (/az[iİıI]z\s*sancar/i.test(rawName)) return 'Aziz Sancar Amfisi';
  if (/tevf[iİıI]k\s*sa[ğg]lam/i.test(rawName)) return 'Tevfik Sağlam Amfisi';
  if (/sam[iİıI]\s*zan/i.test(rawName)) return 'Sami Zan Amfisi';
  if (/cem[iİıI]l\s*topuzlu/i.test(rawName)) return 'Cemil Topuzlu Amfisi';
  if (/muzaffer\s*aksoy/i.test(rawName)) return 'Muzaffer Aksoy Amfisi';
  if (/temel\s*b[iİıI]l[iİıI]mler/i.test(rawName)) return 'Temel Bilimler Amfi III';
  if (/esk[iİıI]\s*f[iİıI]z[iİıI]k/i.test(rawName)) return 'Eski Fizik Tedavi Dersliği';
  return rawName.trim();
}

function findAmfiFromLiveSchedule(dayLower, startHour, groupName) {
  if (!state.cacheData || !state.cacheData.amfi) return null;
  const amfiSchedule = state.cacheData.amfi;
  if (typeof amfiSchedule !== 'object' || Object.keys(amfiSchedule).length === 0) return null;

  let matchedDayKey = null;
  for (const dk of Object.keys(amfiSchedule)) {
    if (dayLower.includes(dk) || dk.includes(dayLower)) {
      matchedDayKey = dk;
      break;
    }
  }
  if (!matchedDayKey) return null;

  const dayData = amfiSchedule[matchedDayKey];
  if (!dayData || typeof dayData !== 'object') return null;

  const cleanHour = (startHour || '').replace(':', '.');
  const targetHour = cleanHour.startsWith('0') ? cleanHour.substring(1) : cleanHour;
  const groupPattern = groupName === '3A'
    ? /(3\s*A|DÖNEM\s*3\s*-\s*TÜRKÇE\s*-\s*A|DÖNEM\s*3\s*A|3A)/i
    : /(3\s*B|DÖNEM\s*3\s*-\s*TÜRKÇE\s*-\s*B|DÖNEM\s*3\s*B|3B)/i;

  // 1. Saat bazlı eşleşme ara
  for (const [hourKey, amfiMap] of Object.entries(dayData)) {
    const hNorm = hourKey.replace(':', '.');
    const hClean = hNorm.startsWith('0') ? hNorm.substring(1) : hNorm;
    if (hClean === targetHour || (targetHour && hClean.startsWith(targetHour.split('.')[0]))) {
      for (const [amfiName, cellVal] of Object.entries(amfiMap)) {
        if (groupPattern.test(cellVal)) {
          return normalizeAmfiName(amfiName);
        }
      }
    }
  }

  // 2. Gün geneli amfi eşleşmesi ara
  for (const amfiMap of Object.values(dayData)) {
    if (typeof amfiMap === 'object') {
      for (const [amfiName, cellVal] of Object.entries(amfiMap)) {
        if (groupPattern.test(cellVal)) {
          return normalizeAmfiName(amfiName);
        }
      }
    }
  }

  return null;
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

  // 4. CANLI / SON DAKİKA AMFİ DEĞİŞİKLİĞİ ÖNCELİĞİ:
  // Hoca veya dekanlık Google E-Tablo'da dersin "Yer" sütununa spesifik bir amfi adı yazmışsa,
  // bu canlı bilgi statik gün dağılımından DAHA ÖNCELİKLİDİR (Hoca 5dk önce değiştirse bile yakalanır)!
  // Türkçe i/ı harf duyarsız regex eşleşmesi kullanılır.
  const amfiKeywords = [
    { pattern: /kemal\s*atay/i, name: 'Kemal Atay Amfisi' },
    { pattern: /sam[iİıI]\s*zan/i, name: 'Sami Zan Amfisi' },
    { pattern: /az[iİıI]z\s*sancar/i, name: 'Aziz Sancar Amfisi' },
    { pattern: /tevf[iİıI]k\s*sa[ğg]lam/i, name: 'Tevfik Sağlam Amfisi' },
    { pattern: /cem[iİıI]l\s*topuzlu/i, name: 'Cemil Topuzlu Amfisi' },
    { pattern: /muzaffer\s*aksoy/i, name: 'Muzaffer Aksoy Amfisi' },
    { pattern: /temel\s*b[iİıI]l[iİıI]mler/i, name: 'Temel Bilimler Amfi III' },
    { pattern: /esk[iİıI]\s*f[iİıI]z[iİıI]k/i, name: 'Eski Fizik Tedavi Dersliği' }
  ];

  for (const item of amfiKeywords) {
    if (item.pattern.test(rawLoc)) {
      return { name: item.name, isKnown: true, isLiveOverride: true };
    }
  }

  // 5. CANLI ÇEKİLEN AMFİ E-TABLOSU (state.cacheData.amfi):
  if (state.cacheData && state.cacheData.amfi) {
    const liveAmfi = findAmfiFromLiveSchedule(gLower, startHour, groupName);
    if (liveAmfi) {
      return { name: liveAmfi, isKnown: true, isLiveSchedule: true };
    }
  }

  // 6. Fakülte resmi amfi tablosundan doğrulanmış gün bazlı amfi dağılımı (Pazartesi, Salı, Perşembe, Cuma)
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

  // 1.1 Öğle Arası / Tatili
  const isLunch = /ÖĞLE\s*TAT[İI]L[İI]|OGLE\s*TATIL|YEMEK\s*ARASI/i.test(s);
  if (isLunch) {
    return {
      cardType: 'free',
      badge: 'Öğle Arası',
      resolvedLocation: '🍽️ Öğle Arası / Serbest Zaman',
      note: ''
    };
  }

  // 1.2 Resmi Tatiller / Bayramlar (Soyadı BAYRAM olan akademisyenler hariç)
  const hasAcademicTitle = /Prof\.?\s*Dr|Doç\.?\s*Dr|Doc\.?\s*Dr|Dr\.?\s*Öğr|Dr\.?\s*Ogr|Uzm\.?\s*Dr|Doktor|\bDr\b/i.test(s);
  const isHoliday = !hasAcademicTitle && (/BAYRAM|AR[İI]FE|YARIYIL\s*TAT[İI]L[İI]|YILBA[ŞS]I|RESM[İI]\s*TAT[İI]L/i.test(s) || /29\s*EK[İI]M|23\s*N[İI]SAN|19\s*MAYIS|15\s*TEMMUZ|1\s*MAYIS/i.test(s));
  if (isHoliday) {
    return {
      cardType: 'holiday',
      badge: 'Resmi Tatil',
      resolvedLocation: '🏖️ Resmi Tatil (Ders Yapılmayacaktır)',
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

    // 8. Öğretim Üyesi Uygulama (11:10 - 12:10 Dilim Rotasyonları veya Münferit Grup Pratikleri)
    if (/Öğretim\s+üyesi\s+Uygulama/i.test(s)) {
      // Başlıkta doğrudan belirtilen münferit alt grup var mı? (ör: "Öğretim üyesi Uygulama 2   -  B2")
      const inlineGrpMatch = s.match(/-\s*([AB][1-8])/i);
      if (inlineGrpMatch) {
        const targetGrp = inlineGrpMatch[1].toUpperCase();
        const dept = (lec.department || 'Klinik Bilimler').trim();
        if (subgroup === targetGrp) {
          return {
            cardType: 'practice',
            badge: 'Uygulama',
            resolvedLocation: `🔬 ${dept} (Grup ${targetGrp})`,
            note: `Öğr. Üyesi Uygulaması: ${dept} (Grup ${targetGrp})`
          };
        } else if (subgroup !== 'all') {
          return {
            cardType: 'free',
            badge: 'Boş',
            resolvedLocation: `Dinlenme / Bireysel Çalışma (Sadece Grup ${targetGrp} Pratiği)`,
            note: `Bu oturum sadece Grup ${targetGrp} içindir.`
          };
        } else {
          return {
            cardType: 'practice',
            badge: 'Uygulama',
            resolvedLocation: `🔬 ${dept} (Sadece Grup ${targetGrp})`,
            note: `Öğr. Üyesi Uygulaması: ${dept} (Grup ${targetGrp})`
          };
        }
      }

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
  const isLiveAmfi = !!(amfiInfo.isLiveOverride || amfiInfo.isLiveSchedule);
  let resolvedLocation = `🏛️ ${amfiInfo.name}`;
  if (isLiveAmfi) {
    resolvedLocation = `🏛️ ${amfiInfo.name} <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1 inline-flex items-center gap-0.5">⚡ Canlı Amfi</span>`;
  } else if (amfiInfo.isPortal) {
    resolvedLocation = `<a href="${amfiInfo.url}" target="_blank" rel="noopener" class="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1 font-semibold">🏛️ ${amfiInfo.name} <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i></a>`;
  }

  const badge = amfiInfo.isSecmeli ? 'Seçmeli' : 'Teorik';
  const note = amfiInfo.isSecmeli
    ? 'Farklı amfilerde seçtiğiniz derse göre dağılım yapılır'
    : (isLiveAmfi ? '✓ Canlı kaynaktan teyit edilen güncel amfi' : '');

  return {
    cardType: 'theory',
    badge,
    resolvedLocation,
    note,
    isLiveAmfi
  };
}

