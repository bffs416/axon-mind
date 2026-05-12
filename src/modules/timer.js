import { $, showToast, playSound, showNotification, ensureNotificationPermission, motivations, fireConfetti } from './config.js';
import { supabase, N8N_URL } from './config.js';

export function initTimer() {
  // ==================== BACKGROUND EXECUTION ====================
  async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (e) { /* Browser may not support it */ }
    }
  }
  
  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }
  
  function saveTimerState() {
    if (!pomodoroEndTime) return;
    sessionStorage.setItem('axon_timer', JSON.stringify({
      pomodoroEndTime, currentMode, sessionsCompleted,
      pomodoroStartTime, selectedTaskId, selectedTaskTitle,
      currentSessionId
    }));
  }
  
  function clearTimerState() {
    sessionStorage.removeItem('axon_timer');
  }
  
  function restoreTimerState() {
    const saved = sessionStorage.getItem('axon_timer');
    if (!saved) return false;
    try {
      const st = JSON.parse(saved);
      const now = Date.now();
      if (st.pomodoroEndTime > now) {
        pomodoroEndTime = st.pomodoroEndTime;
        currentMode = st.currentMode;
        sessionsCompleted = st.sessionsCompleted;
        pomodoroStartTime = st.pomodoroStartTime;
        selectedTaskId = st.selectedTaskId;
        selectedTaskTitle = st.selectedTaskTitle;
        currentSessionId = st.currentSessionId;
        timeLeft = Math.max(0, Math.ceil((pomodoroEndTime - now) / 1000));
        updateDisplay();
        document.querySelectorAll('.mode-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
        // Restart the interval
        document.body.classList.add('immersive-mode');
        startBtn.disabled = true; pauseBtn.disabled = false;
        timerId = setInterval(async () => {
          timeLeft = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
          updateDisplay();
          if (timeLeft <= 0) {
            await handleTimerComplete();
          }
        }, 1000);
        requestWakeLock();
        return true;
      }
    } catch (e) {}
    // Timer expired — clean up
    clearTimerState();
    return false;
  }
  
  // When tab becomes visible again, recalculate from wall-clock time
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && pomodoroEndTime) {
      timeLeft = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
      updateDisplay();
      if (timerId) {
        await requestWakeLock();
      }
      if (timeLeft <= 0 && timerId) {
        await handleTimerComplete();
      }
    }
  });
  
  // Re-acquire wake lock if it was lost (e.g., user briefly left app)
  document.addEventListener('wakelockrelease', async () => {
    if (timerId && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  });
  
  // ==================== TIMER ====================
  const updateDisplay = () => {
    const m = Math.floor(timeLeft/60), s = timeLeft % 60;
    minutesEl.textContent = String(m).padStart(2,'0');
    secondsEl.textContent = String(s).padStart(2,'0');
    const circ = 2 * Math.PI * 130;
    progressCircle.style.strokeDasharray = `${circ} ${circ}`;
    progressCircle.style.strokeDashoffset = circ - (timeLeft / modes[currentMode]) * circ;
    
    // Invisible Timer Bar
    const pct = ((modes[currentMode] - timeLeft) / modes[currentMode]) * 100;
    if(invisibleTimerBar) {
      invisibleTimerBar.style.width = `${pct}%`;
      invisibleTimerBar.classList.toggle('rest', currentMode !== 'pomodoro');
    }
    
    // SOS Timer
    const sosTimer = $('sos-timer-display');
    if(sosTimer) sosTimer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    
    // Update session dots
    const dots = sessionDots.querySelectorAll('.session-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i < (sessionsCompleted % 4));
    });
  };
  
  async function handleTimerComplete() {
    clearInterval(timerId); timerId = null;
    pomodoroEndTime = null;
    clearTimerState();
    await releaseWakeLock();
    playSound('workEnd');
    document.body.classList.remove('immersive-mode');
    const tc = document.querySelector('.timer-container');
    tc.classList.add('timer-alarm', 'glow-pulse');
    setTimeout(() => {
      tc.classList.remove('timer-alarm', 'glow-pulse');
    }, 4500);
    const pomodoroMsg = currentMode === 'pomodoro'
      ? `🍅 ${selectedTaskTitle} — ${Math.round((Date.now() - pomodoroStartTime)/60000)}min completados`
      : '⏰ Descanso terminado — ¡a volver!';
    showNotification('Axon Flow', pomodoroMsg);
    showToast(motivations[Math.floor(Math.random()*motivations.length)]);
    // Complete session
    if (currentSessionId) {
      const dur = Math.round((Date.now() - pomodoroStartTime)/1000);
      await supabase.from('focus_sessions').update({ ended_at: new Date().toISOString(), duration_seconds: dur, completed: true }).eq('id', currentSessionId);
      currentSessionId = null;
    }
  
    if (currentMode === 'pomodoro') {
      sessionsCompleted++;
      if (selectedTaskId) {
        const task = allTasks.find(t => t.id === selectedTaskId);
        await supabase.from('tasks').update({ pomodoro_count: (task?.pomodoro_count || 0) + 1 }).eq('id', selectedTaskId);
      }
  
      // VARIABLE REWARDS (Dopamine hack)
      const rand = Math.random();
      if (rand < 0.2) {
          showNotification('🏆 ¡TROFEO RARO DESBLOQUEADO!', 'Acabas de encontrar el trofeo de la constancia.');
          fireConfetti();
      } else if (rand < 0.5) {
          const facts = [
              "Dato TDAH: Completar tareas libera dopamina, ¡sigue así!",
              "Dato TDAH: El hiperfoco es un superpoder si lo apuntas bien.",
              "Dato TDAH: Los descansos activos mejoran la memoria a corto plazo."
          ];
          showToast(facts[Math.floor(Math.random() * facts.length)]);
          fireConfetti();
      } else {
          showToast(motivations[Math.floor(Math.random()*motivations.length)]);
      }
  
      // Lógica de Descanso Largo automático (cada 4)
      if (sessionsCompleted % 4 === 0) {
        switchMode('longBreak');
        showToast("¡4 Pomodoros! Te ganaste un descanso largo ☕");
      } else {
        switchMode('shortBreak');
      }
    } else {
      switchMode('pomodoro');
    }
  
    // Micro check-in opcional (solo en modo pomodoro, no en breaks)
    if (currentMode === 'pomodoro') showMicroCheckin();
  
    fetchTasks(); loadStats();
    startBtn.disabled = false; pauseBtn.disabled = true;
  }
  
  async function startTimer() {
    if (timerId) return;
    pomodoroStartTime = Date.now();
    const initialTimeLeft = timeLeft;
    pomodoroEndTime = Date.now() + initialTimeLeft * 1000;
    saveTimerState();
    await requestWakeLock();
    // Record focus session
    if (currentMode === 'pomodoro') {
      const { data } = await supabase.from('focus_sessions').insert([{
        task_title: selectedTaskTitle, started_at: new Date().toISOString(), completed: false
      }]).select().single();
      if (data) currentSessionId = data.id;
      if (selectedTaskId) await supabase.from('tasks').update({ last_activity_at: new Date().toISOString() }).eq('id', selectedTaskId);
      playSound('workStart');
    } else {
      playSound('breakStart');
    }
    // Request notification permission (needs user gesture)
    ensureNotificationPermission();
  
    document.body.classList.add('immersive-mode');
    timerId = setInterval(async () => {
      timeLeft = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
      updateDisplay();
      if (timeLeft <= 0) {
        await handleTimerComplete();
      }
    }, 1000);
    startBtn.disabled = true; pauseBtn.disabled = false;
  }
  
  pauseBtn.onclick = async () => {
    clearInterval(timerId); timerId = null;
    pomodoroEndTime = null;
    clearTimerState();
    await releaseWakeLock();
    document.body.classList.remove('immersive-mode');
    if (currentSessionId) {
      const dur = Math.round((Date.now() - pomodoroStartTime)/1000);
      await supabase.from('focus_sessions').update({ ended_at: new Date().toISOString(), duration_seconds: dur, completed: false }).eq('id', currentSessionId);
      currentSessionId = null;
    }
    startBtn.disabled = false; pauseBtn.disabled = true;
  };
  
  resetBtn.onclick = async () => {
    clearInterval(timerId); timerId = null;
    timeLeft = modes[currentMode];
    pomodoroEndTime = null;
    clearTimerState();
    await releaseWakeLock();
    document.body.classList.remove('immersive-mode');
    updateDisplay(); startBtn.disabled = false; pauseBtn.disabled = true;
  };
  startBtn.onclick = startTimer;
  
  function switchMode(mode) {
    currentMode = mode;
    timeLeft = modes[currentMode];
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    updateDisplay();
  }
  
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => switchMode(btn.dataset.mode);
  });
  
  // ==================== CALENDAR SYNC ====================
  async function syncCalendar(status, startTime = null, endTime = null) {
    calStatus.textContent = 'Syncing...';
    const url = new URL(N8N_URL);
    if (startTime) { url.searchParams.append('startTime', startTime); url.searchParams.append('endTime', endTime); url.searchParams.append('taskId', selectedTaskTitle); }
    try {
      await fetch(url.toString(), { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ taskId: selectedTaskTitle, status, startTime, endTime })
      });
      calStatus.textContent = startTime ? 'Scheduled' : 'Synced';
    } catch(e) { calStatus.textContent = 'Error'; }
  }
  
  // Sync ALL plan blocks to Google Calendar via n8n
  window.syncAllToCalendar = async () => {
    const days = getWeekDays();
    const allBlocks = [];
  
    days.forEach(d => {
      const dateStr = d.toISOString().slice(0, 10);
      const routineBlocks = getRoutineBlocksForDay(d);
      const workBlocks = weekPlan.filter(b => b.day === dateStr);
      [...routineBlocks, ...workBlocks].forEach(b => {
        allBlocks.push({
          day: dateStr,
          time: b.time,
          title: b.taskTitle,
          duration: b.duration || 30,
          isRoutine: b.isRoutine || false
        });
      });
    });
  
    if (allBlocks.length === 0) {
      showToast('⚠️ No hay bloques para sincronizar. Agrega bloques en la semana.');
      return;
    }
  
    calStatus.textContent = 'Syncing all...';
    showToast(`⏳ Sincronizando ${allBlocks.length} bloques...`);
  
    let synced = 0;
    for (const block of allBlocks) {
      try {
        const url = new URL(N8N_URL);
        const startDate = new Date(block.day + 'T' + block.time + ':00');
        const endDate = new Date(startDate.getTime() + (block.duration || 30) * 60000);
        url.searchParams.append('startTime', startDate.toISOString());
        url.searchParams.append('endTime', endDate.toISOString());
        url.searchParams.append('taskId', block.title);
  
        // Rutinas → calendar 2, Proyectos → calendar 3
        const calendarId = block.isRoutine ? gcalId2 : gcalId3;
        await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: block.title,
            status: 'scheduled',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            calendarId: calendarId,
            isRoutine: block.isRoutine || false
          })
        });
  
        // Mark as synced
        const idx = weekPlan.findIndex(b => b.day === block.day && b.taskTitle === block.title && b.time === block.time);
        if (idx >= 0) weekPlan[idx].synced = true;
  
        synced++;
      } catch (e) {
        console.error('Sync error for block:', block.title, e);
      }
    }
  
    localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
    renderPlanner();
    calStatus.textContent = `${synced}/${allBlocks.length} synced`;
    showToast(`✅ ${synced} bloques sincronizados con Google Calendar`);
  };

  return { startTimer: window.startTimer };
}
