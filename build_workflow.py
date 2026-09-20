import json

# JavaScript code for Tarih & Ayarlar
code_date = """// 21 - 25 Eylül 2026 haftası
return [{
  json: {
    haftaBaslangic: '2026-09-21',
    haftaBitis: '2026-09-25',
    amfiSheetUrl: 'https://docs.google.com/spreadsheets/d/1uCfBw8_mRI47Am2SrijTiOYP71jl1ZWatu26sXrJLJw/gviz/tq?tqx=out:csv&gid=917709856',
    chatId3A: 'BURAYA_CHAT_ID',
    chatId3B: 'BURAYA_CHAT_ID'
  }
}];"""

# JavaScript code for Eşleştirici & Formatlayıcı (Otomatik Parçalama - Telegram 4096 Karakter Sınırı Çözümü)
code_matcher = """// 1. ÖNCEKİ DÜĞÜMLERDEN VERİLERİ AL
const prev = $('💾 3B\\'yi Sakla').item.json;
const csv3A = prev.csv3A || '';
const csv3B = prev.csv3B || '';
const amfiCSV = ($input.item.json && $input.item.json.data) ? $input.item.json.data : '';
const haftaBas = prev.haftaBaslangic;
const haftaBit = prev.haftaBitis;
const chatId3A = prev.chatId3A;
const chatId3B = prev.chatId3B;

// 2. CSV PARSER (Çift tırnak ve virgülleri güvenle ayırır)
function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\\r?\\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const vals = [];
    let cur = '';
    let inQuote = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') inQuote = !inQuote;
      else if (c === ',' && !inQuote) {
        vals.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    vals.push(cur.trim());
    rows.push(vals);
  }
  return rows;
}

// 3. AMFİ PROGRAMI PARSER
const amfiRows = parseCSV(amfiCSV);
const daysMap = {};
let currentDay = null;
let currentAmfiHeaders = [];

const dayKeywords = ['cumartesi', 'cuma', 'pazartesi', 'salı', 'sali', 'çarşamba', 'carsamba', 'perşembe', 'persembe', 'pazar'];

for (const row of amfiRows) {
  const lineFull = row.join(' ').toLowerCase();
  
  let matchedDay = null;
  for (const dk of dayKeywords) {
    if (lineFull.includes(dk) && (lineFull.includes('eyl') || lineFull.includes('ekim') || lineFull.includes('kas') || lineFull.includes('ara') || lineFull.includes('oca') || lineFull.includes('şub') || lineFull.includes('mar') || lineFull.includes('nis') || lineFull.includes('may') || lineFull.includes('haz') || lineFull.includes('tem') || lineFull.includes('ağu') || lineFull.includes('202') || lineFull.includes('/'))) {
      matchedDay = dk;
      break;
    }
  }
  
  if (matchedDay) {
    currentDay = matchedDay;
    currentAmfiHeaders = [];
    daysMap[currentDay] = daysMap[currentDay] || {};
    continue;
  }
  
  if ((row[0] || '').toUpperCase().includes('SAAT')) {
    currentAmfiHeaders = row;
    continue;
  }
  
  if (currentDay && currentAmfiHeaders.length > 0 && row.length > 1) {
    const saatRaw = (row[0] || '').trim();
    if (/\\d/.test(saatRaw)) {
      const basSaat = saatRaw.split(/[-–]/)[0].trim().replace(':', '.');
      daysMap[currentDay][basSaat] = daysMap[currentDay][basSaat] || {};
      for (let c = 1; c < Math.min(row.length, currentAmfiHeaders.length); c++) {
        const val = row[c].trim();
        const amfiName = currentAmfiHeaders[c];
        if (val && amfiName) {
          daysMap[currentDay][basSaat][amfiName] = val;
        }
      }
    }
  }
}

function findAmfi(gunStr, basSaat, grupHarfi) {
  const gLower = (gunStr || '').toLowerCase();
  let normDay = null;
  for (const dk of Object.keys(daysMap)) {
    if (dk === 'cuma' && gLower.includes('cumartesi')) continue;
    if (gLower.includes(dk) || dk.includes(gLower)) {
      normDay = dk;
      break;
    }
  }
  if (!normDay || !daysMap[normDay]) return null;

  const saatKey = basSaat.replace(':', '.');
  const slot = daysMap[normDay][saatKey];
  if (!slot) return null;

  const tags = grupHarfi === 'A'
    ? ['3A', 'A GRUBU', 'DÖNEM 3-TÜRKÇE-A', 'DÖNEM 3-A']
    : ['3B', 'B GRUBU', 'DÖNEM 3- B GRUBU', 'DÖNEM 3-B'];

  for (const [amfi, desc] of Object.entries(slot)) {
    const du = desc.toUpperCase();
    if (tags.some(t => du.includes(t))) return amfi;
  }
  
  for (const [amfi, desc] of Object.entries(slot)) {
    const du = desc.toUpperCase();
    if (du.includes('DÖNEM 3') && (du.includes('TÜRKÇE') || du.includes('ORTAK')) && !du.includes('3A') && !du.includes('3B')) {
      return amfi + ' (A+B Ortak)';
    }
  }
  return null;
}

// 4. TARİHİ YYYY-MM-DD FORMATINA DÖNÜŞTÜR
const AYLAR = {
  'Ocak':1,'Şubat':2,'Subat':2,'Mart':3,'Nisan':4,'Mayıs':5,'Mayis':5,
  'Haziran':6,'Temmuz':7,'Ağustos':8,'Agustos':8,'Eylül':9,'Eylul':9,
  'Ekim':10,'Kasım':11,'Kasim':11,'Aralık':12,'Aralik':12
};

function toISO(str) {
  const parts = (str || '').trim().split(/\\s+/);
  if (parts.length < 3) return null;
  const g = parseInt(parts[0], 10);
  const a = AYLAR[parts[1]];
  const y = parseInt(parts[2], 10);
  if (isNaN(g) || !a || isNaN(y)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(a)}-${pad(g)}`;
}

function processLectures(csvText, grupHarfi) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const tarihStr = (r[1] || '').trim();
    if (!tarihStr) continue;

    const isoDate = toISO(tarihStr);
    if (!isoDate || isoDate < haftaBas || isoDate > haftaBit) continue;

    const konu = (r[4] || '').trim();
    if (!konu || konu.toUpperCase() === 'SERBEST ÇALIŞMA') continue;

    const basSaat = (r[2] || '').trim();
    const bitSaat = (r[3] || '').trim();
    const hamYer = (r[6] || '').trim().toUpperCase();
    const gun = tarihStr.split(/\\s+/).pop();

    let sonYer = '';
    let tur = '📖';

    if (hamYer.includes('AMFİ') || hamYer.includes('AMFI')) {
      const amfi = findAmfi(gun, basSaat, grupHarfi);
      sonYer = amfi ? `🏛️ ${amfi}` : '⚠️ Amfi Listede Yok';
      tur = '📖';
    } else if (hamYer.includes('UYGULAMA PROGRAMI') || konu.toUpperCase().includes('UYGULAMA')) {
      tur = '🔬';
      sonYer = '🔬 İlgili Bilim Dalı (Uygulama Rotasyonu)';
    } else if (hamYer.includes('ANABİLİM DALLARI') || konu.includes('Hasta İzlem')) {
      tur = '🏥';
      sonYer = '🏥 Klinik Servisler (Hasta İzlem)';
    } else {
      sonYer = (r[6] || '').trim() || '📋 Belirtilmemiş';
    }

    result.push({
      tarihStr,
      isoDate,
      gun,
      basSaat,
      bitSaat,
      konu,
      yer: sonYer,
      tur
    });
  }

  return result.sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.basSaat.localeCompare(b.basSaat));
}

const dersler3A = processLectures(csv3A, 'A');
const dersler3B = processLectures(csv3B, 'B');

// 5. TELEGRAM 4096 KARAKTER SINIRI İÇİN AKILLI PARÇALAMA
function buildTelegramMessages(grup, dersler, chatId) {
  const basTR = haftaBas.split('-').reverse().join('.');
  const bitTR = haftaBit.split('-').reverse().join('.');

  if (!dersler.length) {
    return [{
      json: {
        grup,
        chatId,
        mesaj: `🩺 *İÜ TIP FAKÜLTESİ — DÖNEM ${grup}*\\n🗓️ *Haftalık Program:* ${basTR} – ${bitTR}\\n━━━━━━━━━━━━━━━━━━━━\\n\\n🏖️ Bu hafta kayıtlı ders görünmüyor.`
      }
    }];
  }

  // Günlere göre grupla
  const daysMap = {};
  for (const d of dersler) {
    daysMap[d.tarihStr] = daysMap[d.tarihStr] || [];
    daysMap[d.tarihStr].push(d);
  }

  const messages = [];
  let curText = '';
  let part = 1;

  function makeHeader(p) {
    let h = `🩺 *İÜ TIP FAKÜLTESİ — DÖNEM ${grup}*`;
    h += `\\n🗓️ *Haftalık Program:* ${basTR} – ${bitTR}\\n━━━━━━━━━━━━━━━━━━━━\\n\\n`;
    return h;
  }

  curText = makeHeader(part);

  for (const [dayName, dayDersler] of Object.entries(daysMap)) {
    let dayBlock = `📌 *${dayName.toUpperCase()}*\\n`;
    for (const d of dayDersler) {
      dayBlock += `⏰ \\`${d.basSaat} - ${d.bitSaat}\\`\\n`;
      dayBlock += `${d.tur} *Ders:* ${d.konu}\\n`;
      dayBlock += `📍 *Yer:* ${d.yer}\\n`;
      dayBlock += `────────────────────\\n`;
    }
    dayBlock += `\\n`;

    // 3500 karakteri aşıyorsa mesajı böl
    if ((curText + dayBlock).length > 3500) {
      messages.push({
        json: {
          grup,
          chatId,
          mesaj: curText.trim()
        }
      });
      part++;
      curText = makeHeader(part) + dayBlock;
    } else {
      curText += dayBlock;
    }
  }

  if (curText.trim()) {
    messages.push({
      json: {
        grup,
        chatId,
        mesaj: curText.trim() + `\\n\\n💡 _Amfiler fakülte amfi çizelgesinden otomatik eşleştirilmiştir._`
      }
    });
  }

  return messages;
}

const out3A = buildTelegramMessages('3A', dersler3A, chatId3A);
const out3B = buildTelegramMessages('3B', dersler3B, chatId3B);

return [...out3A, ...out3B];"""

