/**
 * İÜ Tıp Fakültesi Dönem 3 — Arayüz Çizimi (Render) ve DOM Güncellemeleri
 */

function renderSchedule() {
  const lectures = state.cacheData[state.group];
  if (!lectures || !Array.isArray(lectures)) {
    showLoading(false);
    return;
  }

  showLoading(false);

  const monday = new Date(state.currentMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const startISO = formatDate(monday);
  const endISO = formatDate(friday);

  const d1 = monday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const d2 = friday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  
  const weekRangeElem = document.getElementById('currentWeekRange');
  if (weekRangeElem) weekRangeElem.innerText = `${d1} – ${d2}`;
  
  const printDateRangeElem = document.getElementById('printDateRange');
  if (printDateRangeElem) printDateRangeElem.innerText = `${d1} – ${d2}`;

  // 5 Günlük Kolon Hazırla
  const weekDays = [];
  for (let i = 0; i < 5; i++) {
    const curr = new Date(monday);
    curr.setDate(monday.getDate() + i);
    const iso = formatDate(curr);
    weekDays.push({
      dateObj: curr,
      isoDate: iso,
      dayName: curr.toLocaleDateString('tr-TR', { weekday: 'long' }),
      dateFormatted: curr.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
      lectures: []
    });
  }

  // Rotasyon tabloları (Dahili DB'den)
  const rotations = state.db ? (state.group === '3A' ? state.db.rotations_3A : state.db.rotations_3B) : {};
  const labs = state.db ? (state.db.laboratories || {}) : {};

  const searchLower = state.searchQuery.toLowerCase().trim();

  for (const lec of lectures) {
    const iso = lec.date;
    if (iso < startISO || iso > endISO) continue;

    const gun = lec.date_str ? lec.date_str.split(/\s+/).pop() : '';
    const details = resolveLectureDetails(lec, gun, state.group, state.subgroup, rotations);

    const isFree = details.cardType === 'free';
    if (isFree && !state.showFreeStudy && !searchLower) continue;

    // Laboratuvar kontrolü (Tıbbi Patoloji & Mikrobiyoloji)
    let note = details.note;
    const dayLabs = labs[iso];
    if (dayLabs && state.subgroup !== 'all') {
      for (const labItem of dayLabs) {
        if (labItem.groups && labItem.groups.includes(state.subgroup)) {
          note += (note ? ' | ' : '') + `🧫 ${labItem.type} Pratiği (${labItem.time})`;
        }
      }
    }

    // Arama filtresi: konu, anabilim dalı, çözümlenmiş konum ve notlar içinde arama yapar
    if (searchLower) {
      const fullSearchText = `${lec.subject} ${lec.department} ${lec.location_raw} ${details.resolvedLocation} ${note}`.toLowerCase();
      if (!fullSearchText.includes(searchLower)) continue;
    }

    const targetDay = weekDays.find(d => d.isoDate === iso);
    if (targetDay) {
      targetDay.lectures.push({
        start: lec.start,
        end: lec.end,
        subject: isFree ? 'Serbest Çalışma' : (lec.subject || ''),
        department: lec.department,
        yer: details.resolvedLocation,
        note,
        cardType: details.cardType,
        badge: details.badge
      });
    }
  }

  weekDays.forEach(d => {
    d.lectures.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  });

  const totalLectures = weekDays.reduce((acc, d) => acc + d.lectures.length, 0);
  const grid = document.getElementById('scheduleGrid');
  const emptyState = document.getElementById('emptyState');
  const mobileDayTabs = document.getElementById('mobileDayTabs');

  if (totalLectures === 0) {
    if (grid) grid.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (mobileDayTabs) mobileDayTabs.classList.add('hidden');
    updateLiveUpcoming(null);
    return;
  }

  if (grid) grid.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');
  if (mobileDayTabs) mobileDayTabs.classList.remove('hidden');

  if (grid) {
    grid.innerHTML = weekDays.map((day, idx) => `
      <div data-day-index="${idx}" class="day-column bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div class="day-header px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm capitalize">${day.dayName}</h4>
            <p class="text-[10px] sm:text-[11px] text-slate-500 font-medium">${day.dateFormatted}</p>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${day.lectures.length > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-400'}">
            ${day.lectures.length} Ders
          </span>
        </div>

        <div class="p-2.5 space-y-2 flex-1 flex flex-col">
          ${day.lectures.length === 0 ? `
            <div class="flex-1 flex flex-col items-center justify-center py-8 text-slate-400 text-center">
              <i data-lucide="coffee" class="w-5 h-5 mb-1 opacity-40"></i>
              <span class="text-[11px]">Ders Yok</span>
            </div>
          ` : day.lectures.map(lec => getLectureCardHTML(lec)).join('')}
        </div>
      </div>
    `).join('');
  }

  renderMobileDayTabs(weekDays);

  if (window.lucide) lucide.createIcons();
  updateLiveUpcoming(weekDays);
}

function renderMobileDayTabs(weekDays) {
  const container = document.getElementById('mobileDayTabs');
  if (!container) return;

  // Aktif günü belirle (Otomatik ise bugünü bul, yoksa Pazartesi'ye geç)
  let activeIndex = state.selectedMobileDay;
  if (activeIndex === 'auto') {
    const now = new Date();
    const todayISO = formatDate(now);
    const foundIdx = weekDays.findIndex(d => d.isoDate === todayISO);
    activeIndex = foundIdx !== -1 ? foundIdx : 0;
    state.selectedMobileDay = activeIndex;
  }

  const shortNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
  let html = `<div class="grid grid-cols-6 gap-1 p-1 bg-slate-200/80 rounded-xl shadow-2xs">`;

  weekDays.forEach((day, idx) => {
    const isSelected = (activeIndex === idx);
    const dayNum = day.dateFormatted ? day.dateFormatted.split(' ')[0] : (idx + 1);
    const activeClasses = isSelected
      ? 'bg-indigo-600 text-white shadow-xs font-bold ring-1 ring-indigo-600'
      : 'bg-white/80 text-slate-700 hover:bg-white hover:text-indigo-900 font-semibold';

    html += `
      <button type="button" data-day-index="${idx}" class="btn-mobile-day flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all ${activeClasses}">
        <span class="text-[11px] leading-tight">${shortNames[idx] || day.dayName.substring(0, 3)}</span>
        <span class="text-[9.5px] opacity-80 leading-tight mt-0.5">${dayNum}</span>
      </button>
    `;
  });

  const isAllSelected = (activeIndex === 'all');
  const allActiveClasses = isAllSelected
    ? 'bg-indigo-600 text-white shadow-xs font-bold ring-1 ring-indigo-600'
    : 'bg-white/80 text-slate-700 hover:bg-white hover:text-indigo-900 font-semibold';

  html += `
    <button type="button" data-day-index="all" class="btn-mobile-day flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all ${allActiveClasses}">
      <span class="text-[11px] leading-tight">Tüm</span>
      <span class="text-[9.5px] opacity-80 leading-tight mt-0.5">Hafta</span>
    </button>
  </div>`;

  container.innerHTML = html;

  container.querySelectorAll('.btn-mobile-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.dayIndex;
      state.selectedMobileDay = (val === 'all') ? 'all' : parseInt(val, 10);
      renderMobileDayTabs(weekDays);
      updateDayColumnsVisibility();
    });
  });

  updateDayColumnsVisibility();
}

