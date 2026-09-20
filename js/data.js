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

function matchAmfi(amfiData, gunStr, basSaat, groupLetter) {
  if (!amfiData) return null;
  const gLower = (gunStr || '').toLowerCase();
  let norm = null;
  for (const k of Object.keys(amfiData)) {
    if (k === 'cuma' && gLower.includes('cumartesi')) continue;
    if (gLower.includes(k) || k.includes(gLower)) {
      norm = k;
      break;
    }
  }
  if (!norm || !amfiData[norm]) return null;

  const saatKey = basSaat.replace(':', '.');
  const slot = amfiData[norm][saatKey];
  if (!slot) return null;

  const tags = groupLetter === 'A'
    ? ['3A', 'A GRUBU', 'DÖNEM 3-TÜRKÇE-A', 'DÖNEM 3-A']
    : ['3B', 'B GRUBU', 'DÖNEM 3- B GRUBU', 'DÖNEM 3-B'];

  for (const [amfi, desc] of Object.entries(slot)) {
    const du = desc.toUpperCase();
    if (tags.some(t => du.includes(t))) return amfi;
  }
  for (const [amfi, desc] of Object.entries(slot)) {
    const du = desc.toUpperCase();
    if (du.includes('DÖNEM 3') && (du.includes('TÜRKÇE') || du.includes('ORTAK')) && !du.includes('3A') && !du.includes('3B')) {
      return amfi + ' (Ortak)';
    }
  }
  return null;
}
