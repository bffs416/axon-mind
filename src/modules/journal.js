import { supabase, $, showToast } from './config.js';

export function initJournal(deps) {
  const { showMultipotentialSummary } = deps;
  // ==================== DIARIO DE PAREJA ====================
  let selectedMood = '😊';
  window.selectMood = (mood, btn) => {
      document.querySelectorAll('.mood-btn').forEach(b => { b.style.transform = 'scale(1)'; b.style.filter = 'grayscale(1)'; });
      btn.style.transform = 'scale(1.3)';
      btn.style.filter = 'none';
      selectedMood = mood;
  };
  
  // ==================== MICRO CHECKINS ====================
  function showMicroCheckin() {
      const toast = $('motivation-toast');
      if (!toast || toast.classList.contains('show')) return; // Ya hay un toast activo
  
      const todayISO = new Date().toISOString().slice(0, 10);
      const checkins = JSON.parse(localStorage.getItem('axon_micro_' + todayISO) || '[]');
      if (checkins.length >= 8) return; // Máximo 8 check-ins al día
  
      toast.innerHTML = `
          <span style="margin-right:0.5rem;">¿Cómo vas?</span>
          <button onclick="window.microCheckin('high'); document.getElementById('motivation-toast').classList.remove('show');" style="background:transparent;border:none;font-size:1.3rem;cursor:pointer;padding:0 0.3rem;">⚡</button>
          <button onclick="window.microCheckin('medium'); document.getElementById('motivation-toast').classList.remove('show');" style="background:transparent;border:none;font-size:1.3rem;cursor:pointer;padding:0 0.3rem;">🔋</button>
          <button onclick="window.microCheckin('low'); document.getElementById('motivation-toast').classList.remove('show');" style="background:transparent;border:none;font-size:1.3rem;cursor:pointer;padding:0 0.3rem;">🪫</button>
      `;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 6000);
  }
  
  window.microCheckin = (level) => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const checkins = JSON.parse(localStorage.getItem('axon_micro_' + todayISO) || '[]');
      checkins.push({ level, time: new Date().toISOString() });
      localStorage.setItem('axon_micro_' + todayISO, JSON.stringify(checkins));
  
      const labels = { high: '⚡ Alta', medium: '🔋 Media', low: '🪫 Baja' };
      showToast(`Registrado: ${labels[level] || level}`);
  };
  
  // ==================== MORNING CHECKIN ====================
  let morningSleepQuality = 3;
  
  window.selectSleepQuality = (quality, btn) => {
      morningSleepQuality = parseInt(quality);
      document.querySelectorAll('.sleep-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
  };
  
  window.openMorningCheckin = () => {
      const profile = $('morning-profile').value;
      const todayISO = new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem('axon_morning_' + profile + '_' + todayISO));
  
      if (saved) {
          $('morning-form').style.display = 'none';
          $('morning-done').style.display = 'block';
          const emoji = profile === 'Pipe' ? '👨' : '👱‍♀️';
          if ($('morning-intention-show')) $('morning-intention-show').textContent = emoji + ' ' + profile + ': "' + (saved.intention || 'Sin intención específica') + '"';
      } else {
          $('morning-form').style.display = 'block';
          $('morning-done').style.display = 'none';
          morningSleepQuality = 3;
          document.querySelectorAll('.sleep-btn').forEach(b => b.classList.toggle('active', b.dataset.sleep === '3'));
          $('morning-sleep-hours').value = 7;
          $('morning-intention').value = '';
          $('morning-energy').value = 3;
      }
      $('morning-modal').style.display = 'flex';
  };
  
  window.saveMorningCheckin = () => {
      const profile = $('morning-profile').value;
      const todayISO = new Date().toISOString().slice(0, 10);
      const entry = {
          profile,
          sleep_quality: morningSleepQuality,
          hours: parseFloat($('morning-sleep-hours').value) || 7,
          intention: $('morning-intention').value.trim(),
          energy_start: parseInt($('morning-energy').value),
          timestamp: new Date().toISOString()
      };
      localStorage.setItem('axon_morning_' + profile + '_' + todayISO, JSON.stringify(entry));
  
      $('morning-form').style.display = 'none';
      $('morning-done').style.display = 'block';
      const emoji = profile === 'Pipe' ? '👨' : '👱‍♀️';
      if ($('morning-intention-show')) $('morning-intention-show').textContent = emoji + ' ' + profile + ': "' + (entry.intention || 'Sin intención específica') + '"';
      showToast('☀️ ¡' + profile + ', día empezado con intención!');
  };
  
  // ==================== JOURNAL STEPS NAVIGATION ====================
  window.journalGoToStep = (step) => {
      // Update step indicators
      document.querySelectorAll('.journal-step').forEach(el => {
          const elStep = parseInt(el.dataset.step);
          el.classList.remove('active');
          if (elStep === step) el.classList.add('active');
          else if (elStep < step) el.classList.add('done');
          else el.classList.remove('done');
      });
  
      // Show/hide step content
      for (let s = 1; s <= 3; s++) {
          const div = document.getElementById('journal-step-' + s);
          if (div) div.style.display = s === step ? 'block' : 'none';
      }
  
      // Update title
      const titles = { 1: '🏠 Rutinas', 2: '📊 Métricas', 3: '🧠 Reflexión' };
      const titleEl = $('journal-step-title');
      if (titleEl) titleEl.innerHTML = '🌙 Cierre — ' + (titles[step] || '');
  
      // On step 2: show morning comparison
      if (step === 2) showMorningComparison();
      // On step 3: render plan review
      if (step === 3) renderPlanReview();
  };
  
  // Auto-populate routine checklist when opening journal
  const journalModalObserver = new MutationObserver(() => {
      const modal = $('journal-modal');
      if (modal && modal.style.display === 'flex') {
          renderRoutineChecklist();
          window.journalGoToStep(1);
      }
  });
  document.addEventListener('DOMContentLoaded', () => {
      const modal = $('journal-modal');
      if (modal) journalModalObserver.observe(modal, { attributes: true, attributeFilter: ['style'] });
  });
  
  function renderRoutineChecklist() {
      const container = $('journal-routine-checklist');
      if (!container) return;
  
      const today = new Date().getDay();
      const todayRoutines = routines.filter(r => r.days.includes(today));
  
      if (todayRoutines.length === 0) {
          container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;">🌈 Hoy no tenías rutinas planeadas. ¡Día libre!</p>';
          return;
      }
  
      // Load saved state
      const todayISO = new Date().toISOString().slice(0, 10);
      const savedState = JSON.parse(localStorage.getItem('axon_routine_state_' + todayISO) || '{}');
  
      container.innerHTML = todayRoutines.map(r => {
          const done = savedState[r.id] === true;
          return `<div class="routine-check-item" style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border);">
              <input type="checkbox" id="routine-check-${r.id}" ${done ? 'checked' : ''} onchange="window.toggleRoutineCheck('${r.id}', this.checked)" style="accent-color:var(--success);width:18px;height:18px;cursor:pointer;">
              <label for="routine-check-${r.id}" style="cursor:pointer;flex:1;font-size:0.9rem;">${r.emoji} ${r.name} <span style="font-size:0.7rem;opacity:0.5;">${format12h(r.time)} (${formatDuration(r.duration)})</span></label>
          </div>`;
      }).join('');
  
      // Update streak indicator
      const totalDone = Object.values(savedState).filter(v => v === true).length;
      const summary = document.createElement('div');
      summary.style.cssText = 'text-align:center;font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem;';
      summary.textContent = `${totalDone}/${todayRoutines.length} completadas`;
      container.appendChild(summary);
  }
  
  window.toggleRoutineCheck = (routineId, checked) => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const state = JSON.parse(localStorage.getItem('axon_routine_state_' + todayISO) || '{}');
      state[routineId] = checked;
      localStorage.setItem('axon_routine_state_' + todayISO, JSON.stringify(state));
  
      // Update streaks
      if (checked) {
          const streaks = JSON.parse(localStorage.getItem('axon_routine_streaks') || '{}');
          const routine = routines.find(r => r.id === routineId);
          const todayDate = new Date().toDateString();
          if (!streaks[routineId]) streaks[routineId] = { streak: 1, last_date: todayDate, name: routine?.name || '' };
          else {
              const last = new Date(streaks[routineId].last_date);
              const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
              if (last.toDateString() === yesterday.toDateString()) streaks[routineId].streak++;
              else if (last.toDateString() !== todayDate) streaks[routineId].streak = 1;
              streaks[routineId].last_date = todayDate;
          }
          localStorage.setItem('axon_routine_streaks', JSON.stringify(streaks));
      }
  
      renderRoutineChecklist();
  };
  
  window.checkAllRoutines = () => {
      const today = new Date().getDay();
      const todayRoutines = routines.filter(r => r.days.includes(today));
      const todayISO = new Date().toISOString().slice(0, 10);
      const state = JSON.parse(localStorage.getItem('axon_routine_state_' + todayISO) || '{}');
      todayRoutines.forEach(r => { state[r.id] = true; });
      localStorage.setItem('axon_routine_state_' + todayISO, JSON.stringify(state));
      renderRoutineChecklist();
      showToast('✅ ¡Todas las rutinas marcadas!');
  };
  
  function showMorningComparison() {
      const container = $('morning-comparison');
      if (!container) return;
      const profile = $('journal-profile')?.value || 'Pipe';
      const todayISO = new Date().toISOString().slice(0, 10);
      const morning = JSON.parse(localStorage.getItem('axon_morning_' + profile + '_' + todayISO));
      if (!morning) { container.style.display = 'none'; return; }
      container.style.display = 'block';
      container.innerHTML = `☀️ ${profile} esta mañana: energía <strong>${'⚡'.repeat(morning.energy_start)}</strong> · sueño <strong>${morning.hours}h</strong> · intención: "<em>${morning.intention || 'ninguna'}</em>"`;
  }
  
  function renderPlanReview() {
      const container = $('journal-plan-review');
      if (!container) return;
  
      const today = new Date().toISOString().slice(0, 10);
      const todayBlocks = weekPlan.filter(b => b.day === today);
      const routineBlocks = getRoutineBlocksForDay(new Date());
  
      const allBlocks = [...routineBlocks.map(r => ({ ...r, isRoutine: true })), ...todayBlocks.map(b => ({ ...b, isRoutine: false }))];
  
      if (allBlocks.length === 0) {
          container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;">No tenías bloques planeados para hoy.</p>';
          return;
      }
  
      container.innerHTML = allBlocks.map(b => `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;font-size:0.85rem;">
              <select onchange="window.togglePlanFollowed('${b.id}', this.value)" style="padding:0.2rem;background:var(--bg-deep);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.75rem;">
                  <option value="">--</option>
                  <option value="done">✅</option>
                  <option value="skip">❌</option>
                  <option value="changed">🔄</option>
              </select>
              <span style="flex:1;">${b.emoji || ''} ${b.taskTitle} <span style="opacity:0.4;font-size:0.7rem;">${format12h(b.time)}</span></span>
              ${b.isRoutine ? '<span style="font-size:0.65rem;opacity:0.4;">🔒</span>' : ''}
          </div>
      `).join('');
  }
  
  window.togglePlanFollowed = (blockId, status) => { /* lightweeight - stored for future weekly summary */ };
  
  window.saveDailyJournal = async () => {
    const profile = $('journal-profile').value;
    const grat1 = $('journal-grat1')?.value.trim() || '';
    const grat2 = $('journal-grat2')?.value.trim() || '';
    const grat3 = $('journal-grat3')?.value.trim() || '';
    const wins = [grat1, grat2, grat3].filter(Boolean).join(' | ');
    const lesson = $('journal-lesson').value.trim();
    const family = $('journal-family').value.trim();
    const frustrations = $('journal-frustrations').value.trim();
    const sleep = parseFloat($('journal-sleep').value) || 7;
    const cardsStudied = parseInt($('journal-cards-studied')?.value) || 0;
    const studyTopics = $('journal-study-topics')?.value.trim() || '';
  
    const todayISO = new Date().toISOString().slice(0, 10);
    const routineState = JSON.parse(localStorage.getItem('axon_routine_state_' + todayISO) || '{}');
    const routinesCompleted = routines.filter(r => r.days.includes(new Date().getDay())).map(r => ({
        id: r.id, name: r.name, done: routineState[r.id] === true
    }));
  
    const entry = {
      profile, mood: selectedMood, wins, gratitudes: [grat1, grat2, grat3].filter(Boolean),
      life_lesson: lesson, family_impact: family, frustrations, sleep_hours: sleep,
      cards_studied: cardsStudied, study_topics: studyTopics,
      routines_completed: routinesCompleted,
      energy_level: parseInt($('journal-energy').value),
      focus_level: parseInt($('journal-focus').value),
      stress_level: parseInt($('journal-stress').value),
      created_at: new Date().toISOString()
    };
  
    const localJournals = JSON.parse(localStorage.getItem('axon_journals') || '[]');
    localJournals.push(entry);
    if (localJournals.length > 90) localJournals.splice(0, localJournals.length - 90);
    localStorage.setItem('axon_journals', JSON.stringify(localJournals));
  
    try {
      await supabase.from('daily_journal').insert([entry]);
      showToast("✅ ¡Cierre Cognitivo Guardado!");
    } catch (e) {
      console.warn('Journal Supabase failed, saved locally:', e);
      showToast("💾 Guardado Localmente");
    }
    $('journal-modal').style.display = 'none';
    showMultipotentialSummary();
  };
}
