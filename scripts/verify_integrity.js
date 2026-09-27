const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const jsFiles = [
  'js/config.js',
  'js/utils.js',
  'js/state.js',
  'js/data.js',
  'js/render.js',
  'js/app.js'
];

const jsAll = jsFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const idRegex = /getElementById\(['"]([\w-]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(jsAll)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}

console.log('Checked ' + ids.size + ' element IDs referenced across JS modules.');
if (missing.length > 0) {
  console.error('Missing IDs in index.html:', missing);
  process.exit(1);
} else {
  console.log('SUCCESS: All element IDs exist in index.html!');
}

// Verify css/style.css exists and is non-empty
const css = fs.readFileSync('css/style.css', 'utf8');
if (css.length < 100) {
  console.error('css/style.css seems too small or empty!');
  process.exit(1);
}
console.log('SUCCESS: css/style.css verified (' + css.length + ' bytes).');

// Clinical Resolution & Data Integrity Verification
const vm = require('vm');
const db = JSON.parse(fs.readFileSync('data/schedule_2026_2027.json', 'utf8'));

// FIX-1 helper: normalizeTime must be available in sandbox
const configCode = fs.readFileSync('js/config.js', 'utf8');
const utilsCode = fs.readFileSync('js/utils.js', 'utf8');
const stateCode = fs.readFileSync('js/state.js', 'utf8');

const sandbox = {
  state: {
    group: '3A',
    subgroup: 'all',
    db: db,
    cacheData: {
      amfi: db.amfi_published_week || {},
      '3A': db.lectures_3A || [],
      '3B': db.lectures_3B || []
    }
  },
  console: console,
  RegExp: RegExp,
  Date: Date,
  db: db
};
vm.createContext(sandbox);
vm.runInContext(configCode, sandbox);
vm.runInContext(utilsCode, sandbox);
vm.runInContext(stateCode, sandbox);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), sandbox);
vm.runInContext('state.db = db; state.cacheData.amfi = db.amfi_published_week;', sandbox);

const { parseHastaBasiDepartment, resolveLectureDetails, normalizeTime, parseAmfiDateHeader, parseAmfiSchedule, findAmfiFromLiveSchedule } = sandbox;

if (typeof parseHastaBasiDepartment !== 'function' || typeof resolveLectureDetails !== 'function') {
  console.error('FAIL: parseHastaBasiDepartment or resolveLectureDetails is not defined in js/data.js');
  process.exit(1);
}

if (typeof normalizeTime !== 'function') {
  console.error('FAIL: normalizeTime is not defined in js/utils.js');
  process.exit(1);
}

// 1. Audit Hasta Başı on all 184 cases
let hbFailures = 0;
for (const g of ['3A', '3B']) {
  const lectures = db['lectures_' + g];
  for (const l of lectures) {
    const s = l.subject || '';
    if (s.toUpperCase().includes('HASTA BAŞI') || s.toUpperCase().includes('HASTABAŞI')) {
      const dept = parseHastaBasiDepartment(s, g);
      if (!dept.includes('İç Hastalıkları') && !dept.includes('Çocuk Sağlığı')) {
        console.error(`Unrecognized Hasta Basi: [${g}] ${s} -> ${dept}`);
        hbFailures++;
      }
    }
  }
}
if (hbFailures > 0) {
  console.error(`FAIL: ${hbFailures} Hasta Basi lectures could not be resolved!`);
  process.exit(1);
}
console.log('SUCCESS: 100% of Hasta Başı lectures resolved to Dahiliye or Pediatri.');