workflow = {
  "name": "İÜ Tıp Fakültesi - 21-25 Eylül Programı",
  "nodes": [
    {
      "parameters": {},
      "id": "node-manual-trigger",
      "name": "▶️ Elle Başlat",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [100, 300]
    },
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "weeks",
              "triggerAtHour": 19,
              "triggerAtMinute": 0
            }
          ]
        }
      },
      "id": "node-cron-trigger",
      "name": "⏰ Her Pazar 19:00",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [100, 500]
    },
    {
      "parameters": {
        "jsCode": code_date
      },
      "id": "node-date-calc",
      "name": "📅 Tarih & Ayarlar",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [340, 400]
    },
    {
      "parameters": {
        "url": "https://docs.google.com/spreadsheets/d/1Wk9h1Z3duYvQRX-krrDQ2xHXbmWk0j-VPNPU5y5Aj7A/gviz/tq?tqx=out:csv&gid=2874560",
        "responseFormat": "text",
        "options": {
          "response": {
            "response": {
              "responseFormat": "text"
            }
          }
        }
      },
      "id": "node-fetch-3a",
      "name": "📥 3A Teorik CSV",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [560, 400]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            { "id": "f1", "name": "haftaBaslangic", "value": "={{ $('📅 Tarih & Ayarlar').item.json.haftaBaslangic }}", "type": "string" },
            { "id": "f2", "name": "haftaBitis",     "value": "={{ $('📅 Tarih & Ayarlar').item.json.haftaBitis }}",     "type": "string" },
            { "id": "f3", "name": "amfiSheetUrl",   "value": "={{ $('📅 Tarih & Ayarlar').item.json.amfiSheetUrl }}",   "type": "string" },
            { "id": "f4", "name": "chatId3A",       "value": "={{ $('📅 Tarih & Ayarlar').item.json.chatId3A }}",       "type": "string" },
            { "id": "f5", "name": "chatId3B",       "value": "={{ $('📅 Tarih & Ayarlar').item.json.chatId3B }}",       "type": "string" },
            { "id": "f6", "name": "csv3A",          "value": "={{ $json.data }}",                                        "type": "string" }
          ]
        },
        "options": {}
      },
      "id": "node-store-3a",
      "name": "💾 3A'yı Sakla",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [780, 400]
    },
    {
      "parameters": {
        "url": "https://docs.google.com/spreadsheets/d/1wlquiW3pDRiHzNp8mfFdGGzudfwF_3nyvkkygmHG-nU/gviz/tq?tqx=out:csv&gid=1063756593",
        "responseFormat": "text",
        "options": {
          "response": {
            "response": {
              "responseFormat": "text"
            }
          }
        }
      },
      "id": "node-fetch-3b",
      "name": "📥 3B Teorik CSV",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1000, 400]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            { "id": "g1", "name": "haftaBaslangic", "value": "={{ $('💾 3A\\'yı Sakla').item.json.haftaBaslangic }}", "type": "string" },
            { "id": "g2", "name": "haftaBitis",     "value": "={{ $('💾 3A\\'yı Sakla').item.json.haftaBitis }}",     "type": "string" },
            { "id": "g3", "name": "amfiSheetUrl",   "value": "={{ $('💾 3A\\'yı Sakla').item.json.amfiSheetUrl }}",   "type": "string" },
            { "id": "g4", "name": "chatId3A",       "value": "={{ $('💾 3A\\'yı Sakla').item.json.chatId3A }}",       "type": "string" },
            { "id": "g5", "name": "chatId3B",       "value": "={{ $('💾 3A\\'yı Sakla').item.json.chatId3B }}",       "type": "string" },
            { "id": "g6", "name": "csv3A",          "value": "={{ $('💾 3A\\'yı Sakla').item.json.csv3A }}",          "type": "string" },
            { "id": "g7", "name": "csv3B",          "value": "={{ $json.data }}",                                     "type": "string" }
          ]
        },
        "options": {}
      },
      "id": "node-store-3b",
      "name": "💾 3B'yi Sakla",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [1220, 400]
    },
    {
      "parameters": {
        "url": "={{ $json.amfiSheetUrl }}",
        "responseFormat": "text",
        "options": {
          "response": {
            "response": {
              "responseFormat": "text"
            }
          }
        }
      },
      "id": "node-fetch-amfi",
      "name": "📥 Amfi Programı CSV",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1440, 400]
    },
    {
      "parameters": {
        "jsCode": code_matcher
      },
      "id": "node-matcher",
      "name": "🧠 Eşleştirici & Formatlayıcı",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1660, 400]
    },
    {
      "parameters": {
        "resource": "message",
        "chatId": "={{ $json.chatId }}",
        "text": "={{ $json.mesaj }}",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram",
      "name": "📨 Telegram Gönder",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1880, 400]
    }
  ],
  "connections": {
    "▶️ Elle Başlat": {
      "main": [[{ "node": "📅 Tarih & Ayarlar", "type": "main", "index": 0 }]]
    },
    "⏰ Her Pazar 19:00": {
      "main": [[{ "node": "📅 Tarih & Ayarlar", "type": "main", "index": 0 }]]
    },
    "📅 Tarih & Ayarlar": {
      "main": [[{ "node": "📥 3A Teorik CSV", "type": "main", "index": 0 }]]
    },
    "📥 3A Teorik CSV": {
      "main": [[{ "node": "💾 3A'yı Sakla", "type": "main", "index": 0 }]]
    },
    "💾 3A'yı Sakla": {
      "main": [[{ "node": "📥 3B Teorik CSV", "type": "main", "index": 0 }]]
    },
    "📥 3B Teorik CSV": {
      "main": [[{ "node": "💾 3B'yi Sakla", "type": "main", "index": 0 }]]
    },
    "💾 3B'yi Sakla": {
      "main": [[{ "node": "📥 Amfi Programı CSV", "type": "main", "index": 0 }]]
    },
    "📥 Amfi Programı CSV": {
      "main": [[{ "node": "🧠 Eşleştirici & Formatlayıcı", "type": "main", "index": 0 }]]
    },
    "🧠 Eşleştirici & Formatlayıcı": {
      "main": [[{ "node": "📨 Telegram Gönder", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}

with open('iu_tip_n8n_workflow.json', 'w', encoding='utf-8') as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)

print("Workflow updated with auto-chunking for Telegram length limit!")
