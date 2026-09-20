/**
 * İÜ Tıp Fakültesi Dönem 3 — Veri Yükleme ve Senkronizasyon (Offline First + Google Sheets)
 */

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
      
      const statusElem = document.getElementById('liveStatusText');
      if (statusElem) {
        statusElem.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Doğrulanmış Fakülte Veritabanı
        `;
      }
      return;
    }
  } catch (err) {
    console.warn('Dahili JSON okunamadı, canlı bağlantı denenecek:', err);
  }

  // 2. Canlı Google Sheet JSONP bağlantısı
  await fetchLiveSheets();
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

    const statusElem = document.getElementById('liveStatusText');
    if (statusElem) {
      statusElem.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Canlı E-Tablo Bağlantısı (${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})
      `;
    }
  } catch (e) {
    console.error(e);
    showError('Tablo verileri çekilemedi: ' + e.message);
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
  const subjectUpper = (lec.subject || '').toUpperCase();
  const locationUpper = (lec.location_raw || '').toUpperCase();
  const gLower = (gunStr || '').toLowerCase().trim();

  // 1. Ortak / Özel ders konu kontrolleri
  if (subjectUpper.includes('BİYOİSTATİSTİK') || subjectUpper.includes('BIOISTATISTIK')) {
    return { name: 'Kemal Atay Amfisi (Ortak Ders)', isKnown: true };
  }
  if (subjectUpper.includes('ORTAK DERS') || subjectUpper.includes('TÜM DÖNEM 3')) {
    return { name: 'Kemal Atay Amfisi (Ortak Ders)', isKnown: true };
  }
  if (subjectUpper.includes('İNGİLİZCE TIP') || subjectUpper.includes('INGILIZCE TIP')) {
    return { name: 'Cemil Topuzlu Amfisi (Ortak)', isKnown: true };
  }

  // 2. Fakülte resmi amfi tablosundan doğrulanmış gün bazlı amfi dağılımı
  const weeklyMap = (state.db && state.db.amfi_default && state.db.amfi_default.weekly_mapping)
    ? state.db.amfi_default.weekly_mapping[groupName]
    : {
        '3A': {
          'pazartesi': 'Kemal Atay Amfisi',
          'salı': 'Aziz Sancar Amfisi',
          'çarşamba': 'Aziz Sancar Amfisi',
          'perşembe': 'Tevfik Sağlam Amfisi',
          'cuma': 'Tevfik Sağlam Amfisi'
        },
        '3B': {
          'pazartesi': 'Aziz Sancar Amfisi',
          'salı': 'Kemal Atay Amfisi',
          'çarşamba': 'Kemal Atay Amfisi',
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

  // 3. Eğer konum metninde bilinen bir amfi adı doğrudan yazıyorsa
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

  // 4. Kesin bilinmeyen durumlarda asla yanlış tahmin yapma; doğrudan resmi portala yönlendir
  return {
    name: 'Resmi Amfi Portalı (Kontrol Ediniz)',
    url: 'https://ogrenci-istanbultip.istanbul.edu.tr/tr/content/amfi-programi/amfi-programi',
    isPortal: true
  };
}