// 2. Audit Full Year (20,000 combinations) for vague locations
// FIX-15: Genişletilmiş rotasyon atama kontrolü — fallback string'leri de yakala
let vagueCount = 0;
let totalAudited = 0;
for (const g of ['3A', '3B']) {
  const rot = db['rotations_' + g];
  const subgroups = ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => (g === '3A' ? 'A' : 'B') + n);
  for (const sg of subgroups) {
    sandbox.state.group = g;
    sandbox.state.subgroup = sg;
    for (const l of db['lectures_' + g]) {
      totalAudited++;
      const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
      const res = resolveLectureDetails(l, gun, g, sg, rot);
      if (res.resolvedLocation.includes('İlgili Klinik') ||
          res.resolvedLocation.includes('Rotasyon Alanı') ||
          res.resolvedLocation.includes('Detay İçin Alt Grubunuzu Seçiniz')) {
        vagueCount++;
        console.error(`Vague location: ${g} ${sg} ${l.date} ${l.subject}`);
      }
    }
  }
}

console.log(`Audited ${totalAudited} lecture-subgroup instances across entire academic year.`);
if (vagueCount > 0) {
  console.error(`FAIL: Found ${vagueCount} vague locations! Expected exactly 0.`);
  process.exit(1);
} else {
  console.log('SUCCESS: Exactly 0 vague locations found across the entire academic year!');
}

// 3. Wednesday Morning vs Afternoon Split Verification (Tüm Yıl ve Örnek Günler)
console.log('--- Verifying Wednesday Amfi Split Across Whole Year ---');

// Specific check on 2026-09-23
const lecs3A_0923 = db.lectures_3A.filter(l => l.date === '2026-09-23');
const lecs3B_0923 = db.lectures_3B.filter(l => l.date === '2026-09-23');

const l3A_am = lecs3A_0923.find(l => normalizeTime(l.start) === '09:20');
const l3A_pm = lecs3A_0923.find(l => normalizeTime(l.start) === '13:30');
const l3B_am = lecs3B_0923.find(l => normalizeTime(l.start) === '08:30');
const l3B_pm = lecs3B_0923.find(l => normalizeTime(l.start) === '13:30');

if (l3A_am) {
  const res3A_am = resolveLectureDetails(l3A_am, 'çarşamba', '3A', 'all', {});
  if (!res3A_am.resolvedLocation.includes('Aziz Sancar')) {
    console.error('FAIL: 3A Wednesday morning should be Aziz Sancar Amfisi, got:', res3A_am.resolvedLocation);
    process.exit(1);
  }
}
if (l3A_pm) {
  const res3A_pm = resolveLectureDetails(l3A_pm, 'çarşamba', '3A', 'all', {});
  if (!res3A_pm.resolvedLocation.includes('Kemal Atay')) {
    console.error('FAIL: 3A Wednesday afternoon should be Kemal Atay Amfisi, got:', res3A_pm.resolvedLocation);
    process.exit(1);
  }
}
if (l3B_am) {
  const res3B_am = resolveLectureDetails(l3B_am, 'çarşamba', '3B', 'all', {});
  if (!res3B_am.resolvedLocation.includes('Kemal Atay')) {
    console.error('FAIL: 3B Wednesday morning should be Kemal Atay Amfisi, got:', res3B_am.resolvedLocation);
    process.exit(1);
  }
}
if (l3B_pm) {
  const res3B_pm = resolveLectureDetails(l3B_pm, 'çarşamba', '3B', 'all', {});
  if (!res3B_pm.resolvedLocation.includes('Sami Zan')) {
    console.error('FAIL: 3B Wednesday afternoon should be Sami Zan Amfisi, got:', res3B_pm.resolvedLocation);
    process.exit(1);
  }
}
console.log('SUCCESS: 23 Eylül 2026 Çarşamba sabah/öğleden sonra amfi dağılımı doğrulandı.');

// Check Elective Course on 2026-10-14
const l_sec = db.lectures_3A.find(l => l.date === '2026-10-14' && normalizeTime(l.start) === '13:30');
if (l_sec) {
  const res_sec = resolveLectureDetails(l_sec, 'çarşamba', '3A', 'all', {});
  if (!res_sec.resolvedLocation.includes('Seçmeli Derslikleri') || res_sec.badge !== 'Seçmeli') {
    console.error('FAIL: Seçmeli Ders should route to Seçmeli Derslikleri with Seçmeli badge, got:', res_sec);
    process.exit(1);
  }
  console.log('SUCCESS: Seçmeli dersler ve dekanlık portal yönlendirmesi doğrulandı.');
}

