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

