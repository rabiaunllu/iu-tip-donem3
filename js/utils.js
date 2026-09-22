/**
 * İÜ Tıp Fakültesi Dönem 3 — Yardımcı Fonksiyonlar (Tarih ve Metin)
 */

/**
 * Saat string'ini normalize eder: "8:30" → "08:30", "9:20" → "09:20"
 * Bu fonksiyon tüm saat karşılaştırma ve sıralama işlemlerinden önce çağrılmalıdır.
 * FIX-1: String karşılaştırma hatalarını önler ("8:30" >= "13:00" → TRUE bug'ı)
 */
function normalizeTime(t) {
  if (!t) return '';
  const s = t.trim();
  // "H:MM" formatını "HH:MM" formatına dönüştür
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    return m[1].padStart(2, '0') + ':' + m[2];
  }
  // "H.MM" formatını da destekle
  const m2 = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (m2) {
    return m2[1].padStart(2, '0') + ':' + m2[2];
  }
  return s;
}

function getMondayOfDate(d) {
  const date = new Date(d);
  const day = date.getDay();
  // FIX-16: Pazar günü saat 18:00'den sonra ertesi haftanın Pazartesi'sini göster
  // Böylece Pazar akşamı yarınki derslere hazırlanan öğrenci doğru haftayı görür
  if (day === 0 && date.getHours() >= 18) {
    date.setDate(date.getDate() + 1); // Pazartesi'ye atla
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi = 1
  return new Date(date.setDate(diff));
}

const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function toISOFromStr(str) {
  if (!str) return null;
  const parts = str.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const g = parseInt(parts[0], 10);
  const monStr = parts[1].toLowerCase();
  const a = TR_AYLAR[monStr];
  const y = parseInt(parts[2], 10);
  if (isNaN(g) || !a || isNaN(y)) return null;
  return `${y}-${pad(a)}-${pad(g)}`;
}

function parseSheetLink(url, defaultConf) {
  if (!url || typeof url !== 'string' || !url.trim()) return defaultConf;
  const trimmed = url.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = trimmed.match(/[#?&]gid=(\d+)/);
  if (!idMatch) return defaultConf;
  return {
    id: idMatch[1],
    gid: gidMatch ? gidMatch[1] : (defaultConf && defaultConf.gid ? defaultConf.gid : '0')
  };
}

function isValidSheetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /spreadsheets\/d\/([a-zA-Z0-9_-]+)/i.test(url.trim());
}

function isValidWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('https://script.google.com/macros/s/') || /^https?:\/\/.+/i.test(trimmed);
}