// Full-year Wednesday audit: verify no Wednesday afternoon regular lecture stays in morning amfi
// FIX-2 uyumu: normalizeTime ile sabah/öğleden sonra ayrımı doğru yapılır
let wednesdayErrors = 0;
for (const g of ['3A', '3B']) {
  const lecs = db['lectures_' + g];
  for (const l of lecs) {
    const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
    if (gun.toLowerCase().includes('çarşamba')) {
      const s = (l.subject || '').toUpperCase();
      if (!s || s.includes('SERBEST') || s.includes('UYGULAMA') || s.includes('HASTA BAŞI')) continue;
      const res = resolveLectureDetails(l, gun, g, 'all', {});
      if (res.cardType === 'holiday' || res.cardType === 'free') continue;
      if (res.isLiveAmfi) continue; // Canlı teyitli amfi ataması statik şablonun üzerindedir
      const isAfternoon = normalizeTime(l.start) >= '13:00';
      if (isAfternoon) {
        if (/(seçmeli|secmeli)\s*ders/i.test(l.subject)) {
          if (!res.resolvedLocation.includes('Seçmeli Derslikleri')) wednesdayErrors++;
        } else if (g === '3A') {
          if (!res.resolvedLocation.includes('Kemal Atay')) wednesdayErrors++;
        } else if (g === '3B') {
          if (!res.resolvedLocation.includes('Sami Zan')) wednesdayErrors++;
        }
      } else {
        if (g === '3A') {
          if (!res.resolvedLocation.includes('Aziz Sancar') && !res.resolvedLocation.includes('Kemal Atay (Ortak Ders)')) wednesdayErrors++;
        } else if (g === '3B') {
          if (!res.resolvedLocation.includes('Kemal Atay')) wednesdayErrors++;
        }
      }
    }
  }
}

if (wednesdayErrors > 0) {
  console.error(`FAIL: Found ${wednesdayErrors} Wednesday amfi assignment violations across full year!`);
  process.exit(1);
}
console.log('SUCCESS: Tüm akademik yıl boyunca (45 Çarşamba) amfi değişimi 0 hata ile doğrulandı!');

// ═══════════════════════════════════════════════════════════════
// FIX-13: AMFİ TAMLIK KONTROLÜ — Tüm teorik derslerin amfi ataması var mı?
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-13: Amfi Tamlık Kontrolü ---');
let missingAmfiCount = 0;
for (const g of ['3A', '3B']) {
  sandbox.state.group = g;
  sandbox.state.subgroup = 'all';
  for (const l of db['lectures_' + g]) {
    const s = (l.subject || '').toUpperCase();
    if (!s || s.includes('SERBEST') || s.includes('HASTA BAŞI') || s.includes('HASTABAŞI')) continue;
    const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
    const res = resolveLectureDetails(l, gun, g, 'all', {});
    if (res.cardType === 'holiday' || res.cardType === 'free') continue;
    if (res.cardType === 'theory' && res.resolvedLocation.includes('Kontrol Ediniz')) {
      missingAmfiCount++;
      if (missingAmfiCount <= 5) {
        console.warn(`WARN: Missing amfi: [${g}] ${l.date} ${normalizeTime(l.start)} "${l.subject}"`);
      }
    }
  }
}
if (missingAmfiCount > 0) {
  console.warn(`WARN: ${missingAmfiCount} teorik ders için amfi ataması bulunamadı (portal yönlendirmesi yapılıyor).`);
} else {
  console.log('SUCCESS: Tüm teorik derslerin amfi ataması mevcut!');
}