function updateDayColumnsVisibility() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;

  const activeIndex = state.selectedMobileDay;
  const cols = grid.querySelectorAll('.day-column');

  cols.forEach((col, idx) => {
    if (activeIndex === 'all' || activeIndex === idx) {
      col.classList.remove('hidden');
      col.classList.add('flex');
    } else {
      col.classList.add('hidden');
      col.classList.remove('flex');
      col.classList.add('md:flex');
    }
  });
}

function getLectureCardHTML(lec) {
  let borderClass = 'border-l-4 border-indigo-500 bg-indigo-50/40 text-indigo-950';
  let badge = lec.badge || 'Teorik';
  let badgeClass = 'bg-indigo-100 text-indigo-700 font-semibold';

  if (badge === 'Seçmeli') {
    borderClass = 'border-l-4 border-purple-500 bg-purple-50/40 text-purple-950';
    badgeClass = 'bg-purple-100 text-purple-800 font-bold';
  } else if (lec.cardType === 'practice') {
    borderClass = 'border-l-4 border-amber-500 bg-amber-50/40 text-amber-950';
    badgeClass = 'bg-amber-100 text-amber-800 font-bold';
  } else if (lec.cardType === 'hospital') {
    borderClass = 'border-l-4 border-emerald-500 bg-emerald-50/40 text-emerald-950';
    badgeClass = 'bg-emerald-100 text-emerald-800 font-bold';
  } else if (lec.cardType === 'free') {
    borderClass = 'border-l-4 border-slate-300 bg-slate-50 text-slate-500 opacity-70';
    badgeClass = 'bg-slate-200 text-slate-600 font-normal';
  }

  return `
    <div class="lecture-card p-2.5 rounded-xl border border-slate-100 shadow-2xs ${borderClass} transition-all hover:shadow-sm">
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="text-[10px] font-mono font-bold text-slate-700 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200/60 shadow-2xs">
          ${lec.start} - ${lec.end}
        </span>
        <span class="text-[9px] px-1.5 py-0.5 rounded ${badgeClass}">
          ${badge}
        </span>
      </div>

      <h5 class="text-[11px] font-bold leading-tight mt-1 text-slate-900">${lec.subject}</h5>

      <div class="mt-2 text-[10.5px] flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100/90 px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-indigo-600 shrink-0"></i>
        <div class="truncate flex-1">${lec.yer}</div>
      </div>

      ${lec.note ? `
        <div class="mt-1.5 pt-1 border-t border-amber-200/70 text-[9px] text-amber-900 font-bold flex items-center gap-1">
          <i data-lucide="sparkles" class="w-2.5 h-2.5 text-amber-600 shrink-0"></i>
          <span class="leading-tight">${lec.note}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function updateLiveUpcoming(weekDays) {
  const banner = document.getElementById('todayLiveBanner');
  if (!banner) return;
  
  if (!weekDays) {
    banner.classList.add('hidden');
    return;
  }

  const now = new Date();
  const todayISO = formatDate(now);
  const todayDay = weekDays.find(d => d.isoDate === todayISO);

  if (!todayDay || todayDay.lectures.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentOrNext = null;
  for (const l of todayDay.lectures) {
    const [h1, m1] = (l.start || '00:00').split(':').map(Number);
    const [h2, m2] = (l.end || '00:00').split(':').map(Number);
    const startMin = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;

    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      currentOrNext = { ...l, status: 'Şu anki Ders' };
      break;
    } else if (startMin > currentMinutes) {
      currentOrNext = { ...l, status: 'Sıradaki Ders' };
      break;
    }
  }

  if (!currentOrNext) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const dayTextElem = document.getElementById('liveDayText');
  if (dayTextElem) dayTextElem.innerText = `${todayDay.dayName} — ${currentOrNext.status} (${currentOrNext.start} - ${currentOrNext.end})`;
  
  const lessonElem = document.getElementById('liveUpcomingLesson');
  if (lessonElem) lessonElem.innerText = currentOrNext.subject;
  
  const locElem = document.getElementById('liveUpcomingLocation');
  if (locElem) {
    if (typeof currentOrNext.yer === 'string' && currentOrNext.yer.includes('<a ')) {
      locElem.innerHTML = currentOrNext.yer;
    } else {
      locElem.innerText = currentOrNext.yer;
    }
  }
  
  if (window.lucide) lucide.createIcons();
}

function renderSubgroupButtons() {
  const container = document.getElementById('subgroupContainer');
  if (!container) return;
  const prefix = state.group === '3A' ? 'A' : 'B';
  const isAll = !state.subgroup || state.subgroup.toLowerCase() === 'all';
  
  let html = `
    <button data-sub="all" class="subgroup-btn px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${isAll ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
      Tüm Sınıf
    </button>
  `;

  for (let i = 1; i <= 8; i++) {
    const sg = `${prefix}${i}`;
    const isActive = !isAll && state.subgroup.toUpperCase() === sg;
    html += `
      <button data-sub="${sg}" class="subgroup-btn px-2 py-1 text-xs font-bold rounded-lg transition-all ${isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
        ${sg}
      </button>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.subgroup-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subgroup = btn.dataset.sub;
      saveUserProfile(state.group, state.subgroup);
      renderSubgroupButtons();
      updateSelectionBadge();
      renderSchedule();
    });
  });
}

function updateSelectionBadge() {
  const isAll = !state.subgroup || state.subgroup.toLowerCase() === 'all';
  const subLabel = isAll ? 'Tüm Sınıf' : `Grup ${state.subgroup.toUpperCase()}`;
  const fullLabel = `Dönem ${state.group} — ${subLabel}`;
  
  const badgeCurrent = document.getElementById('badgeCurrentSelection');
  if (badgeCurrent) {
    badgeCurrent.innerHTML = `
      <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
      ${fullLabel}
    `;
  }
  
  const printBadge = document.getElementById('printBadgeInfo');
  if (printBadge) printBadge.innerText = fullLabel;
  
  const headerProf = document.getElementById('headerProfileName');
  if (headerProf) headerProf.innerText = isAll ? state.group : state.subgroup.toUpperCase();
  
  // URL Hash güncelle (Tüm sınıf ise sadece #3A, alt grup ise #3A-A1)
  window.location.hash = isAll ? state.group : `${state.group}-${state.subgroup.toUpperCase()}`;
  if (window.lucide) lucide.createIcons();
}

function setGroup(grp) {
  if (state.group === grp) return;
  state.group = grp;
  state.subgroup = 'all';

  const tab3A = document.getElementById('tab3A');
  const tab3B = document.getElementById('tab3B');

  if (grp === '3A') {
    if (tab3A) tab3A.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all shadow-xs bg-white text-indigo-700";
    if (tab3B) tab3B.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-slate-900";
  } else {
    if (tab3B) tab3B.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all shadow-xs bg-white text-indigo-700";
    if (tab3A) tab3A.className = "px-3 py-1 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-slate-900";
  }

  saveUserProfile(state.group, state.subgroup);
  renderSubgroupButtons();
  updateSelectionBadge();
  renderSchedule();
}

function changeWeek(direction) {
  const next = new Date(state.currentMonday);
  next.setDate(next.getDate() + (direction * 7));
  state.currentMonday = next;
  renderSchedule();
}

function openProfileModal() {
  profileModalSelection.group = state.group;
  profileModalSelection.subgroup = state.subgroup;
  updateProfileModalUI();
  const modal = document.getElementById('modalProfile');
  if (modal) modal.classList.remove('hidden');
}

function updateProfileModalUI() {
  const btn3A = document.getElementById('btnProfile3A');
  const btn3B = document.getElementById('btnProfile3B');

  if (btn3A && btn3B) {
    if (profileModalSelection.group === '3A') {
      btn3A.className = "p-3 rounded-xl border-2 font-bold text-center transition-all border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-2xs";
      btn3B.className = "p-3 rounded-xl border-2 font-bold text-center transition-all border-slate-200 hover:border-slate-300 text-slate-700";
    } else {
      btn3B.className = "p-3 rounded-xl border-2 font-bold text-center transition-all border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-2xs";
      btn3A.className = "p-3 rounded-xl border-2 font-bold text-center transition-all border-slate-200 hover:border-slate-300 text-slate-700";
    }
  }

  const grid = document.getElementById('profileSubgroupGrid');
  if (!grid) return;
  const prefix = profileModalSelection.group === '3A' ? 'A' : 'B';

  const isProfAll = !profileModalSelection.subgroup || profileModalSelection.subgroup.toLowerCase() === 'all';

  let html = `
    <button type="button" data-sg="all" class="prof-sg-btn p-2 rounded-lg border text-center font-bold text-xs col-span-4 transition-all ${isProfAll ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
      Tüm Sınıf (${profileModalSelection.group})
    </button>
  `;

  for (let i = 1; i <= 8; i++) {
    const sg = `${prefix}${i}`;
    const isActive = !isProfAll && profileModalSelection.subgroup.toUpperCase() === sg;
    html += `
      <button type="button" data-sg="${sg}" class="prof-sg-btn p-2 rounded-lg border text-center font-bold text-xs transition-all ${isActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}">
        ${sg}
      </button>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.prof-sg-btn').forEach(b => {
    b.addEventListener('click', () => {
      profileModalSelection.subgroup = b.dataset.sg;
      updateProfileModalUI();
    });
  });
}

