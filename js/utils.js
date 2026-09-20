/**
 * İÜ Tıp Fakültesi Dönem 3 — Yardımcı Fonksiyonlar (Tarih ve Metin)
 */

function getMondayOfDate(d) {
  const date = new Date(d);
  const day = date.getDay();
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
  if (!url) return defaultConf;
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  return {
    id: idMatch ? idMatch[1] : defaultConf.id,
    gid: gidMatch ? gidMatch[1] : defaultConf.gid
  };
}