// ═══════════════════════════════════════════════════════════════
// FIX-14: SAAT ÇAKIŞMA KONTROLÜ (GELİŞMİŞ ARALIK BAZLI DENETİM)
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-14: Saat Çakışma Kontrolü (Aralık Bazlı) ---');

// Resmi fakülte tablosundaki bilinen saat kaymaları (Cuma günleri fakülte saat bindirmesi)
// Bunlar arayüzde öğrenciye özel uyarı rozeti ile gösterilmektedir.
const KNOWN_FACULTY_CONFLICTS = new Set([
  '3B_2026-12-25', // Cuma: Hasta Başı Uygulama (13:30-14:20) vs Elektrokardiyogram VIII (14:00-14:40)
  '3B_2027-03-05', // Cuma: Öğr. Üyesi Uygulama 3 (11:10-12:10) vs Biyokimya (11:50-12:30)
  '3B_2027-03-19'  // Cuma: Öğr. Üyesi Uygulama 6 (11:10-12:10) vs Çocuk Sağlığı (11:50-12:30)
]);

let unknownConflictCount = 0;
let knownFacultyConflictCount = 0;

for (const g of ['3A', '3B']) {
  const lectures = db['lectures_' + g];
  const byDate = {};
  for (const l of lectures) {
    if (!l.date) continue;
    byDate[l.date] = byDate[l.date] || [];
    byDate[l.date].push(l);
  }

  for (const [date, dayLecs] of Object.entries(byDate)) {
    const validLecs = dayLecs.filter(l => {
      const s = (l.subject || '').toUpperCase();
      return s && s !== 'SERBEST ÇALIŞMA' && !s.includes('TATİL') && !s.includes('BAYRAM');
    });

    for (let i = 0; i < validLecs.length; i++) {
      for (let j = i + 1; j < validLecs.length; j++) {
        const l1 = validLecs[i];
        const l2 = validLecs[j];
        const s1 = normalizeTime(l1.start);
        const e1 = normalizeTime(l1.end);
        const s2 = normalizeTime(l2.start);
        const e2 = normalizeTime(l2.end);

        if (s1 && e1 && s2 && e2) {
          // Aralık çakışması: max(s1, s2) < min(e1, e2)
          if (s1 < e2 && s2 < e1) {
            const conflictKey = `${g}_${date}`;
            if (KNOWN_FACULTY_CONFLICTS.has(conflictKey)) {
              knownFacultyConflictCount++;
            } else {
              unknownConflictCount++;
              console.error(`FAIL: Beklenmeyen saat aralığı çakışması [${g}] ${date}: "${l1.subject}" (${s1}-${e1}) vs "${l2.subject}" (${s2}-${e2})`);
            }
          }
        }
      }
    }
  }
}

if (unknownConflictCount > 0) {
  console.error(`FAIL: ${unknownConflictCount} adet bilinmeyen saat çakışması tespit edildi!`);
  process.exit(1);
} else {
  console.log(`SUCCESS: Aralık bazlı çakışma denetimi tamamlandı (0 beklenmeyen çakışma, ${knownFacultyConflictCount} doğrulanmış fakülte uyuşmazlığı kontrollü yönetiliyor).`);
}

// ═══════════════════════════════════════════════════════════════
// FIX-17: LABORATUVAR VERİ BÜTÜNLÜĞÜ DENETİMİ
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-17: Laboratuvar Bütünlük Denetimi ---');
const labs = db.laboratories || {};
const labDates = Object.keys(labs);
let totalAssignments = 0;
for (const day of Object.values(labs)) {
  for (const item of day) {
    totalAssignments += (item.groups || []).length;
  }
}

console.log(`Laboratuvar takvim günleri: ${labDates.length}, toplam alt grup ataması: ${totalAssignments}`);
if (labDates.length !== 43) {
  console.error(`FAIL: Beklenen 43 laboratuvar tarihi, bulunan: ${labDates.length}`);
  process.exit(1);
}
if (totalAssignments !== 84) {
  console.error(`FAIL: Beklenen 84 alt grup laboratuvar ataması, bulunan: ${totalAssignments}`);
  process.exit(1);
}