function copyWhatsAppText() {
  const monday = new Date(state.currentMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const d1 = monday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' });
  const d2 = friday.toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric', year: 'numeric' });

  let text = `🩺 *İÜ TIP FAKÜLTESİ — DÖNEM ${state.group}*`;
  if (state.subgroup !== 'all') text += ` (Grup: ${state.subgroup})`;
  text += `\n🗓️ *Haftalık Program:* ${d1} – ${d2}\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;
  const days = grid.children;

  let hasLecture = false;
  for (const dayCol of days) {
    const dayTitle = dayCol.querySelector('h4')?.innerText || '';
    const dayDate = dayCol.querySelector('p')?.innerText || '';
    const cards = dayCol.querySelectorAll('.lecture-card');

    if (cards.length > 0) {
      hasLecture = true;
      text += `📌 *${dayTitle.toUpperCase()} (${dayDate})*\n`;
      cards.forEach(c => {
        const time = c.querySelector('.font-mono')?.innerText || '';
        const subject = c.querySelector('h5')?.innerText || '';
        const loc = c.querySelector('.truncate')?.innerText || '';
        text += `⏰ \`${time}\`\n📚 ${subject}\n📍 ${loc}\n────────────────\n`;
      });
      text += '\n';
    }
  }

  if (!hasLecture) {
    text += '🏖️ Bu hafta kayıtlı ders görünmüyor.\n';
  }

  text += `_🔗 Program linki: ${window.location.origin}${window.location.pathname}#${state.group}-${state.subgroup}_`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('WhatsApp formatında panoya kopyalandı!');
  }).catch(() => {
    showToast('Kopyalama başarısız oldu.');
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  const msgElem = document.getElementById('toastMessage');
  if (msgElem) msgElem.innerText = msg;
  if (t) {
    t.classList.remove('translate-y-12', 'opacity-0');
    setTimeout(() => {
      t.classList.add('translate-y-12', 'opacity-0');
    }, 2500);
  }
}

function showLoading(show) {
  const loadElem = document.getElementById('loadingState');
  if (loadElem) loadElem.classList.toggle('hidden', !show);
  if (show) {
    const grid = document.getElementById('scheduleGrid');
    if (grid) grid.classList.add('hidden');
    const empty = document.getElementById('emptyState');
    if (empty) empty.classList.add('hidden');
  }
}

function showError(msg) {
  const err = document.getElementById('errorState');
  const msgElem = document.getElementById('errorMessageText');
  if (msgElem) msgElem.innerText = msg;
  if (err) err.classList.remove('hidden');
}

function hideError() {
  const err = document.getElementById('errorState');
  if (err) err.classList.add('hidden');
}
