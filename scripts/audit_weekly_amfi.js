/**
 * İÜ Tıp Fakültesi — Haftalık Resmi Amfi & Ders Güvenlik Denetim Aracı
 * 
 * Amaç: Öğrencilerin tek bir dersi bile kaçırmaması, amfisiz ders kalmaması
 * ve dekanlık e-tablosu ile müfredat arasında %100 güven oluşturulması.
 * 
 * Çalıştır: node scripts/audit_weekly_amfi.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DB_PATH = path.join(__dirname, '..', 'data', 'schedule_2026_2027.json');
if (!fs.existsSync(DB_PATH)) {
  console.error('HATA: data/schedule_2026_2027.json bulunamadı!');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// VM Sandbox Kurulumu
const configCode = fs.readFileSync(path.join(__dirname, '..', 'js/config.js'), 'utf8');
const utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js/utils.js'), 'utf8');
const stateCode = fs.readFileSync(path.join(__dirname, '..', 'js/state.js'), 'utf8');
const dataCode = fs.readFileSync(path.join(__dirname, '..', 'js/data.js'), 'utf8');

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
vm.runInContext(dataCode, sandbox);
vm.runInContext('state.db = db; state.cacheData.amfi = db.amfi_published_week;', sandbox);

const pubWeek = db.amfi_published_week || {};
const pubDates = pubWeek.publishedDates || [];

console.log('======================================================================');
console.log('       İSTANBUL TIP FAKÜLTESİ DÖNEM 3 — HAFTALIK AMFİ DENETİM RAPORU');
console.log('======================================================================');

if (pubDates.length === 0) {
  console.warn('UYARI: Henüz yayınlanmış bir amfi haftası bulunmuyor.');
  process.exit(0);
}

console.log(`Aktif Yayınlanan Hafta : ${pubDates[0]} - ${pubDates[pubDates.length - 1]} (${pubDates.length} Gün)`);
console.log(`Tarihler               : ${pubDates.join(', ')}`);
console.log('----------------------------------------------------------------------\n');

let totalTheoryAcrossAll = 0;
let totalMatchedAcrossAll = 0;
let totalUnmatchedAcrossAll = 0;
const unmatchedReport = [];

// ══════════════════════════════════════════════════════════════════
// 1. İLERİ YÖNLÜ DENETİM (DERS -> AMFİ): Tüm teorik dersler amfi buldu mu?
// ══════════════════════════════════════════════════════════════════
['3A', '3B'].forEach(grp => {
  console.log(`📌 GRUP ${grp} İLERİ YÖNLÜ AMFİ EŞLEŞTİRME DENETİMİ:`);
  sandbox.state.group = grp;
  const allLecs = db['lectures_' + grp] || [];
  const weekLecs = allLecs.filter(l => pubDates.includes(l.date));

  let groupTheory = 0;
  let groupMatched = 0;
  let groupUnmatched = 0;

  pubDates.forEach(date => {
    const dayLecs = weekLecs.filter(l => l.date === date);
    dayLecs.forEach(lec => {
      const details = sandbox.resolveLectureDetails(lec, 'pazartesi', grp, 'all', db['rotations_' + grp]);

      // Sadece teorik dersleri amfi eşleşmesi için denetle
      // (Hasta başı, laboratuvar, simüle hasta kendi kliniklerine atanır)
      if (details.cardType === 'theory' && !details.badge.includes('Seçmeli')) {
        groupTheory++;
        const loc = details.resolvedLocation || '';
        const isPending = loc.includes('Resmi Portalda Henüz Yayınlanmadı');

        if (isPending) {
          groupUnmatched++;
          unmatchedReport.push({
            group: grp,
            date: lec.date,
            start: lec.start,
            end: lec.end,
            subject: lec.subject,
            department: lec.department
          });
        } else {
          groupMatched++;
        }
      }
    });
  });

  const successRate = groupTheory > 0 ? ((groupMatched / groupTheory) * 100).toFixed(1) : '100.0';
  console.log(`  - Toplam Teorik Ders : ${groupTheory}`);
  console.log(`  - Eşleşen Amfi       : ${groupMatched} (%${successRate})`);
  console.log(`  - Açıkta Kalan Ders  : ${groupUnmatched}`);
  if (groupUnmatched === 0) {
    console.log(`  [✓] Grup ${grp} tüm dersleri %100 eksiksiz amfiye yerleşti!\n`);
  } else {
    console.log(`  [X] Grup ${grp} için ${groupUnmatched} ders amfi bulamadı!\n`);
  }

  totalTheoryAcrossAll += groupTheory;
  totalMatchedAcrossAll += groupMatched;
  totalUnmatchedAcrossAll += groupUnmatched;
});

// ══════════════════════════════════════════════════════════════════
// 2. TERSİNE DENETİM (TABLO -> DERS): Dekanlık tablosundaki Dönem 3 hücreleri
// ══════════════════════════════════════════════════════════════════
console.log('----------------------------------------------------------------------');
console.log('📌 TERSİNE DENETİM (DEKANLIK TABLOSU DÖNEM 3 HÜCRE ANALİZİ):');

let totalD3Slots = 0;
let unusedD3Slots = [];

pubDates.forEach(date => {
  const slots = (pubWeek.byDate && pubWeek.byDate[date]) || [];
  slots.forEach(slot => {
    const text = slot.text || '';
    // Dönem 3'e ait slotları tespit et (Dönem 1, 2, 4, 5, 6 hariç)
    const isD3 = /DÖNEM\s*3\b/i.test(text) || (/D3\b/i.test(text) && !/DÖNEM\s*[12456]\b/i.test(text));
    if (isD3) {
      totalD3Slots++;

      // Bu slot sistemdeki herhangi bir derse bağlandı mı?
      let matchedByAny = false;
      ['3A', '3B'].forEach(grp => {
        sandbox.state.group = grp;
        const lecs = (db['lectures_' + grp] || []).filter(l => l.date === date);
        for (const l of lecs) {
          const matchedAmfi = sandbox.matchLiveAmfi(l, [slot], grp);
          if (matchedAmfi) {
            matchedByAny = true;
            break;
          }
        }
      });

      // Eğer dersle eşleşmediyse, pratik veya kulüp faaliyeti mi kontrol et
      const isClubOrExam = /KULÜB|SINAV|SERBEST|BİTİRME/i.test(text);
      if (!matchedByAny && !isClubOrExam) {
        unusedD3Slots.push({
          date,
          start: slot.start,
          end: slot.end,
          amfi: slot.amfi,
          rawAmfi: slot.rawAmfi,
          text: slot.text
        });
      }
    }
  });
});

console.log(`  - Tablodaki Toplam Dönem 3 Hücresi : ${totalD3Slots}`);
console.log(`  - Açıkta Kalan / Eşleşmeyen Hücre  : ${unusedD3Slots.length}`);
if (unusedD3Slots.length === 0) {
  console.log(`  [✓] Dekanlık tablosundaki tüm Dönem 3 hücreleri başarıyla müfredata bağlandı!\n`);
} else {
  console.log(`  [!] Dikkat: Aşağıdaki Dönem 3 hücreleri müfredattaki hiçbir dersle eşleşmedi:`);
  unusedD3Slots.forEach(u => {
    console.log(`      * [${u.date} ${u.start}-${u.end}] ${u.amfi}: "${u.text}"`);
  });
  console.log('');
}

// ══════════════════════════════════════════════════════════════════
// 3. GENEL SONUÇ VE GÜVEN SKORU
// ══════════════════════════════════════════════════════════════════
console.log('======================================================================');
console.log('                           SONUÇ VE KARAR');
console.log('======================================================================');
const overallRate = totalTheoryAcrossAll > 0 ? ((totalMatchedAcrossAll / totalTheoryAcrossAll) * 100).toFixed(1) : '100.0';
console.log(`Genel Eşleşme Oranı       : %${overallRate} (${totalMatchedAcrossAll} / ${totalTheoryAcrossAll} Ders)`);
console.log(`Açıkta Kalan Teorik Ders  : ${totalUnmatchedAcrossAll}`);
console.log(`Eşleşmeyen Tablo Hücresi  : ${unusedD3Slots.length}`);

if (totalUnmatchedAcrossAll > 0) {
  console.error('\n🔴 DİKKAT: Açıkta kalan dersler tespit edildi!');
  unmatchedReport.forEach(u => {
    console.error(`  - [${u.group}] ${u.date} ${u.start}: ${u.subject}`);
  });
  console.error('\nLütfen bu derslerin amfi kurallarını kontrol ediniz. Öğrenciler mağdur olmamalıdır.');
  process.exit(1);
} else {
  console.log('\n🟢 BAŞARILI: Hiçbir öğrenci mağdur olmayacak şekilde tüm dersler amfiye bağlandı.');
  console.log('Sistem öğrenciler için %100 güvenli ve yayına hazır!');
  process.exit(0);
}