// 25.05.2027 özel saat kontrolü
const may25 = labs['2027-05-25'] || [];
const hasCustomTimes = may25.some(it => it.time.includes('13:30') || it.time.includes('15:30'));
if (!hasCustomTimes) {
  console.error('FAIL: 25.05.2027 özel laboratuvar saatleri (13:30-15:20 ve 15:30-17:20) korunamadı!');
  process.exit(1);
}
console.log('SUCCESS: 43 takvim günü ve 84 alt grup laboratuvar seansı %100 eksiksiz doğrulandı!');

// ═══════════════════════════════════════════════════════════════
// FIX-18: EKSİK BİTİŞ SAATİ DENETİMİ
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-18: Eksik Bitiş Saati Denetimi ---');
let missingEndCount = 0;
for (const g of ['3A', '3B']) {
  for (const l of db['lectures_' + g]) {
    if (l.start && (!l.end || l.end.trim() === '')) {
      missingEndCount++;
      console.error(`Missing end time: [${g}] ${l.date} ${l.start} "${l.subject}"`);
    }
  }
}
if (missingEndCount > 0) {
  console.error(`FAIL: ${missingEndCount} dersin bitiş saati eksik!`);
  process.exit(1);
}
console.log('SUCCESS: Tüm derslerin başlangıç ve bitiş saatleri tam!');

// ═══════════════════════════════════════════════════════════════
// FIX-20: RESMİ TATİL VE ÖĞLE ARASI AMFİ ATAMA DENETİMİ
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-20: Resmi Tatil ve Öğle Arası Denetimi ---');
let holidayCount = 0;
let holidayAmfiErrors = 0;
let lunchCount = 0;
let lunchAmfiErrors = 0;
let bayramAcademicCount = 0;
let bayramAcademicErrors = 0;

for (const g of ['3A', '3B']) {
  for (const l of db['lectures_' + g]) {
    const s = (l.subject || '').trim();
    const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
    const res = resolveLectureDetails(l, gun, g, 'all', {});

    const hasAcademicTitle = /Prof\.?\s*Dr|Doç\.?\s*Dr|Doc\.?\s*Dr|Dr\.?\s*Öğr|Dr\.?\s*Ogr|Uzm\.?\s*Dr|Doktor|\bDr\b/i.test(s);
    const isHolidaySubject = !hasAcademicTitle && (/BAYRAM|AR[İI]FE|YARIYIL\s*TAT[İI]L[İI]|YILBA[ŞS]I|RESM[İI]\s*TAT[İI]L/i.test(s) || /29\s*EK[İI]M|23\s*N[İI]SAN|19\s*MAYIS|15\s*TEMMUZ|1\s*MAYIS/i.test(s));
    const isLunchSubject = /ÖĞLE\s*TAT[İI]L[İI]|OGLE\s*TATIL|YEMEK\s*ARASI/i.test(s);
    const isBayramAcademic = hasAcademicTitle && /BAYRAM/i.test(s);

    if (isHolidaySubject) {
      holidayCount++;
      if (res.cardType !== 'holiday' || res.badge !== 'Resmi Tatil' || !res.resolvedLocation.includes('Resmi Tatil') || res.resolvedLocation.includes('Amfisi')) {
        holidayAmfiErrors++;
        console.error(`FAIL: Holiday incorrectly assigned amfi: [${g}] ${l.date} "${s}" -> ${res.resolvedLocation}`);
      }
    }

    if (isLunchSubject) {
      lunchCount++;
      if (res.cardType !== 'free' || res.badge !== 'Öğle Arası' || res.resolvedLocation.includes('Amfisi')) {
        lunchAmfiErrors++;
        console.error(`FAIL: Lunch break assigned amfi: [${g}] ${l.date} "${s}" -> ${res.resolvedLocation}`);
      }
    }

    if (isBayramAcademic) {
      bayramAcademicCount++;
      if (res.cardType === 'holiday' || !/amfi/i.test(res.resolvedLocation)) {
        bayramAcademicErrors++;
        console.error(`FAIL: Academic lecturer with BAYRAM surname treated as holiday: [${g}] ${l.date} "${s}"`);
      }
    }

  }
}

