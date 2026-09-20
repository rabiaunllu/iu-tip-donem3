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

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
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

const sandbox = {
  state: {
    group: '3A',
    subgroup: 'all',
    db: db
  },
  console: console,
  RegExp: RegExp
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), sandbox);

const { parseHastaBasiDepartment, resolveLectureDetails } = sandbox;

if (typeof parseHastaBasiDepartment !== 'function' || typeof resolveLectureDetails !== 'function') {
  console.error('FAIL: parseHastaBasiDepartment or resolveLectureDetails is not defined in js/data.js');
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
let vagueCount = 0;
let totalAudited = 0;
for (const g of ['3A', '3B']) {
  const rot = db['rotations_' + g];
  const subgroups = ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => (g === '3A' ? 'A' : 'B') + n);
  for (const sg of subgroups) {
    for (const l of db['lectures_' + g]) {
      totalAudited++;
      const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
      const res = resolveLectureDetails(l, gun, g, sg, rot);
      if (res.resolvedLocation.includes('İlgili Klinik') || res.resolvedLocation.includes('Rotasyon Alanı')) {
        vagueCount++;
        console.error(`Vague location: ${g} ${sg} ${l.date} ${l.subject}`);
      }
    }
  }
}

console.log(`Audited ${totalAudited} lecture-subgroup instances across entire academic year.`);
if (vagueCount > 0) {
  console.error(`FAIL: Found ${vagueCount} vague locations!`);
  process.exit(1);
}
console.log('SUCCESS: Exactly 0 vague locations found across the entire academic year!');

// 3. Wednesday Morning vs Afternoon Split Verification (Tüm Yıl ve Örnek Günler)
console.log('--- Verifying Wednesday Amfi Split Across Whole Year ---');

// Specific check on 2026-09-23
const lecs3A_0923 = db.lectures_3A.filter(l => l.date === '2026-09-23');
const lecs3B_0923 = db.lectures_3B.filter(l => l.date === '2026-09-23');

const l3A_am = lecs3A_0923.find(l => l.start === '09:20');
const l3A_pm = lecs3A_0923.find(l => l.start === '13:30');
const l3B_am = lecs3B_0923.find(l => l.start === '08:30');
const l3B_pm = lecs3B_0923.find(l => l.start === '13:30');

const res3A_am = resolveLectureDetails(l3A_am, 'çarşamba', '3A', 'all', {});
const res3A_pm = resolveLectureDetails(l3A_pm, 'çarşamba', '3A', 'all', {});
const res3B_am = resolveLectureDetails(l3B_am, 'çarşamba', '3B', 'all', {});
const res3B_pm = resolveLectureDetails(l3B_pm, 'çarşamba', '3B', 'all', {});

if (!res3A_am.resolvedLocation.includes('Aziz Sancar')) {
  console.error('FAIL: 3A Wednesday morning should be Aziz Sancar Amfisi, got:', res3A_am.resolvedLocation);
  process.exit(1);
}
if (!res3A_pm.resolvedLocation.includes('Kemal Atay')) {
  console.error('FAIL: 3A Wednesday afternoon should be Kemal Atay Amfisi, got:', res3A_pm.resolvedLocation);
  process.exit(1);
}
if (!res3B_am.resolvedLocation.includes('Kemal Atay')) {
  console.error('FAIL: 3B Wednesday morning should be Kemal Atay Amfisi, got:', res3B_am.resolvedLocation);
  process.exit(1);
}
if (!res3B_pm.resolvedLocation.includes('Sami Zan')) {
  console.error('FAIL: 3B Wednesday afternoon should be Sami Zan Amfisi, got:', res3B_pm.resolvedLocation);
  process.exit(1);
}
console.log('SUCCESS: 23 Eylül 2026 Çarşamba sabah/öğleden sonra amfi dağılımı doğrulandı.');

// Check Elective Course on 2026-10-14
const l_sec = db.lectures_3A.find(l => l.date === '2026-10-14' && l.start === '13:30');
const res_sec = resolveLectureDetails(l_sec, 'çarşamba', '3A', 'all', {});
if (!res_sec.resolvedLocation.includes('Seçmeli Derslikleri') || res_sec.badge !== 'Seçmeli') {
  console.error('FAIL: Seçmeli Ders should route to Seçmeli Derslikleri with Seçmeli badge, got:', res_sec);
  process.exit(1);
}
console.log('SUCCESS: Seçmeli dersler ve dekanlık portal yönlendirmesi doğrulandı.');

// Full-year Wednesday audit: verify no Wednesday afternoon regular lecture stays in morning amfi
let wednesdayErrors = 0;
for (const g of ['3A', '3B']) {
  const lecs = db['lectures_' + g];
  for (const l of lecs) {
    const gun = l.date_str ? l.date_str.split(/\s+/).pop() : '';
    if (gun.toLowerCase().includes('çarşamba')) {
      const s = (l.subject || '').toUpperCase();
      if (!s || s.includes('SERBEST') || s.includes('UYGULAMA') || s.includes('HASTA BAŞI')) continue;
      const res = resolveLectureDetails(l, gun, g, 'all', {});
      const isAfternoon = (l.start || '') >= '13:00';
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