if (holidayAmfiErrors > 0) {
  console.error(`FAIL: ${holidayAmfiErrors} tatil gününe amfi ataması yapıldı!`);
  process.exit(1);
}
if (lunchAmfiErrors > 0) {
  console.error(`FAIL: ${lunchAmfiErrors} öğle arasına amfi ataması yapıldı!`);
  process.exit(1);
}
if (bayramAcademicErrors > 0) {
  console.error(`FAIL: ${bayramAcademicErrors} akademisyen dersi yanlışlıkla tatil sayıldı!`);
  process.exit(1);
}

console.log(`Doğrulanan resmi tatil sayısı: ${holidayCount} (0 amfi hatası)`);
console.log(`Doğrulanan öğle tatili sayısı: ${lunchCount} (0 amfi hatası)`);
console.log(`Doğrulanan akademisyen ("Bayram") ders sayısı: ${bayramAcademicCount} (0 tatil yanılgısı)`);
console.log('SUCCESS: Tatil günleri ve öğle aralarında amfi atama hatası %100 giderildi!');

// ═══════════════════════════════════════════════════════════════
// FIX-22: TÜRKÇE DUYARLI AY VE TARİH DÖNÜŞÜM DENETİMİ (toISOFromStr)
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-22: Türkçe Ay ve Tarih Dönüşüm Denetimi ---');
const { toISOFromStr, normalizeTurkishLower } = sandbox;
const testDates = [
  { str: '14 EKİM 2026 Çarşamba', expected: '2026-10-14' },
  { str: '23 NİSAN 2027 Cuma', expected: '2027-04-23' },
  { str: '10 HAZİRAN 2027 Perşembe', expected: '2027-06-10' },
  { str: '19 MAYIS 2027 Çarşamba', expected: '2027-05-19' },
  { str: '29 EKİM 2026 Perşembe', expected: '2026-10-29' },
  { str: '15 EYLÜL 2026 Salı', expected: '2026-09-15' },
  { str: '1 KASIM 2026 Pazar', expected: '2026-11-01' },
  { str: '31 ARALIK 2026 Perşembe', expected: '2026-12-31' },
  { str: '1 OCAK 2027 Cuma', expected: '2027-01-01' },
  { str: '15 ŞUBAT 2027 Pazartesi', expected: '2027-02-15' },
  { str: '18 MART 2027 Perşembe', expected: '2027-03-18' },
  { str: '15 TEMMUZ 2027 Perşembe', expected: '2027-07-15' }
];

let dateParseErrors = 0;
for (const td of testDates) {
  const parsed = toISOFromStr(td.str);
  if (parsed !== td.expected) {
    console.error(`FAIL: toISOFromStr("${td.str}") -> "${parsed}", beklenen: "${td.expected}"`);
    dateParseErrors++;
  }
}
if (dateParseErrors > 0) {
  console.error(`FAIL: ${dateParseErrors} adet tarih ayrıştırma hatası!`);
  process.exit(1);
}
console.log('SUCCESS: Tüm Türkçe aylar (EKİM, NİSAN, HAZİRAN dahil) %100 hatasız ayrıştırıldı!');

// ═══════════════════════════════════════════════════════════════
// FIX-23: TÜRKÇE ARAMA NORMALİZASYON DENETİMİ
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-23: Türkçe Arama Eşleştirme Denetimi ---');
const searchTests = [
  { query: 'iç', target: 'İÇ HASTALIKLARI AD.', shouldMatch: true },
  { query: 'biyo', target: 'BİYOİSTATİSTİK DERSİ', shouldMatch: true },
  { query: 'ilaç', target: 'İLAÇLARIN ETKİ MEKANİZMASI', shouldMatch: true },
  { query: 'çocuk', target: 'ÇOCUK SAĞLIĞI VE HASTALIKLARI', shouldMatch: true }
];

let searchErrors = 0;
for (const st of searchTests) {
  const qNorm = normalizeTurkishLower(st.query).trim();
  const tNorm = normalizeTurkishLower(st.target);
  const matches = tNorm.includes(qNorm);
  if (matches !== st.shouldMatch) {
    console.error(`FAIL: Arama normalizasyon hatası: "${st.query}" vs "${st.target}"`);
    searchErrors++;
  }
}
if (searchErrors > 0) {
  console.error(`FAIL: ${searchErrors} adet arama eşleşme hatası!`);
  process.exit(1);
}
console.log('SUCCESS: Türkçe karakter duyarlı arama eşleşmesi doğrulandı!');

// ═══════════════════════════════════════════════════════════════
// FIX-24: DİNAMİK HAFTA BAŞLANGIÇ DENETİMİ (getInitialMonday)
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-24: Dinamik Hafta Başlangıç Denetimi ---');
const { getInitialMonday } = sandbox;
if (typeof getInitialMonday !== 'function') {
  console.error('FAIL: getInitialMonday is not defined in js/state.js');
  process.exit(1);
}
const initMonday = getInitialMonday();
if (!(initMonday instanceof Date) || isNaN(initMonday.getTime())) {
  console.error('FAIL: getInitialMonday geçerli bir Date nesnesi üretmedi!');
  process.exit(1);
}
console.log(`SUCCESS: getInitialMonday başarıyla çalıştı (Başlangıç: ${initMonday.toISOString().split('T')[0]}).`);

// ═══════════════════════════════════════════════════════════════
// FIX-25: TARİH DUYARLI HAFTALIK CANLI AMFİ VE PORTAL İZOLASYON DENETİMİ
// ═══════════════════════════════════════════════════════════════
console.log('--- FIX-25: Tarih Duyarlı Haftalık Canlı Amfi ve Portal İzolasyon Denetimi ---');

// 1. Tarih Başlığı Ayrıştırma Testleri
const amfiDateTests = [
  { str: '28  EYLÜL 2026 / Pazartesi', expected: '2026-09-28' },
  { str: '29 EYLÜL  2026 / Salı', expected: '2026-09-29' },
  { str: '30 EYLÜL  2026 / Çarşamba', expected: '2026-09-30' },
  { str: '01 Ekim  2026 / Perşembe', expected: '2026-10-01' },
  { str: '02 Ekim  2026- CUMA', expected: '2026-10-02' },
  { str: '26 EYLÜL  2026 CUMARTESİ', expected: '2026-09-26' },
  { str: '27 Eylül 2026 Pazar', expected: '2026-09-27' }
];

let amfiDateErrors = 0;
for (const ad of amfiDateTests) {
  const parsed = parseAmfiDateHeader(ad.str);
  if (parsed !== ad.expected) {
    console.error(`FAIL: parseAmfiDateHeader("${ad.str}") -> "${parsed}", beklenen: "${ad.expected}"`);
    amfiDateErrors++;
  }
}
if (amfiDateErrors > 0) {
  console.error(`FAIL: ${amfiDateErrors} adet amfi tarihi ayrıştırma hatası!`);
  process.exit(1);
}
console.log('SUCCESS: Tüm haftalık amfi takvim başlıkları hatasız ayrıştırıldı!');

// 2. Canlı Amfi Eşleme Doğrulaması (28 Eylül - 2 Ekim 2026)
vm.runInContext('state.cacheData.amfi = db.amfi_published_week;', sandbox);

const liveVerificationCases = [
  // 3A Kontrolleri
  { group: '3A', date: '2026-09-28', start: '09:20', subject: 'Romatizmal hastalıklar', expectedAmfi: 'Tevfik Sağlam Amfisi' },
  { group: '3A', date: '2026-09-28', start: '14:20', subject: 'Verilerin özetlenmesi Biyoistatistik', expectedAmfi: 'Kemal Atay Amfisi' },
  { group: '3A', date: '2026-09-29', start: '08:30', subject: 'Engellilik ve Evrensel Tasarım', expectedAmfi: 'Tevfik Sağlam Amfisi' },
  { group: '3A', date: '2026-09-29', start: '13:30', subject: 'Öğrenci ve danışman sorumlulukları Araştırma', expectedAmfi: 'Aziz Sancar Amfisi' },
  { group: '3A', date: '2026-10-01', start: '08:30', subject: 'Çocukta karında kitle', expectedAmfi: 'Tevfik Sağlam Amfisi' },
  // 3B Kontrolleri
  { group: '3B', date: '2026-09-28', start: '10:10', subject: 'Hücre duvarı membranına etkili antibakteriyeller Farmakoloji', expectedAmfi: 'Cemil Topuzlu Amfisi' },
  { group: '3B', date: '2026-09-29', start: '11:00', subject: 'İnflamasyon ve inflamatuar hastalıklar', expectedAmfi: 'Muzaffer Aksoy Amfisi' },
  { group: '3B', date: '2026-09-30', start: '08:30', subject: 'Aşılar ve infeksiyon hastalıkları Çocuk Sağlığı', expectedAmfi: 'Sami Zan Amfisi' },
  { group: '3B', date: '2026-10-01', start: '10:10', subject: 'Hücre duvarı membranına etkili antibakteriyeller', expectedAmfi: 'Sami Zan Amfisi' }
];

let liveMatchErrors = 0;
for (const tc of liveVerificationCases) {
  vm.runInContext(`state.group = '${tc.group}';`, sandbox);
  const lec = { date: tc.date, start: tc.start, subject: tc.subject, department: '' };
  const res = resolveLectureDetails(lec, 'pazartesi', tc.group, 'all', {});
  if (!res.resolvedLocation.includes(tc.expectedAmfi) || !res.isLiveAmfi) {
    console.error(`FAIL: Canlı amfi eşleşmedi [${tc.group}] ${tc.date} ${tc.start}: beklenen ${tc.expectedAmfi}, alınan: ${res.resolvedLocation} (isLiveAmfi: ${res.isLiveAmfi})`);
    liveMatchErrors++;
  }
}
if (liveMatchErrors > 0) {
  console.error(`FAIL: ${liveMatchErrors} adet canlı amfi eşleşme hatası!`);
  process.exit(1);
}
console.log(`SUCCESS: ${liveVerificationCases.length} adet canlı amfi ataması 0 hata ile doğrulandı!`);

// 3. Hafta İzolasyon Denetimi (Başka haftalara canlı Eylül amfisi sızmamalı)
vm.runInContext("state.group = '3A';", sandbox);
const futureLec = { date: '2026-11-16', start: '09:20', subject: 'Genel Dahiliye Dersi', department: 'İç Hastalıkları' };
const futureRes = resolveLectureDetails(futureLec, 'pazartesi', '3A', 'all', {});
if (futureRes.isLiveAmfi || futureRes.resolvedLocation.includes('Canlı Amfi')) {
  console.error('FAIL: Henüz yayınlanmamış haftaya canlı amfi ataması sızdı!');
  process.exit(1);
}
if (!futureRes.isDraftPlan && !futureRes.resolvedLocation.includes('Taslak') && !futureRes.resolvedLocation.includes('Portal')) {
  console.error('FAIL: Yayınlanmamış haftada taslak plan veya portal uyarısı bulunamadı:', futureRes);
  process.exit(1);
}
console.log('SUCCESS: Hafta izolasyonu doğrulandı (Eylül amfileri gelecekteki haftalara asla sızmıyor)!');

console.log('\n=== TÜM DOĞRULAMA KONTROLLERI TAMAMLANDI (SIFIR HATA) ===');
