import { createClient } from '@supabase/supabase-js';
import { createIcons, Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen } from 'lucide';

const supabase = createClient('https://blwaxxacneipoaufpiag.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU');
const N8N_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/pomodoro-sync';
const ARCHITECT_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-architect';
const SLICER_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-slicer';

// ==================== THEME MANAGEMENT ====================
window.setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('axon_theme', theme);
    console.log(`Axon Theme set to: ${theme}`);
};

// Initialize theme
const savedTheme = localStorage.getItem('axon_theme') || 'light';
window.setTheme(savedTheme);

// ==================== STATE ====================
let timeLeft = 25 * 60, timerId = null, currentMode = 'pomodoro', pomodoroStartTime = null;
let pomodoroEndTime = null; // Module-level for visibility handler
let wakeLock = null; // Screen wake lock for mobile background execution
let selectedTaskId = null, selectedTaskTitle = "Sesión de Trabajo", currentStepsInModal = [];
let currentSessionId = null, taskToSchedule = null, allTasks = [];
let vaultDocs = [], inboxDocs = [];
let vaultDocToConvert = null; 
let inboxDocToConvert = null; 
let sessionsCompleted = 0; // Para el descanso largo cada 4
let currentEnergyFilter = 'all';
let currentAssigneeFilter = 'all';
let interrogation = { round: 0, idea: '', projectTitle: '', questions: [], allAnswers: [] };
let showFrozen = false;
const modes = { pomodoro: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };

// CONFIGURACIÓN DE SONIDO (Cambia el URL para usar tu propio audio)
const ALARM_CONFIG = {
  useCustomSound: false,
  soundUrl: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  volume: 0.5
};
const weekPlan = JSON.parse(localStorage.getItem('axon_week_plan') || '[]');
const motivations = [
  "¡Excelente! Un paso más cerca de tu meta 🚀","¡Así se hace! Tu futuro yo te lo agradecerá 💪",
  "¡Increíble enfoque! Mereces ese descanso 🎯","¡Pomodoro completado! Eres imparable 🔥",
  "¡Otro logro más! La constancia es tu superpoder ⭐","¡Genial! Cada minuto cuenta 🏆"
];

const capitalizeFirstLetter = (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// ==================== DOM ====================
window.$ = id => document.getElementById(id);
const $ = window.$;
window.closeModal = (id) => { $(id).style.display = 'none'; };
const minutesEl = $('timer-minutes'), secondsEl = $('timer-seconds');
const invisibleTimerBar = $('invisible-timer-bar');
const progressCircle = document.querySelector('.progress-ring__circle');
const startBtn = $('start-btn'), pauseBtn = $('pause-btn'), resetBtn = $('reset-btn');
const taskList = $('task-list'), calStatus = $('calendar-status');
const activeTaskEmoji = $('active-task-emoji'), activeTaskTitle = $('active-task-title'), activeTaskStatus = $('active-task-status'), sessionDots = $('session-dots');
const taskModal = $('task-modal');
const vaultModal = $('vault-modal');
const quickCaptureModal = $('quick-capture-modal');
const viewBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');

viewBtns.forEach(btn => {
  btn.onclick = () => {
    const viewId = btn.getAttribute('data-view');
    viewBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    
    btn.classList.add('active');
    const targetView = $('view-' + viewId);
    if (targetView) targetView.classList.add('active');
    
    if (viewId === 'stats') loadStats();
    if (viewId === 'cards') window.loadCards();
    if (viewId === 'inbox') fetchInbox();
    if (viewId === 'vault') fetchVaultDocs();
    if (viewId === 'plan') { renderRoutines(); renderPlanner(); loadGCal(); }
  };
});
window.initIcons = () => createIcons({ icons: { Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen } });

// ==================== AUDIO ALARM ====================
function playSound(type = 'workEnd') {
  if (ALARM_CONFIG.useCustomSound) {
    const audio = new Audio(ALARM_CONFIG.soundUrl);
    audio.volume = ALARM_CONFIG.volume;
    audio.play();
    return;
  }
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const configs = {
    workStart: [
      { f: 660, d: 0, t: 0.1 },
      { f: 880, d: 0.1, t: 0.2 }
    ],
    workEnd: [
      { f: 880, d: 0, t: 0.2 },
      { f: 880, d: 0.3, t: 0.2 },
      { f: 880, d: 0.6, t: 0.2 }
    ],
    breakStart: [
      { f: 440, d: 0, t: 0.3 },
      { f: 330, d: 0.3, t: 0.4 }
    ]
  };

  (configs[type] || configs.workEnd).forEach(s => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = s.f;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + s.d);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.d + s.t);
    osc.start(ctx.currentTime + s.d);
    osc.stop(ctx.currentTime + s.d + s.t);
  });
}

async function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🎯', vibrate: [200, 100, 200], requireInteraction: true });
  }
}

// Request permission on user gesture (called from startTimer)
async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showToast(msg) {
  const t = $('motivation-toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ==================== CONFETTI ====================
function fireConfetti() {
  const canvas = $('confetti-canvas'), ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = Array.from({length: 120}, () => ({
    x: canvas.width/2, y: canvas.height/2,
    vx: (Math.random()-0.5)*16, vy: Math.random()*-14 - 4,
    size: Math.random()*6+3, color: ['#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'][Math.floor(Math.random()*6)],
    life: 1
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.008;
      if (p.life > 0) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
    });
    ctx.globalAlpha = 1;
    if (++frame < 120) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

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

// ==================== TASKS ====================
function staleDays(task) {
  if (!task.last_activity_at || task.status === 'done') return 0;
  return Math.floor((Date.now() - new Date(task.last_activity_at).getTime()) / 86400000);
}

window.selectTask = (id, title) => {
  document.querySelectorAll('.task-card').forEach(c => {
      if (c.dataset.id === id) {
          c.classList.add('selected');
      } else {
          c.classList.remove('selected');
      }
  });
  selectedTaskId = id;
  selectedTaskTitle = title;
  
  activeTaskTitle.textContent = selectedTaskTitle;
  activeTaskEmoji.textContent = '🎯'; 
  activeTaskStatus.textContent = 'Enfoque actual';
};

function updateProgressDashboard(tasks) {
  const dash = $('progress-dashboard');
  if (!dash) return;

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'frozen');
  const done = tasks.filter(t => t.status === 'done');
  const frozen = tasks.filter(t => t.status === 'frozen');
  const total = active.length + done.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  const messages = {
    0: '¡Empieza tu primer proyecto hoy! 🚀',
    25: 'Vas arrancando, ¡mantén el ritmo! 💪',
    50: '¡A mitad de camino, crack! ⚡',
    75: '¡Casi lo tienes! No te detengas 🔥',
    100: '¡Todo completado! Mereces un descanso 🏆'
  };

  let msg = messages[0];
  if (pct >= 100) msg = messages[100];
  else if (pct >= 75) msg = messages[75];
  else if (pct >= 50) msg = messages[50];
  else if (pct >= 25) msg = messages[25];

  const frozenNote = frozen.length > 0 ? ` · ❄️ ${frozen.length} congelado${frozen.length > 1 ? 's' : ''}` : '';

  dash.innerHTML = `
    <div class="progress-header">
      <span class="progress-title">📊 Progreso General</span>
      <span class="progress-stats"><span>${done.length}</span> / ${total} proyecto${total !== 1 ? 's' : ''}${frozenNote}</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="progress-message">${msg}</div>
  `;
}

async function fetchTasks() {
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (error || !data) return;
  allTasks = data;

  let filteredTasks = data;
  
  // Filter by Status (unless in freezer view)
  if (!showFrozen) {
      filteredTasks = filteredTasks.filter(t => t.status !== 'frozen');
  } else {
      filteredTasks = filteredTasks.filter(t => t.status === 'frozen');
  }

  // Filter by Energy
  if (currentEnergyFilter !== 'all') {
      filteredTasks = filteredTasks.filter(t => (t.energy_level || 'medium') === currentEnergyFilter);
  }

  // Filter by Assignee
  if (currentAssigneeFilter !== 'all') {
      filteredTasks = filteredTasks.filter(t => {
          if (!t.steps || t.steps.length === 0) return true;
          return t.steps.some(s => !s.done && (s.assignee === currentAssigneeFilter || s.assignee === 'Ambos' || !s.assignee));
      });
  }

  // --- SORT BY STATUS (Done at the bottom) ---
  filteredTasks.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return 0;
  });

  const taskList = $('task-list');

  // Helper: render a single task card
  const renderTaskCard = (task) => {
    const steps = task.steps || [], doneCount = steps.filter(s=>s.done).length;
    const prog = steps.length ? (doneCount/steps.length)*100 : (task.status==='done'?100:0);
    const stale = staleDays(task);
    const staleClass = (task.status !== 'done' && task.status !== 'frozen') ? (stale >= 5 ? 'stale-danger' : stale >= 2 ? 'stale-warning' : '') : '';
    const sel = selectedTaskId === task.id ? 'selected' : '';

    const eLvl = task.energy_level || 'medium';
    let energyTag = '';
    if(eLvl === 'high') energyTag = '<span class="energy-tag high">⚡ Alta</span>';
    if(eLvl === 'medium') energyTag = '<span class="energy-tag medium">🔋 Media</span>';
    if(eLvl === 'low') energyTag = '<span class="energy-tag low">🪫 Baja</span>';

    const tAssignee = task.assignee || 'Ambos';
    let assigneeIcon = '🤝';
    if(tAssignee === 'Pipe') assigneeIcon = '👨';
    else if(tAssignee === 'Tati') assigneeIcon = '👩';
    else if(tAssignee === 'Robot') assigneeIcon = '🤖';

    return `<div class="task-card ${task.status==='done'?'done':''} ${task.status==='frozen'?'frozen':''} ${staleClass} ${sel}" data-id="${task.id}" data-title="${task.title}">
      <div style="width:100%">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="task-info">
            <h4 style="display:flex; align-items:center; gap:8px;">
              <span class="assignee-toggle-icon" onclick="event.stopPropagation();window.cycleAssignee('${task.id}', '${tAssignee}')" title="Cambiar responsable" style="cursor:pointer; font-size:1.2rem;">${assigneeIcon}</span>
              ${task.title} ${energyTag}
            </h4>
            <p>${task.description||''}</p>
            <div class="task-meta">
              ${task.pomodoro_count ? `<span class="meta-chip">🍅 ${task.pomodoro_count}</span>` : ''}
              ${stale >= 5 && task.status !== 'frozen' ? `<span class="meta-chip danger">⚠ ${stale} días sin actividad</span>` : stale >= 2 && task.status !== 'frozen' ? `<span class="meta-chip warning">${stale} días sin actividad</span>` : ''}
              ${task.status === 'frozen' ? `<span class="meta-chip" style="background:#1e3a8a;color:#60a5fa">❄️ Congelado</span>` : ''}
            </div>
          </div>
          <div class="action-btns" style="display:flex; gap:0.2rem;">
            ${task.status !== 'frozen' ?
               `<button class="btn-mini" onclick="event.stopPropagation();window.toggleFreezeTask('${task.id}', '${task.status}')" title="A la Nevera">❄️</button>` :
               `<button class="btn-mini" onclick="event.stopPropagation();window.toggleFreezeTask('${task.id}', '${task.status}')" title="Descongelar">🔥</button>`
            }
            <button class="btn-mini" onclick="event.stopPropagation();window.editTask('${task.id}', event)" title="Editar"><i data-lucide="edit-2"></i></button>
            <button class="btn-mini" onclick="event.stopPropagation();window.deleteTask('${task.id}', event)" title="Eliminar"><i data-lucide="trash-2"></i></button>
            <button class="btn-mini" onclick="event.stopPropagation();window.openSchedule('${task.title.replace(/'/g,"\\'")}', ${task.duration || 25})" title="Agendar"><i data-lucide="calendar"></i></button>
            ${stale >= 2 && task.status !== 'done' && task.status !== 'frozen' ? `<button class="btn-mini" onclick="event.stopPropagation();window.reschedule('${task.id}','${task.title.replace(/'/g,"\\'")}')">📅</button>` : ''}
            <button class="task-check" onclick="event.stopPropagation();window.toggleTask('${task.id}','${task.status}')"><i data-lucide="${task.status==='done'?'check':'circle'}"></i></button>
          </div>
        </div>
        ${(() => {
          if (!steps.length) return '';

          const groups = [];
          let currentGroup = null;

          steps.forEach((s, i) => {
            const stepWithIdx = { ...s, originalIndex: i };
            if (s.isHeader || !currentGroup) {
              currentGroup = { header: s.isHeader ? stepWithIdx : null, actions: [] };
              groups.push(currentGroup);
              if (!s.isHeader) currentGroup.actions.push(stepWithIdx);
            } else {
              currentGroup.actions.push(stepWithIdx);
            }
          });

          return `<div class="progress-bar-container"><div class="progress-bar-fill" style="width:${prog}%"></div></div>
            <div class="steps-container">
              ${groups.map(group => {
                const headerHtml = group.header ? `<div class="step-header" style="margin-top: 15px; margin-bottom: 5px; font-weight: 700; color: var(--accent); font-size: 0.9em; border-bottom: 1px solid var(--border); padding-bottom: 3px;">
                    ${group.header.text}
                </div>` : '';

                const actionsHtml = group.actions.map(s => {
                  const i = s.originalIndex;
                  let sAssignee = '🤝';
                  if(s.assignee === 'Pipe') sAssignee = '👨';
                  else if(s.assignee === 'Tati') sAssignee = '👩';
                  else if(s.assignee === 'Robot') sAssignee = '🤖';

                  const assigneeHtml = `<span onclick="event.stopPropagation();window.cycleStepAssignee('${task.id}', ${i}, '${s.assignee || 'Ambos'}')" title="Cambiar responsable del paso" style="cursor:pointer; margin-right:4px;">${sAssignee}</span>`;
                  let sDuration = s.duration ? `<span style="font-size: 0.8em; opacity: 0.6; margin-left: 5px;">⏱️ ${formatDuration(s.duration)}</span>` : '';

                  const isAction = s.text.includes('🎨') || s.text.includes('🚀');
                  const displayStyle = isAction
                    ? 'display: inline-flex; align-items: center; width: auto; margin-right: 10px; margin-bottom: 5px; opacity: 0.9; font-size: 0.85em; background: var(--bg-card); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border); cursor:pointer; gap: 8px;'
                    : 'margin-top: 8px; font-weight: 500; display: flex; align-items: center; gap: 10px;';

                  return `<div class="step-item ${s.done?'done':''}" style="${displayStyle}" onclick="window.toggleStep('${task.id}',${i})">
                      <div class="action-btns" style="display: flex; gap: 6px; align-items: center; margin-right: 4px;">
                        <button class="btn-mini" onclick="event.stopPropagation();window.focusStep('${task.id}','${task.title.replace(/'/g,"\\'")+': '+s.text.replace(/'/g,"\\'")}')" title="Iniciar Pomodoro" style="padding: 2px; background: rgba(255,255,255,0.05); border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                          <i data-lucide="play" style="width:12px; height:12px;"></i>
                        </button>
                        <button class="btn-mini" onclick="event.stopPropagation();window.openSchedule('${(task.title+': '+s.text).replace(/'/g,"\\'")}', ${s.duration || 25})" title="Agendar" style="padding: 2px; background: rgba(255,255,255,0.05); border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                          <i data-lucide="calendar" style="width:12px; height:12px;"></i>
                        </button>
                      </div>
                      <span style="display: flex; align-items: center; gap: 4px;">${assigneeHtml}${s.text}${sDuration}</span>
                    </div>`;
                }).join('');

                return headerHtml + actionsHtml;
              }).join('')}
            </div>`;
        })()}
      </div></div>`;
  };

  // Group by category
  const personalTasks = filteredTasks.filter(t => getTaskCategory(t) === 'Personal');
  const workTasks = filteredTasks.filter(t => getTaskCategory(t) === 'Trabajo');
  const otherTasks = filteredTasks.filter(t => {
    const cat = getTaskCategory(t);
    return cat && cat !== 'Personal' && cat !== 'Trabajo';
  });

  let html = '';

  const renderGroup = (title, icon, tasks, catClass) => {
    const count = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    return `
      <div class="category-group">
        <details ${count > 0 ? 'open' : ''}>
          <summary>
            ${icon} ${title}
            <span class="category-badge ${catClass}">${doneCount}/${count}</span>
          </summary>
          <div class="task-list-inner">
            ${tasks.map(renderTaskCard).join('') || '<p style="color:var(--text-muted);text-align:center;padding:1rem;font-size:0.8rem;">Vacío</p>'}
          </div>
        </details>
      </div>`;
  };

  html += renderGroup('Personal', '🏠', personalTasks, 'personal');
  html += renderGroup('Trabajo', '💼', workTasks, 'trabajo');
  if (otherTasks.length > 0) {
    html += renderGroup('Otros', '📂', otherTasks, 'trabajo');
  }

  taskList.innerHTML = html || `<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay tareas en esta vista.</p>`;

  // Actualizar contador en el encabezado
  const projectHeader = document.querySelector('.section-header h2');
  if (projectHeader) {
    projectHeader.innerHTML = `<i data-lucide="list-todo"></i> Mis Proyectos (${filteredTasks.length})`;
  }

  // Actualizar Dashboard de Progreso
  updateProgressDashboard(data);

  initIcons();
  document.querySelectorAll('.task-card').forEach(card => {
    card.onclick = () => {
      window.selectTask(card.dataset.id, card.dataset.title);
    };
  });
}

window.focusStep = (id, title) => { 
  selectedTaskId = id; 
  selectedTaskTitle = title; 
  activeTaskTitle.textContent = title;
  activeTaskEmoji.textContent = '🚀';
  activeTaskStatus.textContent = 'Paso seleccionado';
  startTimer(); 
};
window.toggleStep = async (id, idx) => {
  const { data } = await supabase.from('tasks').select('steps').eq('id', id).single();
  data.steps[idx].done = !data.steps[idx].done;
  const allDone = data.steps.every(s=>s.done);
  await supabase.from('tasks').update({ steps: data.steps, last_activity_at: new Date().toISOString(), ...(allDone ? { status: 'done', completed_at: new Date().toISOString() } : {}) }).eq('id', id);
  if (allDone) { fireConfetti(); showToast("🎉 ¡Proyecto completado! ¡Increíble trabajo!"); }
  fetchTasks(); loadStats();
};
window.toggleTask = async (id, st) => {
  const done = st !== 'done';

  // Dopamina: animación de vibración en la tarjeta antes de desaparecer
  if (done) {
    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('completing');
      await new Promise(r => setTimeout(r, 800));
    }
  }

  await supabase.from('tasks').update({ status: done?'done':'pending', ...(done?{completed_at:new Date().toISOString()}:{completed_at:null}) }).eq('id', id);
  if (done) { fireConfetti(); showToast("🎉 ¡Tarea completada!"); }
  fetchTasks(); loadStats();
};

window.cycleAssignee = async (id, current) => {
  const list = ['Ambos', 'Pipe', 'Tati', 'Robot'];
  const next = list[(list.indexOf(current) + 1) % list.length];
  await supabase.from('tasks').update({ assignee: next }).eq('id', id);
  fetchTasks();
};

window.cycleStepAssignee = async (taskId, stepIdx, current) => {
  const list = ['Ambos', 'Pipe', 'Tati', 'Robot'];
  const next = list[(list.indexOf(current) + 1) % list.length];
  
  const { data } = await supabase.from('tasks').select('steps').eq('id', taskId).single();
  if (data && data.steps) {
    data.steps[stepIdx].assignee = next;
    await supabase.from('tasks').update({ steps: data.steps }).eq('id', taskId);
    fetchTasks();
  }
};
window.reschedule = (id, title) => { window.openSchedule(title); };

window.deleteTask = async (id) => {
  if (!window.confirm('¿Eliminar esta tarea permanentemente?')) return;
  try {
    await supabase.from('tasks').delete().eq('id', id);
    removeTaskCategory(id);
    showToast('🗑️ Tarea eliminada');
    fetchTasks(); loadStats();
  } catch (e) {
    console.error('Error eliminando tarea:', e);
    showToast('⚠️ Error al eliminar');
  }
};

window.editTask = async (id) => {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  $('new-task-title').value = task.title;
  $('new-task-desc').value = task.description || '';
  $('new-task-energy').value = task.energy_level || 'medium';
  if ($('new-task-assignee')) $('new-task-assignee').value = task.assignee || 'Ambos';
  // Set category radio
  const cat = getTaskCategory(task);
  const radio = document.querySelector(`input[name="task-category"][value="${cat}"]`);
  if (radio) radio.checked = true;
  currentStepsInModal = JSON.parse(JSON.stringify(task.steps || []));
  renderModalSteps();
  $('save-task').textContent = 'Actualizar Proyecto';
  taskModal.style.display = 'flex';

  // Override save to update instead of insert
  $('save-task').onclick = async () => {
    const title = capitalizeFirstLetter($('new-task-title').value); if (!title) return;
    const energy = $('new-task-energy').value;
    const assignee = $('new-task-assignee') ? $('new-task-assignee').value : 'Ambos';
    const category = getSelectedCategory();
    setTaskCategory(id, category);
    const { error } = await supabase.from('tasks').update({ title, description: capitalizeFirstLetter($('new-task-desc').value), energy_level: energy, assignee: assignee, steps: currentStepsInModal }).eq('id', id);
    if (error) {
      console.error("Error al actualizar tarea:", error);
      showToast("Error al actualizar: " + error.message);
      return;
    }
    $('save-task').textContent = 'Crear Proyecto';
    $('task-modal').style.display = 'none';
    // Restore original save behavior
    $('save-task').onclick = createProject;
    fetchTasks();
    showToast('✅ Tarea actualizada');
  };
};

window.toggleFreezeTask = async (id, currentStatus) => {
  const newStatus = currentStatus === 'frozen' ? 'todo' : 'frozen';
  try {
      await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      showToast(newStatus === 'frozen' ? "❄️ Proyecto enviado a la Nevera" : "🔥 Proyecto descongelado");
  } catch(err) {
      const t = allTasks.find(t => t.id === id);
      if(t) t.status = newStatus;
  }
  fetchTasks();
};

window.toggleFreezerView = () => {
    showFrozen = !showFrozen;
    const btn = $('toggle-freezer-btn');
    if(showFrozen) {
        btn.classList.replace('btn-outline', 'btn-primary');
        btn.textContent = "🔥 Volver a Proyectos";
        $('roulette-btn').style.display = 'none'; // No ruleta en la nevera
    } else {
        btn.classList.replace('btn-primary', 'btn-outline');
        btn.textContent = "❄️ Ver Nevera";
        $('roulette-btn').style.display = 'block';
    }
    fetchTasks();
};

window.rouletteTask = () => {
    // Escoger una tarea aleatoria activa que cumpla el filtro de energía actual
    let pool = allTasks.filter(t => t.status !== 'frozen' && t.status !== 'done');
    if (currentEnergyFilter !== 'all') {
        pool = pool.filter(t => (t.energy_level || 'medium') === currentEnergyFilter);
    }
    
    if(pool.length === 0) {
        return showToast("No hay tareas disponibles para la ruleta 😕");
    }
    
    const randomTask = pool[Math.floor(Math.random() * pool.length)];
    window.selectTask(randomTask.id, randomTask.title);
    
    // Animate UI
    showToast("🎲 ¡La ruleta ha hablado!");
    const card = document.querySelector(`.task-card[data-id="${randomTask.id}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.animation = 'none';
        setTimeout(() => {
            card.style.animation = 'pulse 1s ease';
        }, 10);
    }
};

window.enterSOSMode = () => {
    let pool = allTasks.filter(t => t.status !== 'frozen' && t.status !== 'done');
    if(pool.length === 0) return showToast("No hay tareas para el SOS. ¡Relájate! 😊");
    
    const randomTask = pool[Math.floor(Math.random() * pool.length)];
    window.selectTask(randomTask.id, randomTask.title);
    
    $('sos-task-title').textContent = randomTask.title;
    $('sos-task-desc').textContent = randomTask.description || "Enfócate solo en este paso. El resto del mundo no existe ahora.";
    $('sos-overlay').style.display = 'flex';
    
    if(!timerId) startTimer();
    showToast("🆘 Modo Ultra-Enfoque activado. Respira.");
};

window.exitSOSMode = () => {
    $('sos-overlay').style.display = 'none';
};

// Configurar listeners de filtros de energía
document.querySelectorAll('.energy-filter').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.energy-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentEnergyFilter = btn.dataset.energy;
        fetchTasks();
    };
});

// Configurar listeners de filtros de responsable
document.querySelectorAll('.assignee-filter').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.assignee-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAssigneeFilter = btn.dataset.assignee;
        fetchTasks();
    };
});

// ==================== MODALS ====================
window.openAddTaskModal = () => {
    vaultDocToConvert = null;
    currentStepsInModal = [];
    $('modal-steps-list').innerHTML = '';
    $('new-task-title').value = '';
    $('new-task-desc').value = '';
    $('new-task-energy').value = 'medium';
    // Reset category to Personal
    const radio = document.querySelector('input[name="task-category"][value="Personal"]');
    if (radio) radio.checked = true;
    $('save-task').onclick = createProject;
    $('task-modal').style.display = 'flex';
    if(window.lucide) lucide.createIcons();
};
// El FAB ya tiene onclick="window.openAddSelector()" en el HTML — no sobrescribir

window.showMultipotentialSummary = () => {
    const finishedToday = allTasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString());
    const worlds = [...new Set(finishedToday.map(t => t.energy_level || 'medium'))];
    let html = `
        <div style="margin-bottom:1rem"><strong>Proyectos Completados:</strong> ${finishedToday.length}</div>
        <div style="margin-bottom:1rem"><strong>Mundos explorados hoy:</strong> ${worlds.length}</div>
        <ul style="list-style:none; padding:0">
            ${finishedToday.map(t => `<li>✅ ${t.title}</li>`).join('')}
        </ul>
        ${finishedToday.length === 0 ? '<p>Hoy fue un día de siembra. ¡Mañana cosecharás!</p>' : ''}
    `;
    $('multipotential-summary-content').innerHTML = html;
    $('stats-summary-modal').style.display = 'flex';
};

// Función auxiliar súper robusta para extraer pasos de cualquier JSON anidado
function extractStepsFromData(dataRaw) {
    let rawSlices = [];
    let parsedTitle = "";
    let parsedDesc = "";
    let parsedEnergy = "";

    // Convertir a string y buscar recursivamente si es necesario
    const searchRecursively = (obj) => {
        if (!obj) return;
        if (typeof obj === 'string') {
            try { obj = JSON.parse(obj); } catch(e) {}
        }
        
        if (Array.isArray(obj)) {
            // Si es un array de tareas directo
            if (obj.length > 0 && (obj[0].task || obj[0].tarea || obj[0].text)) {
                rawSlices = obj;
                return;
            }
            obj.forEach(searchRecursively);
        } else if (typeof obj === 'object') {
            if (obj.suggested_title && !parsedTitle) parsedTitle = obj.suggested_title;
            if (obj.suggested_description && !parsedDesc) parsedDesc = obj.suggested_description;
            if (obj.energy_level && !parsedEnergy) parsedEnergy = obj.energy_level;

            if (obj.steps && Array.isArray(obj.steps)) rawSlices = obj.steps;
            else if (obj.slices && Array.isArray(obj.slices)) rawSlices = obj.slices;
            else if (obj.tareas && Array.isArray(obj.tareas)) rawSlices = obj.tareas;
            else if (obj.tasks && Array.isArray(obj.tasks)) rawSlices = obj.tasks;
            else if (obj.fragmentacion && Array.isArray(obj.fragmentacion)) {
                obj.fragmentacion.forEach(fase => {
                    if (fase.tareas) rawSlices.push(...fase.tareas);
                    else if (fase.steps) rawSlices.push(...fase.steps);
                });
            } else {
                // Buscar más profundo
                Object.values(obj).forEach(searchRecursively);
            }
        }
    };

    searchRecursively(dataRaw);
    return { rawSlices, parsedTitle, parsedDesc, parsedEnergy };
}

window.sliceWithAI = async () => {
    const titleField = $('new-task-title');
    const descField = $('new-task-desc');
    const title = titleField.value;
    const desc = descField.value;
    
    if(!title) return showToast("Escribe primero el nombre del proyecto para rebanarlo");
    
    const btn = document.querySelector('button[onclick="window.sliceWithAI()"]');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = "⏳ Rebanando...";
        btn.disabled = true;
        showToast("🧠 Axon Slicer está pensando...");

        const response = await fetch(SLICER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: desc
            }),
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) throw new Error("Error en la conexión con la IA");

        const dataRaw = await response.json();
        const { rawSlices, parsedTitle, parsedDesc, parsedEnergy } = extractStepsFromData(dataRaw);

        if (parsedTitle) titleField.value = parsedTitle;
        if (parsedDesc) descField.value = parsedDesc;
        if (parsedEnergy) $('new-task-energy').value = parsedEnergy;

        if (rawSlices.length > 0) {
            currentStepsInModal = rawSlices.map(s => ({
                text: s.task || s.title || s.descripcion || s.tarea || s.step || "Paso sin nombre",
                done: false,
                assignee: s.assignee || s.responsable || '🤝 Ambos',
                duration: parseInt(s.duration || s.estimated_time || s.duracion || s.tiempo || s.estimatedMinutes) || 25
            }));

            renderModalSteps();
            if(window.lucide) lucide.createIcons();
            showToast("✅ ¡Proyecto rebanado con éxito!");
        } else {
            console.error("AXON DEBUG - No se encontraron tareas. Datos crudos:", dataRaw);
            showToast("⚠️ La IA no devolvió tareas claras");
        }
    } catch (error) {
        console.error("Error al rebanar:", error);
        showToast("❌ Error al conectar con el Slicer");
    } finally {
        if(btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// ==================== INTERROGATORIO AXON ====================
window.startInterrogation = (idea, event) => {
  interrogation = { round: 1, idea, projectTitle: '', questions: [], allAnswers: [] };
  $('interrogation-modal').style.display = 'flex';
  updateInterrProgress(1);
  $('interr-title').textContent = '🧠 Interrogatorio Axon — Descubrimiento';
  $('interr-status').style.display = 'block';
  $('interr-status').innerHTML = '⏳ El Arquitecto está analizando tu idea...';
  $('interr-questions').style.display = 'none';
  $('interr-actions').style.display = 'none';
  runInterrogationRound(1);
};

async function runInterrogationRound(round) {
  const statusEl = $('interr-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '⏳ Pensando...';
  $('interr-questions').style.display = 'none';
  $('interr-actions').style.display = 'none';

  let url, body, title;
  if (round === 1) {
    url = ARCHITECT_URL;
    body = {
      idea: `FASE DESCUBRIMIENTO (MANAGER MODE):\nIDEA: ${interrogation.idea}\n\nGenera exactamente 5 preguntas clave para la GESTIÓN. Enfócate en: Responsables, Tiempos y Entregables.\n\nASIGNACIÓN INTELIGENTE: Elige al responsable más lógico (Pipe: Estrategia/Técnico, Tati: Operativo/Gestión, Robot: Automatización). NO asignes a Robot si la tarea es manual (ej: buscar una cámara).\n\nESTRUCTURA OBLIGATORIA JSON:\n{ "steps": [ { "task": "pregunta...", "assignee": "Pipe/Tati/Robot", "duration": 25 } ], "suggested_title": "título" }`
    };
  } else if (round === 3) {
    url = SLICER_URL;
    const allQA = interrogation.allAnswers
      .map((a, i) => `[Pregunta] ${a.question}\n→ [Respuesta] ${a.answer}`).join('\n\n');
    title = interrogation.projectTitle || interrogation.idea.slice(0, 80);
    body = {
      title: title,
      description: `IDEA ORIGINAL: ${interrogation.idea}\n\nGESTIÓN RECOLECTADA:\n${allQA}\n\nINSTRUCCIÓN: Genera un plan de acción de GESTIÓN. ASIGNACIÓN LÓGICA: Solo usa a Robot para tareas automatizables. Para tareas físicas o de criterio humano, usa a Pipe o Tati. Responde con la estructura JSON de tareas habitual.`
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error('Error de conexión');
    const dataRaw = await response.json();

    if (round === 3) {
      statusEl.style.display = 'none';
      const { rawSlices, parsedTitle, parsedDesc, parsedEnergy } = extractStepsFromData(dataRaw);
      finalizeProject(rawSlices, parsedTitle || title, parsedDesc || body.description, parsedEnergy || 'medium');
      window.closeInterrogation();
      return;
    }

    const { rawSlices, parsedTitle } = extractStepsFromData(dataRaw);
    if (parsedTitle) interrogation.projectTitle = parsedTitle;

    const questions = rawSlices.map(s => ({
      question: s.task || s.title || s.text || s.descripcion || s.tarea || 'Pregunta sin texto',
      assignee: s.assignee || 'Pipe',
      answer: ''
    }));

    if (questions.length === 0) {
      statusEl.innerHTML = '⚠️ El Arquitecto no generó preguntas. Intenta de nuevo con más detalle en la descripción.';
      return;
    }

    interrogation.questions = questions;
    statusEl.style.display = 'none';
    renderInterrogationQuestions(questions);

    const btn = $('interr-next-btn');
    btn.textContent = round === 2 ? '✨ Generar Plan' : 'Siguiente Ronda →';
    $('interr-actions').style.display = 'flex';
  } catch (e) {
    console.error('Interrogation error:', e);
    statusEl.innerHTML = '❌ Error de conexión con n8n. Revisa que el servidor esté activo e intenta de nuevo.';
  }
}

function renderInterrogationQuestions(questions) {
  const container = $('interr-questions');
  container.style.display = 'block';
  container.innerHTML = questions.map((q, i) => `
    <div class="interr-question">
      <label>${i + 1}. ${q.question}</label>
      <div class="interr-assignee">👤 Dirigida a: ${q.assignee}</div>
      <textarea id="interr-a-${i}" placeholder="Tu respuesta..." rows="2"></textarea>
    </div>
  `).join('');
}

window.advanceInterrogation = async () => {
  const round = interrogation.round;
  for (let i = 0; i < interrogation.questions.length; i++) {
    const answerEl = $('interr-a-' + i);
    const answer = answerEl ? answerEl.value.trim() : '';
    interrogation.allAnswers.push({
      round,
      question: interrogation.questions[i].question,
      assignee: interrogation.questions[i].assignee,
      answer: answer || '(Sin respuesta)'
    });
  }

  if (round === 1) {
    // Saltamos a la fase de Generación (Round 3)
    interrogation.round = 3;
    updateInterrProgress(3);
    $('interr-title').textContent = '🔪 Generando Plan de Gestión';
    $('interr-questions').style.display = 'none';
    $('interr-actions').style.display = 'none';
    await runInterrogationRound(3);
  }
};

function updateInterrProgress(round) {
  document.querySelectorAll('.interr-step').forEach(el => {
    const step = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    
    // Si saltamos la ronda 2, la marcamos como "skip" o simplemente invisible
    if (step === 2) {
        el.style.display = 'none';
        return;
    }

    if (step < round) el.classList.add('done');
    else if (step === round) el.classList.add('active');
  });
}

window.closeInterrogation = () => {
  $('interrogation-modal').style.display = 'none';
  interrogation = { round: 0, idea: '', projectTitle: '', questions: [], allAnswers: [] };
};

function finalizeProject(rawSlices, title, desc, energy) {
  currentStepsInModal = rawSlices.map(s => ({
    text: s.task || s.title || s.descripcion || s.tarea || s.step || 'Paso sin nombre',
    done: false,
    assignee: s.assignee || 'Ambos',
    duration: parseInt(s.duration || s.estimated_time || s.duracion || 25) || 25
  }));
  $('new-task-title').value = title || interrogation.projectTitle || interrogation.idea.slice(0, 80);
  $('new-task-desc').value = desc || '';
  if (energy) $('new-task-energy').value = energy;
  renderModalSteps();
  if (window.lucide) lucide.createIcons();
  showToast('✅ ¡Plan generado con el Interrogatorio Axon!');
}

window.suggestWithAI = async (event) => {
    const titleField = $('new-task-title');
    const descField = document.getElementById('project-description') || $('new-task-desc');
    const idea = descField.value.trim();
    
    if (idea.toUpperCase() === 'PING') {
        const testData = {
            suggested_title: "TEST: CONEXIÓN_ESTABLE",
            suggested_description: "Ping exitoso. Dashboard listo.",
            steps: [{ task: "Pipe: Test de Hardware", assignee: "Pipe", duration: 25 }, { task: "Tati: Test de ROI", assignee: "Tati", duration: 25 }]
        };
        setTimeout(() => {
            titleField.value = testData.suggested_title;
            descField.value = testData.suggested_description;
            currentStepsInModal = testData.steps.map(s => ({ text: s.task, done: false, assignee: s.assignee, duration: s.duration }));
            renderModalSteps();
            if(window.lucide) lucide.createIcons();
            showToast("📡 PING exitoso (Modo Test)");
            if (event && event.target) {
                event.target.innerHTML = "💡 Sugerir con IA";
                event.target.disabled = false;
            }
        }, 500);
        return;
    }

    if (!idea) {
        alert("¡Escribe tu idea primero en el cuadro de descripción!");
        return;
    }

    let btn = event ? event.target : null;
    let originalText = btn ? btn.innerHTML : "💡 Sugerir con IA";
    if (btn) {
        btn.innerHTML = "✨ Pensando...";
        btn.disabled = true;
    }

    // Redirect to interrogation flow
    window.startInterrogation(idea, event);

    // Reset button (interrogation runs async)
    setTimeout(() => {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 800);
};

window.updateModalStepText = (index, newText) => {
    if (currentStepsInModal[index]) {
        currentStepsInModal[index].text = newText;
    }
};

window.removeModalStep = (index) => {
    currentStepsInModal.splice(index, 1);
    // Re-render list
    renderModalSteps();
};

$('close-modal').onclick = () => {
  $('task-modal').style.display = 'none';
  $('save-task').textContent = 'Crear Proyecto';
  $('save-task').onclick = createProject;
};
$('add-step-to-list').onclick = () => {
  const v = capitalizeFirstLetter($('step-input').value); if(!v) return;
  const a = $('step-assignee') ? $('step-assignee').value : '🤝 Ambos';
  const d = $('step-duration') ? parseInt($('step-duration').value) : 30;
  currentStepsInModal.push({text:v, done:false, assignee:a, duration: d}); 
  $('step-input').value = '';
  if ($('step-duration')) $('step-duration').value = '';
  
  // Re-render list using the same editable template
  renderModalSteps();
  initIcons();
};
// ==================== TASK CATEGORIES (localStorage-backed, no DB column needed) ====================
let taskCategories = {};

function loadTaskCategories() {
  try {
    taskCategories = JSON.parse(localStorage.getItem('axon_task_categories') || '{}');
    // Normalizar IDs a string para evitar desajustes con Supabase (number vs string)
    taskCategories = Object.fromEntries(
      Object.entries(taskCategories).map(([k, v]) => [String(k), v])
    );
  } catch (e) {
    taskCategories = {};
  }
}
loadTaskCategories();

const getTaskCategory = (task) => {
  return taskCategories[String(task.id)] || 'Personal';
};

const setTaskCategory = (taskId, category) => {
  taskCategories[String(taskId)] = category;
  localStorage.setItem('axon_task_categories', JSON.stringify(taskCategories));
};

const removeTaskCategory = (taskId) => {
  delete taskCategories[String(taskId)];
  localStorage.setItem('axon_task_categories', JSON.stringify(taskCategories));
};

const getSelectedCategory = () => {
  const checked = document.querySelector('input[name="task-category"]:checked');
  return checked ? checked.value : 'Personal';
};

const createProject = async () => {
  const title = capitalizeFirstLetter($('new-task-title').value); if(!title) return;
  const energy = $('new-task-energy').value;
  const assignee = $('new-task-assignee') ? $('new-task-assignee').value : 'Ambos';
  const category = getSelectedCategory();
  const { data, error } = await supabase.from('tasks').insert([{
    title,
    description: capitalizeFirstLetter($('new-task-desc').value),
    energy_level: energy,
    assignee: assignee,
    status: 'todo',
    steps: currentStepsInModal
  }]).select();
  if (error) {
    console.error("Error al crear tarea:", error);
    showToast("Error al crear: " + error.message);
    return;
  }

  // Guardar categoría en localStorage
  if (data && data[0]) {
    setTaskCategory(data[0].id, category);
  }
  
  // Si venía del Cerebro (Vault), eliminamos la nota original
  // Si venía del Cerebro (Vault), eliminamos la nota original
  if (vaultDocToConvert) {
    try {
      await supabase.from('vault_docs').delete().eq('id', vaultDocToConvert);
      vaultDocToConvert = null;
      fetchVaultDocs();
    } catch (e) {
      vaultDocs = vaultDocs.filter(d => String(d.id) !== String(vaultDocToConvert));
      localStorage.setItem('axon_vault_docs', JSON.stringify(vaultDocs));
      vaultDocToConvert = null;
      renderVault();
    }
  }

  // Si venía del Inbox, eliminamos la nota original
  if (inboxDocToConvert) {
    try {
      await supabase.from('inbox').delete().eq('id', inboxDocToConvert);
      inboxDocToConvert = null;
      fetchInbox();
    } catch (e) {
      inboxDocs = inboxDocs.filter(d => String(d.id) !== String(inboxDocToConvert));
      localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
      inboxDocToConvert = null;
      renderInbox();
    }
  }

  $('task-modal').style.display = 'none'; fetchTasks();
};

$('save-task').onclick = createProject;

window.openSchedule = (title, duration = 25) => {
  taskToSchedule = title; 
  window.currentScheduleDuration = duration; // Guardamos la duración para usarla al confirmar
  $('schedule-task-name').textContent = `${title} (${formatDuration(duration)})`;
  const now = new Date(); now.setMinutes(now.getMinutes()+5);
  $('schedule-time').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('schedule-modal').style.display = 'flex';
};
$('confirm-schedule').onclick = async () => {
  const t = $('schedule-time').value; if(!t) return;
  const dur = window.currentScheduleDuration || 25;
  const start = new Date(t), end = new Date(start.getTime() + dur * 60000);
  selectedTaskTitle = taskToSchedule;
  await syncCalendar('scheduled', start.toISOString(), end.toISOString());
  $('schedule-modal').style.display = 'none';
  showToast(`📅 ¡Agendado (${formatDuration(dur)})! Tu teléfono te avisará.`);
};
$('close-schedule-modal').onclick = () => $('schedule-modal').style.display = 'none';

// --- MODAL MANAGEMENT ---
window.openAddSelector = () => {
  const m = $('add-selector-modal');
  if (m) {
    m.style.display = 'flex';
    if (window.initIcons) window.initIcons();
  }
};
const timeToMin = (t) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
const minToTime = (m) => { const h = Math.floor(m/60).toString().padStart(2,'0'), mm = (m%60).toString().padStart(2,'0'); return `${h}:${mm}`; };
const format12h = (tStr) => {
    if(!tStr) return '';
    let [h, m] = tStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};
const formatDuration = (min) => {
    const h = Math.floor(min/60), m = min%60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ==================== ROUTINES ====================
const routines = JSON.parse(localStorage.getItem('axon_routines') || '[]');

window.selectRoutineDays = (type) => {
  const checkboxes = document.querySelectorAll('#routine-days-container input');
  checkboxes.forEach(cb => {
    const val = parseInt(cb.value);
    if (type === 'all') cb.checked = true;
    else if (type === 'weekdays') cb.checked = (val >= 1 && val <= 5);
    else if (type === 'weekend') cb.checked = (val === 6 || val === 0);
    else if (type === 'none') cb.checked = false;
  });
};

function renderDayChipsShort(days) {
  const dayNames = ['D','L','M','X','J','V','S'];
  if (days.length === 7) return "Diario";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "L-V";
  return days.sort().map(d => dayNames[d]).join('');
}

function renderRoutines() {
  $('routines-list').innerHTML = routines.map(r => `
    <div class="routine-chip" style="padding: 0.3rem 0.6rem;">
      <span class="routine-emoji">${r.emoji}</span>
      <span class="routine-name" style="font-weight:600; margin: 0 0.3rem;">${r.name}</span>
      <span class="routine-chip-days" style="opacity:0.6; font-size:0.7rem;">${renderDayChipsShort(r.days)} ${format12h(r.time)} (${formatDuration(r.duration)})</span>
      <button class="routine-chip-edit" style="margin-left:0.3rem" onclick="window.editRoutine('${r.id}')">✏️</button>
      <button class="routine-chip-remove" onclick="window.deleteRoutine('${r.id}')">✕</button>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:0.8rem">Aún no tienes rutinas. ¡Agrega tus pilares!</p>';
  
  updateRoutineSuggestions();
}

function updateRoutineSuggestions() {
  const categories = [...new Set(routines.map(r => r.name))];
  const list = $('routine-suggestions');
  if (list) {
    list.innerHTML = categories.map(c => `<option value="${c}">`).join('') + 
      '<option value="Trabajo"><option value="Hobby"><option value="Ejercicio"><option value="Familia"><option value="Descanso">';
  }
}

$('add-routine-btn').onclick = () => {
  $('routine-id').value = '';
  $('routine-modal-title').textContent = '🔒 Nueva Rutina';
  $('routine-name').value = ''; 
  $('routine-emoji').value = '🎯'; // Default emoji
  
  // Calcular hora sugerida (cascada) basada en la última rutina
  let defaultTime = '06:00';
  if (routines && routines.length > 0) {
    const sorted = [...routines].sort((a,b) => a.time.localeCompare(b.time));
    const last = sorted[sorted.length - 1];
    defaultTime = minToTime(timeToMin(last.time) + last.duration);
  }
  
  $('routine-time').value = defaultTime; 
  $('routine-hours').value = '0'; $('routine-minutes').value = '30';
  document.querySelectorAll('.day-check input').forEach(cb => cb.checked = false);
  $('routine-modal').style.display = 'flex';
};
if ($('close-routine-modal')) {
  $('close-routine-modal').onclick = () => $('routine-modal').style.display = 'none';
}

$('save-routine').onclick = () => {
  const name = $('routine-name').value; if (!name) return;
  let emoji = $('routine-emoji').value || '🎯';
  // Si pusieron más de un carácter (y no es un emoji compuesto), truncar o dejar solo el primer emoji
  if (emoji.length > 4) emoji = emoji.substring(0, 2); 
  const days = [...document.querySelectorAll('.day-check input:checked')].map(cb => parseInt(cb.value));
  if (!days.length) { showToast("⚠️ Selecciona al menos un día"); return; }
  
  const time = $('routine-time').value;
  const h = parseInt($('routine-hours').value) || 0;
  const m = parseInt($('routine-minutes').value) || 0;
  const duration = (h * 60) + m;
  
  if (duration <= 0) { showToast("⚠️ La duración debe ser mayor a 0"); return; }

  const id = $('routine-id').value;
  if (id) {
    const idx = routines.findIndex(r => r.id === id);
    if (idx > -1) routines[idx] = { ...routines[idx], name, emoji, days, time, duration };
  } else {
    routines.push({ id: Date.now().toString(), name, emoji, days, time, duration });
  }

  localStorage.setItem('axon_routines', JSON.stringify(routines));
  $('routine-modal').style.display = 'none';
  renderRoutines(); renderPlanner();
  showToast(id ? `✅ Rutina actualizada` : `🔒 Rutina "${name}" creada`);
};

window.editRoutine = (id) => {
  const r = routines.find(rout => rout.id === id);
  if (!r) return;
  
  $('routine-id').value = r.id;
  $('routine-modal-title').textContent = '✏️ Editar Rutina';
  $('routine-name').value = r.name;
  $('routine-emoji').value = r.emoji;
  $('routine-time').value = r.time;
  $('routine-hours').value = Math.floor(r.duration / 60);
  $('routine-minutes').value = r.duration % 60;
  
  document.querySelectorAll('.day-check input').forEach(cb => {
    cb.checked = r.days.includes(parseInt(cb.value));
  });
  
  $('routine-modal').style.display = 'flex';
};

window.deleteRoutine = (id) => {
  if (!window.confirm('¿Eliminar esta rutina?')) return;
  const idx = routines.findIndex(r => String(r.id) === String(id));
  if (idx > -1) { routines.splice(idx, 1); localStorage.setItem('axon_routines', JSON.stringify(routines)); renderRoutines(); renderPlanner(); showToast('✅ Rutina eliminada'); }
};

window.selectRoutineDays = (mode) => {
  const checkboxes = document.querySelectorAll('#routine-days-container input');
  checkboxes.forEach(cb => {
    const val = parseInt(cb.value);
    if (mode === 'all') cb.checked = true;
    else if (mode === 'none') cb.checked = false;
    else if (mode === 'weekdays') cb.checked = (val >= 1 && val <= 5);
  });
};

// ==================== GOOGLE CALENDAR EMBED ====================
let gcalId1 = localStorage.getItem('axon_gcal_id_1') || 'bffs.16.04.95@gmail.com';
let gcalId2 = localStorage.getItem('axon_gcal_id_2') || 'ec2bb1482572211b29bf0aaf281832d2701bfff84fb598ab4d91c70d2c3935c2@group.calendar.google.com';
let gcalId3 = localStorage.getItem('axon_gcal_id_3') || '42ed8e94b879dca88ae92956a9bf0f4780da36fbbde26f849aabb32a437c2e13@group.calendar.google.com';
let gcalViewMode = localStorage.getItem('axon_gcal_view') || 'WEEK';

function buildGCalUrl() {
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
    let url = `https://calendar.google.com/calendar/embed?showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=${gcalViewMode}&wkst=1&bgcolor=%23ffffff&ctz=${tz}`;
    if (gcalId1) url += `&src=${encodeURIComponent(gcalId1)}&color=%234285F4`;
    if (gcalId2) url += `&src=${encodeURIComponent(gcalId2)}&color=%23E67C73`;
    if (gcalId3) url += `&src=${encodeURIComponent(gcalId3)}&color=%237986CB`;
    return url;
}

function loadGCal() {
    const iframe = $('gcal-iframe');
    if (!iframe) return;
    const url = buildGCalUrl();
    iframe.src = url;
    // Ajustar altura según viewport
    iframe.style.height = window.innerWidth < 768 ? '450px' : '600px';
}

window.setGCalView = (mode) => {
    gcalViewMode = mode;
    localStorage.setItem('axon_gcal_view', mode);
    document.querySelectorAll('.gcal-view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    loadGCal();
};

window.refreshGCal = () => {
    loadGCal();
    showToast('🔄 Calendario actualizado');
};

window.openGCalSettings = () => {
    $('gcal-id-1').value = gcalId1;
    $('gcal-id-2').value = gcalId2;
    $('gcal-id-3').value = gcalId3;
    $('gcal-settings-modal').style.display = 'flex';
};

window.saveGCalUrl = () => {
    gcalId1 = $('gcal-id-1').value.trim();
    gcalId2 = $('gcal-id-2').value.trim();
    gcalId3 = $('gcal-id-3').value.trim();
    localStorage.setItem('axon_gcal_id_1', gcalId1);
    localStorage.setItem('axon_gcal_id_2', gcalId2);
    localStorage.setItem('axon_gcal_id_3', gcalId3);
    $('gcal-settings-modal').style.display = 'none';
    loadGCal();
    showToast('✅ Calendarios guardados');
};

window.togglePlannerView = () => {
    const blocksView = $('planner-blocks-view');
    const gcalContainer = $('gcal-container');
    const toggleBtn = $('toggle-view-btn');
    const showingBlocks = blocksView.style.display !== 'none';

    if (showingBlocks) {
        blocksView.style.display = 'none';
        gcalContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = '📋 Ver Bloques';
    } else {
        blocksView.style.display = 'block';
        gcalContainer.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = '📅 Ver Calendario';
        renderPlanner();
    }
};

// Cargar calendario al iniciar
document.addEventListener('DOMContentLoaded', () => {
    if (gcalUrl) loadGCal();
});

// ==================== WEEKLY PLANNER ====================
function getWeekDays() {
  const today = new Date();
  // Forzamos mediodía para evitar problemas de saltos de día por zona horaria o horario de verano
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  const day = base.getDay(); // 0=Dom, 1=Lun...
  
  // Si hoy es Domingo (0), queremos que la planificación empiece mañana Lunes (+1)
  // Si es cualquier otro día, queremos el Lunes de esta misma semana
  let monday = new Date(base);
  if (day === 0) {
    monday.setDate(base.getDate() + 1);
  } else {
    monday.setDate(base.getDate() - (day - 1));
  }
  
  return Array.from({length:7}, (_,i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function getRoutineBlocksForDay(date) {
  const dayOfWeek = date.getDay();
  return routines.filter(r => r.days.includes(dayOfWeek)).map(r => ({
    id: `routine-${r.id}-${date.toISOString().slice(0,10)}`,
    time: r.time, taskTitle: `${r.emoji} ${r.name}`, isRoutine: true, duration: r.duration, synced: false
  }));
}

function renderPlanner() {
  const days = getWeekDays(), today = new Date().toDateString();

  $('week-grid').innerHTML = days.map((d,i) => {
    const dateStr = d.toISOString().slice(0,10);
    const routineBlocks = getRoutineBlocksForDay(d);
    const workBlocks = weekPlan.filter(b => b.day === dateStr).map(b => ({...b, duration: b.duration || 30})); // Default 30min for manual
    const allBlocks = [...routineBlocks, ...workBlocks].sort((a,b) => a.time.localeCompare(b.time));
    const isToday = d.toDateString() === today;

    let blocksHtml = '';
    let lastEndMin = null;

    if (allBlocks.length === 0) {
      blocksHtml = '<p style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem 0">Sin bloques</p>';
    } else {
      allBlocks.forEach(b => {
        const startMin = timeToMin(b.time);
        
        // Calcular espacio libre antes de este bloque
        if (lastEndMin !== null && startMin > lastEndMin + 5) {
          const gap = startMin - lastEndMin;
          blocksHtml += `<div class="plan-block free">
            <div class="plan-block-info">
              <span class="plan-block-time">${format12h(minToTime(lastEndMin))}</span>
              <span class="plan-block-title">☕ Libre: ${formatDuration(gap)}</span>
            </div>
          </div>`;
        }

        const areaClass = b.area && !b.isRoutine ? `area-${b.area.toLowerCase()}` : '';
        blocksHtml += `<div class="plan-block ${b.isRoutine?'routine':''} ${b.synced?'synced':''} ${areaClass}">
          <div class="plan-block-info">
            <span class="plan-block-time">${format12h(b.time)}</span>
            <span class="plan-block-title">${b.area && !b.isRoutine ? getAreaEmoji(b.area) + ' ' : ''}${b.taskTitle}${b.duration ? ` (${formatDuration(b.duration)})`:''}</span>
          </div>
          ${b.isRoutine ? '<span class="plan-block-lock">🔒</span>' : b.synced ? '<span class="plan-block-synced-icon">✓</span>' : `<button class="plan-block-remove" onclick="window.removePlanBlock('${b.id}')">✕</button>`}
        </div>`;

        lastEndMin = startMin + (b.duration || 30);
      });

      // Espacio libre al final del día (hasta las 10 PM por ejemplo, o simplemente dejarlo así)
    }

    return `<div class="day-column">
      <div class="day-header">
        <span class="day-name ${isToday?'day-today':''}">${dayNames[i]} ${isToday?'(Hoy)':''}</span>
        <span class="day-date">${d.getDate()}/${d.getMonth()+1}</span>
        <div style="display:flex; gap:0.3rem;">
          <button class="day-add-btn" style="background:var(--danger); opacity:0.6;" onclick="window.clearCalendarDay('${dateStr}')" title="Limpiar este día en Calendar">🗑️</button>
          <button class="day-add-btn" onclick="window.addPlanBlock('${dateStr}','${dayNames[i]} ${d.getDate()}/${d.getMonth()+1}')">+ Bloque</button>
        </div>
      </div>
      <div class="plan-blocks">${blocksHtml}</div>
    </div>`;
  }).join('');
}

let selectedPlanArea = 'Salud';
const AREA_COLORS = {
    Salud: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', emoji: '🩺' },
    Trabajo: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', emoji: '💼' },
    Creativo: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', emoji: '🎨' },
    Familia: { color: '#ec4899', bg: 'rgba(236,72,153,0.08)', emoji: '❤️' },
    Estudio: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', emoji: '📚' },
    Otro: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', emoji: '📌' }
};
function getAreaEmoji(area) { return AREA_COLORS[area]?.emoji || ''; }
function getAreaColor(area) { return AREA_COLORS[area]?.color || 'var(--border)'; }
function getAreaBg(area) { return AREA_COLORS[area]?.bg || 'transparent'; }

window.selectPlanArea = (area, btn) => {
    selectedPlanArea = area;
    document.querySelectorAll('.area-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.addPlanBlock = (dateStr, label) => {
  $('plan-block-day-label').textContent = label;
  const datalist = $('plan-task-suggestions');
  const input = $('plan-task-input');
  
  // Sugerir tareas actuales
  datalist.innerHTML = allTasks.filter(t=>t.status!=='done').map(t => {
    let opts = `<option value="${t.title}">`;
    (t.steps||[]).filter(s=>!s.done).forEach(s => opts += `<option value="${t.title}: ${s.text}">`);
    return opts;
  }).join('');

  input.value = '';
  
  // Calcular hora sugerida (cascada)
  
  const dayDate = new Date(dateStr + "T12:00:00");
  const routineBlocks = getRoutineBlocksForDay(dayDate);
  const workBlocks = weekPlan.filter(b => b.day === dateStr).map(b => ({...b, duration: b.duration || 30}));
  const allBlocks = [...routineBlocks, ...workBlocks].sort((a,b) => a.time.localeCompare(b.time));
  
  let defaultTime = '09:00';
  if(allBlocks.length > 0) {
      const lastBlock = allBlocks[allBlocks.length - 1];
      const endMin = timeToMin(lastBlock.time) + (lastBlock.duration || 30);
      defaultTime = minToTime(endMin);
  }

  $('plan-block-time').value = defaultTime;
  $('plan-block-duration').value = '30';
  $('plan-block-modal').style.display = 'flex';

  $('save-plan-block').onclick = () => {
    const title = input.value, time = $('plan-block-time').value;
    const duration = parseInt($('plan-block-duration').value) || 30;
    if(!title||!time) return;
    weekPlan.push({ id: Date.now().toString(), day: dateStr, time, taskTitle: title, synced: false, duration, area: selectedPlanArea });
    localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
    $('plan-block-modal').style.display = 'none';
    renderPlanner();
  };
};
$('close-plan-modal').onclick = () => $('plan-block-modal').style.display = 'none';

window.removePlanBlock = (id) => {
  const idx = weekPlan.findIndex(b=>b.id===id);
  if(idx>-1) { weekPlan.splice(idx,1); localStorage.setItem('axon_week_plan',JSON.stringify(weekPlan)); renderPlanner(); }
};

window.clearCalendarDay = async (dateStr) => {
  if (!window.confirm(`¿Limpiar todos los bloques de Axon del día ${dateStr} en Google Calendar?`)) return;

  calStatus.textContent = 'Cleaning day...';
  // Limpiar ambos calendarios
  try {
    const calendars = [gcalId2, gcalId3].filter(Boolean);
    for (const calId of calendars) {
      const url = new URL(N8N_URL);
      await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_day', day: dateStr, calendarId: calId })
      });
    }

    // Reset local sync state for this day
    weekPlan.forEach(b => { if (b.day === dateStr) b.synced = false; });
    localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));

    let syncedRoutineIds = JSON.parse(sessionStorage.getItem('synced_routines') || '[]');
    syncedRoutineIds = syncedRoutineIds.filter(id => !id.includes(dateStr));
    sessionStorage.setItem('synced_routines', JSON.stringify(syncedRoutineIds));

    showToast(`🗑️ Día ${dateStr} limpiado. Puedes volver a sincronizar.`);
    calStatus.textContent = 'Day cleared';
    renderPlanner();
  } catch (e) {
    showToast("⚠️ No se pudo limpiar el calendario");
    console.error(e);
  }
};

window.newEmptyWeek = () => {
    if (!window.confirm('✨ ¿Empezar una semana desde cero?\n\nEsto borrará TODAS las rutinas y bloques actuales. No afecta tus plantillas guardadas ni Google Calendar.')) return;
    routines.length = 0;
    weekPlan.length = 0;
    localStorage.setItem('axon_routines', JSON.stringify(routines));
    localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
    renderRoutines();
    renderPlanner();
    showToast('✅ Semana limpia. ¡A construir!');
};

window.clearEntireWeek = async () => {
  if (!window.confirm("⚠️ ¿ESTÁS SEGURO? Esto eliminará TODOS los bloques de tu planificación semanal local.\n\n(No borrará tus 'Rutinas Inamovibles', solo los bloques de trabajo asignados)")) return;

  const confirmGoogle = window.confirm("¿Deseas también intentar LIMPIAR el Google Calendar de toda la semana?\n\n(Esto enviará una señal a n8n para cada día. Recomendado si te equivocaste y no quieres duplicados)");

  if (confirmGoogle) {
    const days = getWeekDays().map(d => d.toISOString().slice(0, 10));
    calStatus.textContent = 'Clearing Week...';
    showToast("⏳ Iniciando limpieza en Google Calendar...");
    
    const calendars = [gcalId2, gcalId3].filter(Boolean);
    for (const dateStr of days) {
      for (const calId of calendars) {
        try {
          const url = new URL(N8N_URL);
          await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear_day', day: dateStr, calendarId: calId })
          });
        } catch (e) {
          console.error(`Error clearing ${dateStr}:`, e);
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }
    calStatus.textContent = 'Week Cleared';
  }

  // Limpiar localmente
  weekPlan.length = 0;
  localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
  
  // Resetear estado de sincronización de rutinas (en esta sesión)
  sessionStorage.setItem('synced_routines', '[]');
  
  showToast("✅ Semana reiniciada localmente.");
  renderPlanner();
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Carga inicial de tarjetas si estamos en esa vista
    if (document.querySelector('.tab-btn[data-view="cards"].active')) window.loadCards();
});

// ==================== AXON CARDS LOGIC (SRS) ====================
let allCards = [];
let studyQueue = [];
let currentCardIndex = -1;
let currentFilter = 'All';

// ==================== SRS ALGORITHM (Graduated Intervals) ====================
const SRS_INTERVALS = [0.00694, 1, 3, 7, 14, 30, 90]; // índice = nivel (0=10min, 6=90días)
const MAX_SRS_LEVEL = 6;

const SRS_XP = { difficult: 10, good: 5, easy: 2 };

function computeSRSInterval(card, difficulty) {
  const prevLevel = card.srs_level ?? 0;
  let newLevel;
  if (difficulty === 'difficult') newLevel = 0;
  else if (difficulty === 'good') newLevel = Math.min(prevLevel + 1, MAX_SRS_LEVEL);
  else if (difficulty === 'easy') newLevel = Math.min(prevLevel + 2, MAX_SRS_LEVEL);
  else newLevel = prevLevel;

  const intervalDays = SRS_INTERVALS[newLevel];
  const nextReview = new Date();
  if (intervalDays < 1) nextReview.setMinutes(nextReview.getMinutes() + Math.round(intervalDays * 24 * 60));
  else nextReview.setDate(nextReview.getDate() + intervalDays);

  return { newLevel, intervalDays, nextReview, xp: SRS_XP[difficulty] || 0 };
}

function getCardLevelColor(level) {
  if (level >= 5) return { color: '#10b981', label: 'Dominado', cssClass: 'level-mastered' };
  if (level >= 2) return { color: '#f59e0b', label: 'En progreso', cssClass: 'level-progress' };
  return { color: '#ef4444', label: 'Débil', cssClass: 'level-weak' };
}

function getIntervalLabel(days) {
  if (days < 1) return '10 min';
  if (days === 1) return '1 día';
  return `${days} días`;
}

// ==================== STUDY SESSION STATE ====================
window._studySessionXP = 0;
window._studySessionMode = 'normal';
window._studySessionStart = null;
let studyStreakDays = parseInt(localStorage.getItem('axon_study_streak') || '0');

window.loadCards = async () => {
    let supabaseCards = [];
    try {
        const { data, error } = await supabase
            .from('flashcards')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            supabaseCards = data;
        } else if (error) {
            console.warn('Supabase cards unavailable, using local backup:', error.message);
        }
    } catch (e) {
        console.warn('Supabase connection failed, using local backup.');
    }

    // Merge con backup local
    const localCards = JSON.parse(localStorage.getItem('axon_cards_backup') || '[]');
    const localIds = new Set(localCards.map(c => c.id));
    // Solo agregar locales que NO existan ya en Supabase
    const missingLocals = localCards.filter(c => !supabaseCards.some(sc => sc.id === c.id));

    allCards = [...supabaseCards, ...missingLocals].sort((a, b) => {
        const da = new Date(a.created_at || 0);
        const db = new Date(b.created_at || 0);
        return db - da;
    });

    renderCards();
    updateCardStats();
    renderStudyDashboard();
    updateXPDisplay();
    updateCardsBadge();
};

function renderCards() {
    const list = $('cards-list');
    if (!list) return;

    // Reconstruir filtros dinámicamente
    const uniqueCategories = [...new Set(allCards.map(c => c.category).filter(Boolean))];
    const filterBar = $('cards-filter-bar');
    if (filterBar) {
        filterBar.innerHTML = `
            <button class="filter-chip ${currentFilter === 'All' ? 'active' : ''}" onclick="window.filterCards('All', this)">Todas</button>
            ${uniqueCategories.map(cat => `
                <button class="filter-chip ${currentFilter === cat ? 'active' : ''}" onclick="window.filterCards('${cat.replace(/'/g, "\\'")}', this)">${cat}</button>
            `).join('')}
        `;
    }

    const filtered = currentFilter === 'All'
        ? allCards
        : allCards.filter(c => c.category === currentFilter);

    list.innerHTML = filtered.map(card => `
        <div class="card-item" onclick="window.openCardModal('${card.id}')">
            <span class="card-category-tag">${card.category}</span>
            <div style="font-weight: 600; margin-bottom: 0.5rem;">${card.front}</div>
            <div style="font-size: 0.8rem; color: var(--text-dim); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${card.back}
            </div>
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.65rem; color: var(--primary);">Próximo: ${new Date(card.next_review).toLocaleDateString()}</span>
                <button class="btn-icon" onclick="event.stopPropagation(); window.deleteCard('${card.id}')" style="color: var(--danger);">
                    <i data-lucide="trash-2" style="width: 14px;"></i>
                </button>
            </div>
        </div>
    `).join('');

    initIcons();
}

function updateCardStats() {
    const total = allCards.length;
    const now = new Date().toISOString();
    const due = allCards.filter(c => c.next_review <= now).length;

    if ($('cards-total-count')) $('cards-total-count').textContent = total;
    if ($('cards-due-count')) $('cards-due-count').textContent = due;

    updateCardsBadge();
}

// ==================== STUDY DASHBOARD ====================
function renderStudyDashboard() {
    const dash = $('study-dashboard');
    if (!dash) return;

    const mastered = allCards.filter(c => (c.srs_level ?? 0) >= 5);
    const inProgress = allCards.filter(c => { const l = c.srs_level ?? 0; return l >= 2 && l <= 4; });
    const weak = allCards.filter(c => (c.srs_level ?? 0) <= 1);

    if (allCards.length > 0) dash.style.display = 'block';

    if ($('count-mastered')) $('count-mastered').textContent = mastered.length;
    if ($('count-progress')) $('count-progress').textContent = inProgress.length;
    if ($('count-weak')) $('count-weak').textContent = weak.length;

    // Per-category progress
    const categories = [...new Set(allCards.map(c => c.category).filter(Boolean))];
    const catList = $('category-progress-list');
    if (catList) {
        catList.innerHTML = categories.map(cat => {
            const catCards = allCards.filter(c => c.category === cat);
            const catMastered = catCards.filter(c => (c.srs_level ?? 0) >= 5).length;
            const pct = catCards.length > 0 ? Math.round((catMastered / catCards.length) * 100) : 0;
            return `<div class="category-progress-item">
                <div class="category-progress-label"><span>${cat}</span><span>${catMastered}/${catCards.length}</span></div>
                <div class="progress-bar-container" style="height:5px;"><div class="progress-bar-fill" style="width:${pct}%; background:linear-gradient(90deg, var(--success), var(--accent));"></div></div>
            </div>`;
        }).join('') || '<p style="opacity:0.5;text-align:center;font-size:0.8rem;">Sin categorías</p>';
    }
}

function updateStudyStreak() {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('axon_last_study_date');
    if (lastDate !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate === yesterday.toDateString()) studyStreakDays++;
        else if (lastDate !== today) studyStreakDays = 1;
        localStorage.setItem('axon_study_streak', studyStreakDays.toString());
        localStorage.setItem('axon_last_study_date', today);
    }
}

// ==================== CARDS BADGE ====================
function updateCardsBadge() {
    const now = new Date().toISOString();
    const due = allCards.filter(c => c.next_review <= now).length;
    const weak = allCards.filter(c => c.next_review <= now && (c.srs_level ?? 0) <= 1).length;

    // Update document title
    if (due > 0) document.title = `(${due}) Axon Flow - ${weak} débiles`;
    else document.title = 'Axon Flow';

    // Update tab badge
    const badge = $('cards-pending-badge');
    if (badge) {
        badge.textContent = due;
        badge.style.display = due > 0 ? 'inline-block' : 'none';
    }
}

// ==================== NOTIFICATIONS ====================
window.requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

function sendSmartNotification(title, body) {
    if (timerId && currentMode === 'pomodoro') return;
    if ($('study-modal') && $('study-modal').style.display === 'flex') return;
    showNotification(title, body);
}

let studyReminderTimeout = null;
window.scheduleStudyReminder = (hour = 10, minute = 0) => {
    if (studyReminderTimeout) clearTimeout(studyReminderTimeout);
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    studyReminderTimeout = setTimeout(async () => {
        const dueNow = allCards.filter(c => c.next_review <= new Date().toISOString()).length;
        if (dueNow > 0) {
            const granted = await window.requestNotificationPermission();
            if (granted) sendSmartNotification(`${dueNow} tarjetas por estudiar`, '¡5 minutos y brillas! 🧠');
        }
        window.scheduleStudyReminder(hour, minute);
    }, target - now);

    localStorage.setItem('axon_reminder_hour', hour.toString());
    localStorage.setItem('axon_reminder_minute', minute.toString());
};

// ==================== GAMIFICATION ====================
const POLYMATH_LEVELS = [
    { name: 'Novato', minXP: 0, emoji: '🌱' },
    { name: 'Aprendiz', minXP: 100, emoji: '📚' },
    { name: 'Explorador', minXP: 300, emoji: '🔍' },
    { name: 'Erudito', minXP: 1000, emoji: '🧠' },
    { name: 'Maestro', minXP: 3000, emoji: '👨‍🏫' },
    { name: 'Polímata', minXP: 10000, emoji: '🌟' }
];

let userXP = parseInt(localStorage.getItem('axon_user_xp') || '0');

function getPolymathLevel(xp) {
    let level = POLYMATH_LEVELS[0];
    for (const l of POLYMATH_LEVELS) if (xp >= l.minXP) level = l;
    return level;
}

function getXPForNextLevel(xp) {
    for (const l of POLYMATH_LEVELS) if (xp < l.minXP) return { next: l.name, remaining: l.minXP - xp, nextMin: l.minXP };
    return { next: 'Máximo', remaining: 0, nextMin: xp + 1000 };
}

function checkLevelUp(oldXP, newXP) {
    const oldLevel = getPolymathLevel(oldXP);
    const newLevel = getPolymathLevel(newXP);
    if (newLevel.name !== oldLevel.name) {
        fireConfetti();
        showToast(`🎉 ¡Subiste a ${newLevel.emoji} ${newLevel.name}!`);
    }
}

function updateXPDisplay() {
    const level = getPolymathLevel(userXP);
    const { next, remaining, nextMin } = getXPForNextLevel(userXP);
    const currentMin = level.minXP;
    const pct = Math.min(100, Math.round(((userXP - currentMin) / (nextMin - currentMin)) * 100));

    const widget = $('xp-widget');
    if (widget && userXP > 0) widget.style.display = 'block';
    if ($('xp-level-emoji')) $('xp-level-emoji').textContent = level.emoji;
    if ($('xp-level-name')) $('xp-level-name').textContent = level.name;
    if ($('xp-total')) $('xp-total').textContent = userXP;
    if ($('xp-progress-fill')) $('xp-progress-fill').style.width = pct + '%';
    if ($('xp-next-label')) $('xp-next-label').textContent = remaining > 0 ? `${remaining} XP para ${next}` : '¡Nivel máximo!';
}

window.filterCards = (category, btn) => {
    currentFilter = category;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCards();
};

window.toggleCustomCategory = () => {
    const sel = $('card-category');
    const custom = $('card-category-custom');
    if (sel.value === '__custom__') {
        custom.style.display = 'block';
        custom.focus();
    } else {
        custom.style.display = 'none';
        custom.value = '';
    }
};

window.getCardCategory = () => {
    const sel = $('card-category');
    if (!sel) return 'General';
    if (sel.value === '__custom__') {
        const customInput = $('card-category-custom');
        const custom = customInput ? customInput.value.trim() : '';
        return custom || 'General';
    }
    return sel.value || 'General';
};

window.openCardModal = (id = null) => {
    const modal = $('card-modal');
    const title = $('card-modal-title');
    const front = $('card-front');
    const back = $('card-back');
    const category = $('card-category');
    const custom = $('card-category-custom');
    const idInput = $('edit-card-id');

    custom.style.display = 'none';
    custom.value = '';

    if (id) {
        const card = allCards.find(c => c.id === id);
        title.textContent = '📝 Editar Tarjeta';
        front.value = card.front;
        back.value = card.back;
        // Check if category matches preset options
        const presets = ['Languages', 'Health', 'General', 'Music', 'Tech'];
        if (presets.includes(card.category)) {
            category.value = card.category;
        } else {
            category.value = '__custom__';
            custom.style.display = 'block';
            custom.value = card.category || '';
        }
        idInput.value = card.id;
    } else {
        title.textContent = '✨ Nueva Tarjeta de Estudio';
        front.value = '';
        back.value = '';
        category.value = 'General';
        idInput.value = '';
    }

    modal.style.display = 'flex';
};

window.saveCard = async () => {
    const id = $('edit-card-id')?.value || '';
    const frontEl = $('card-front');
    const backEl = $('card-back');
    if (!frontEl || !backEl) {
        showToast('⚠️ Error: no se encontraron los campos.');
        return;
    }
    const front = capitalizeFirstLetter(frontEl.value.trim());
    const back = capitalizeFirstLetter(backEl.value.trim());
    const category = window.getCardCategory();

    if (!front || !back) {
        showToast('⚠️ Por favor completa ambos lados.');
        return;
    }

    const cardData = {
        front,
        back,
        category,
        srs_level: 0,
        reviews_count: 0,
        last_review: null,
        next_review: new Date().toISOString()
    };

    // Guardar en localStorage SIEMPRE como backup
    const localCards = JSON.parse(localStorage.getItem('axon_cards_backup') || '[]');

    try {
        let error;
        if (id) {
            const result = await supabase.from('flashcards').update(cardData).eq('id', id);
            error = result.error;
            // Actualizar también en backup local
            const idx = localCards.findIndex(c => c.id === id);
            if (idx >= 0) localCards[idx] = { ...localCards[idx], ...cardData };
        } else {
            const result = await supabase.from('flashcards').insert([cardData]).select();
            error = result.error;
            // Guardar en backup local con ID temporal
            if (!error && result.data?.[0]) {
                cardData.id = result.data[0].id;
                localCards.push(cardData);
            } else if (error) {
                // Si Supabase falla, guardar con ID local
                cardData.id = 'local_' + Date.now();
                cardData.created_at = new Date().toISOString();
                localCards.push(cardData);
            }
        }

        localStorage.setItem('axon_cards_backup', JSON.stringify(localCards));

        if (error) {
            console.error('Supabase card save error:', error.message);
            showToast('💾 Guardado localmente (DB no disponible).');
            $('card-modal').style.display = 'none';
            window.loadCards();
            return;
        }

        showToast('✅ Tarjeta guardada con éxito.');
        $('card-modal').style.display = 'none';
        window.loadCards();
    } catch (e) {
        // Fallback total: guardar solo en localStorage
        console.error('Card save exception:', e);
        cardData.id = 'local_' + Date.now();
        cardData.created_at = new Date().toISOString();
        localCards.push(cardData);
        localStorage.setItem('axon_cards_backup', JSON.stringify(localCards));
        showToast('💾 Guardado localmente (sin conexión).');
        $('card-modal').style.display = 'none';
        window.loadCards();
    }
};

window.deleteCard = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta tarjeta?')) return;

    // Eliminar de backup local siempre
    const localCards = JSON.parse(localStorage.getItem('axon_cards_backup') || '[]');
    const filtered = localCards.filter(c => c.id !== id);
    localStorage.setItem('axon_cards_backup', JSON.stringify(filtered));

    // Intentar eliminar de Supabase
    try {
        const { error } = await supabase.from('flashcards').delete().eq('id', id);
        if (error) console.warn('Supabase delete error:', error.message);
    } catch (e) {}

    showToast('🗑️ Tarjeta eliminada.');
    window.loadCards();
};

// --- MARKDOWN IMPORT ---
window.openMarkdownImportModal = () => {
    $('md-import-input').value = '';
    $('md-import-result').innerHTML = '';
    $('md-import-modal').style.display = 'flex';
};

window.processMarkdownImport = async () => {
    const input = $('md-import-input').value.trim();
    const category = $('md-import-category').value;
    const resultEl = $('md-import-result');

    if (!input) {
        resultEl.innerHTML = '<span style="color:var(--danger);">⚠️ Pega contenido Markdown primero.</span>';
        return;
    }

    // Parse pairs: **Q:** ... **A:** ...
    const pairs = [];
    const lines = input.split('\n');
    let currentQ = null;

    for (const line of lines) {
        const qMatch = line.match(/^\*\*Q:\*\*\s*(.+)/i);
        const aMatch = line.match(/^\*\*A:\*\*\s*(.+)/i);

        if (qMatch) {
            currentQ = qMatch[1].trim();
        } else if (aMatch && currentQ) {
            pairs.push({ front: currentQ, back: aMatch[1].trim() });
            currentQ = null;
        }
    }

    if (pairs.length === 0) {
        resultEl.innerHTML = '<span style="color:var(--warning);">⚠️ No se encontraron pares Q/A. Usa el formato: **Q:** pregunta **A:** respuesta</span>';
        return;
    }

    resultEl.innerHTML = `<span style="color:var(--text-dim);">⏳ Importando ${pairs.length} tarjetas...</span>`;

    const cards = pairs.map(p => ({
        front: p.front,
        back: p.back,
        category,
        srs_level: 0,
        reviews_count: 0,
        last_review: null,
        next_review: new Date().toISOString()
    }));

    let imported = 0;
    for (const card of cards) {
        const { error } = await supabase.from('flashcards').insert([card]);
        if (!error) imported++;
    }

    resultEl.innerHTML = `<span style="color:var(--success);">✅ Se importaron ${imported} de ${pairs.length} tarjetas con éxito.</span>`;

    if (imported > 0) {
        setTimeout(() => {
            $('md-import-modal').style.display = 'none';
            window.loadCards();
        }, 1500);
    }

    showToast(`📄 ${imported} tarjetas importadas a ${category}`);
};

// --- JSON IMPORT ---
window.openJsonImportModal = () => {
    $('json-import-input').value = '';
    $('json-import-result').innerHTML = '';
    $('json-import-modal').style.display = 'flex';
};

window.processJsonImport = async () => {
    const input = $('json-import-input').value;
    const defaultCategory = $('json-import-category').value;
    const resultEl = $('json-import-result');

    if (!input || !input.trim()) {
        resultEl.innerHTML = '<span style="color:var(--danger);">⚠️ Pega JSON primero.</span>';
        return;
    }

    // Strip markdown code fences and clean
    let cleaned = input.trim();
    if (/^```/i.test(cleaned)) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    }

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        const pos = parseInt(e.message.match(/position\s+(\d+)/i)?.[1], 10);
        let snippet = '';
        if (pos !== null && !isNaN(pos) && pos < cleaned.length) {
            const start = Math.max(0, pos - 15);
            const end = Math.min(cleaned.length, pos + 15);
            const raw = cleaned.slice(start, end);
            snippet = `<br><span style="font-size:0.75rem;font-family:monospace;background:var(--surface-light);padding:4px 8px;border-radius:4px;">→ ${raw.replace(/</g,'&lt;').replace(/>/g,'&gt;')} ←</span>`;
            // Also show char codes for debugging invisible chars
            const charCodes = [...raw].map(c => c.charCodeAt(0)).join(' ');
            snippet += `<br><span style="font-size:0.65rem;color:var(--text-dim);">códigos: ${charCodes}</span>`;
        }
        resultEl.innerHTML = `<span style="color:var(--danger);">⚠️ JSON inválido: ${e.message}${snippet}</span>`;
        return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        resultEl.innerHTML = '<span style="color:var(--warning);">⚠️ Debe ser un array no vacío. Ej: [{ "front": "...", "back": "..." }]</span>';
        return;
    }

    // Normalize each entry to { front, back, category }
    const pairs = [];
    for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (typeof item !== 'object' || item === null) {
            resultEl.innerHTML = `<span style="color:var(--danger);">⚠️ Elemento ${i + 1} no es un objeto válido.</span>`;
            return;
        }
        const front = item.front || item.question || item.q || item.pregunta || '';
        const back = item.back || item.answer || item.a || item.respuesta || '';
        if (!front || !back) {
            resultEl.innerHTML = `<span style="color:var(--danger);">⚠️ Elemento ${i + 1} falta 'front' o 'back'.<br><span style="font-size:0.75rem;color:var(--text-dim);">Campos encontrados: ${Object.keys(item).join(', ') || '(ninguno)'}</span></span>`;
            return;
        }
        pairs.push({
            front: String(front).trim(),
            back: String(back).trim(),
            category: item.category || defaultCategory
        });
    }

    resultEl.innerHTML = `<span style="color:var(--text-dim);">⏳ Importando ${pairs.length} tarjetas...</span>`;

    const cards = pairs.map(p => ({
        front: p.front,
        back: p.back,
        category: p.category,
        srs_level: 0,
        reviews_count: 0,
        last_review: null,
        next_review: new Date().toISOString()
    }));

    let imported = 0;
    for (const card of cards) {
        const { error } = await supabase.from('flashcards').insert([card]);
        if (!error) imported++;
    }

    resultEl.innerHTML = `<span style="color:var(--success);">✅ Se importaron ${imported} de ${pairs.length} tarjetas con éxito.</span>`;

    if (imported > 0) {
        setTimeout(() => {
            $('json-import-modal').style.display = 'none';
            window.loadCards();
        }, 1500);
    }

    showToast(`📄 ${imported} tarjetas importadas desde JSON`);
};

// --- STUDY SESSION LOGIC ---
window.startStudySession = () => {
    const now = new Date().toISOString();
    const allDue = allCards.filter(c => c.next_review <= now);
    const weakDue = allDue.filter(c => (c.srs_level ?? 0) <= 1);
    const quickDue = allDue.filter(c => (c.srs_level ?? 0) >= 3);

    if (allDue.length === 0) {
        showToast('🎉 ¡No tienes tarjetas pendientes por hoy!');
        return;
    }

    // Show mode selector
    if ($('study-mode-pending')) {
        $('study-mode-pending').textContent =
            `${allDue.length} pendientes · ${weakDue.length} débiles · ${quickDue.length} repaso rápido`;
    }
    $('study-mode-modal').style.display = 'flex';
};

window.startStudyWithMode = (mode) => {
    const now = new Date().toISOString();
    const allDue = allCards.filter(c => c.next_review <= now);

    switch (mode) {
        case 'weak':
            studyQueue = allDue.filter(c => (c.srs_level ?? 0) <= 1);
            break;
        case 'quick':
            studyQueue = allDue.filter(c => (c.srs_level ?? 0) >= 3);
            break;
        default:
            studyQueue = allDue;
    }

    if (studyQueue.length === 0) {
        showToast('🎉 ¡No hay tarjetas en este modo! Prueba otro.');
        return;
    }

    // Initialize session tracking
    window._studySessionXP = 0;
    window._studySessionMode = mode;
    window._studySessionStart = new Date().toISOString();

    currentCardIndex = 0;
    $('study-mode-modal').style.display = 'none';
    $('study-modal').style.display = 'flex';
    $('study-modal').setAttribute('data-mode', mode);
    renderStudyCard();

    // Request notification permission on first study
    requestNotificationPermission();
};

function renderStudyCard() {
    const card = studyQueue[currentCardIndex];
    if (!card) {
        // End of session
        const xp = window._studySessionXP || 0;
        const mode = window._studySessionMode || 'normal';
        $('study-modal').style.display = 'none';

        // Save session
        try {
            supabase.from('study_sessions').insert([{
                cards_studied: studyQueue.length,
                xp_earned: xp,
                session_mode: mode,
                ended_at: new Date().toISOString()
            }]);
        } catch(e) {}

        showToast(`🏆 ¡Sesión ${mode} completada! +${xp} XP`);
        updateCardsBadge();
        window.loadCards();
        return;
    }

    $('current-flashcard').classList.remove('flipped');
    $('card-front-text').textContent = card.front;
    $('card-back-text').textContent = card.back;
    $('study-card-category').textContent = card.category;
    $('study-actions').style.display = 'none';
    $('flip-hint').style.display = 'block';

    // Update SRS button labels dynamically
    const lvl = card.srs_level ?? 0;
    if ($('srs-hard-label')) $('srs-hard-label').textContent = 'Nivel 0 (10 min)';
    if ($('srs-good-label')) {
        const goodLvl = Math.min(lvl + 1, MAX_SRS_LEVEL);
        $('srs-good-label').textContent = `${getIntervalLabel(SRS_INTERVALS[goodLvl])} → Nvl ${goodLvl}`;
    }
    if ($('srs-easy-label')) {
        const easyLvl = Math.min(lvl + 2, MAX_SRS_LEVEL);
        $('srs-easy-label').textContent = `${getIntervalLabel(SRS_INTERVALS[easyLvl])} → Nvl ${easyLvl}`;
    }

    // Show card level
    const levelInfo = getCardLevelColor(lvl);
    if ($('study-card-level')) $('study-card-level').textContent = `${levelInfo.label} (Nvl ${lvl})`;
}

window.flipCard = () => {
    const card = $('current-flashcard');
    if (!card.classList.contains('flipped')) {
        card.classList.add('flipped');
        $('study-actions').style.display = 'grid';
        $('flip-hint').style.display = 'none';
    }
};

window.answerCard = async (difficulty) => {
    const card = studyQueue[currentCardIndex];
    if (!card) return;

    const { newLevel, intervalDays, nextReview, xp } = computeSRSInterval(card, difficulty);
    const now = new Date().toISOString();

    const updates = {
        srs_level: newLevel,
        next_review: nextReview.toISOString(),
        last_interval: intervalDays,
        last_review: now,
        reviews_count: (card.reviews_count ?? 0) + 1
    };

    // Update in-memory (allCards + studyQueue)
    const acIdx = allCards.findIndex(c => c.id === card.id);
    if (acIdx >= 0) Object.assign(allCards[acIdx], updates);
    Object.assign(card, updates);

    // Persist to localStorage
    const localCards = JSON.parse(localStorage.getItem('axon_cards_backup') || '[]');
    const lcIdx = localCards.findIndex(c => c.id === card.id);
    if (lcIdx >= 0) Object.assign(localCards[lcIdx], updates);
    localStorage.setItem('axon_cards_backup', JSON.stringify(localCards));

    // Persist to Supabase (silent fail)
    try {
        await supabase.from('flashcards').update(updates).eq('id', card.id);
    } catch (e) {}

    // Accumulate XP
    window._studySessionXP = (window._studySessionXP || 0) + xp;

    // Update gamification
    userXP += xp;
    localStorage.setItem('axon_user_xp', userXP.toString());
    checkLevelUp(userXP - xp, userXP);
    updateXPDisplay();

    // Update study streak
    updateStudyStreak();

    // Dynamic toast
    const labels = { difficult: 'Difícil', good: 'Bien', easy: 'Fácil' };
    const levelInfo = getCardLevelColor(newLevel);
    showToast(`${labels[difficulty]} | Nivel ${newLevel} ${levelInfo.label} | +${xp} XP`);

    currentCardIndex++;
    renderStudyCard();
};
window.openVaultModal = (docId = null) => {
  const modal = $('vault-modal');
  const titleEl = $('vault-modal-title');
  const titleInput = $('vault-title');
  const contentInput = $('vault-content');
  const imageInput = $('vault-image');
  const editId = $('edit-vault-id');

  if (docId) {
    const doc = vaultDocs.find(d => String(d.id) === String(docId));
    if (!doc) return;
    titleEl.textContent = '📝 Editar Documento';
    titleInput.value = doc.title || '';
    contentInput.value = doc.content || '';
    imageInput.value = doc.cover_image || '';
    editId.value = docId;
  } else {
    titleEl.textContent = '🧠 Nuevo Documento';
    titleInput.value = '';
    contentInput.value = '';
    imageInput.value = '';
    editId.value = '';
  }
  modal.style.display = 'flex';
};

window.closeVaultModal = () => vaultModal.style.display = 'none';

window.saveVaultDoc = async () => {
  const editId = $('edit-vault-id')?.value || '';
  const title = capitalizeFirstLetter($('vault-title').value);
  const content = $('vault-content').value;
  const image = $('vault-image').value;
  if (!title) return alert("El título es obligatorio");

  const docData = { title, content, cover_image: image, area: 'General' };

  try {
    if (editId) {
      const { error } = await supabase.from('vault_docs').update(docData).eq('id', editId);
      if (error) throw error;
      showToast("Documento actualizado 🧠 (Nube)");
    } else {
      const { error } = await supabase.from('vault_docs').insert([docData]);
      if (error) throw error;
      showToast("Documento guardado en el Cerebro 🧠 (Nube)");
    }
  } catch (e) {
    console.warn("Error Supabase Vault:", e);
    if (editId) {
      const idx = vaultDocs.findIndex(d => String(d.id) === String(editId));
      if (idx >= 0) vaultDocs[idx] = { ...vaultDocs[idx], ...docData };
    } else {
      vaultDocs.unshift({ id: Date.now(), ...docData, created_at: new Date().toISOString() });
    }
    localStorage.setItem('axon_vault_docs', JSON.stringify(vaultDocs));
    showToast(editId ? "Documento actualizado 🧠 (Local)" : "Documento guardado 🧠 (Local)");
  }
  closeVaultModal();
  fetchVaultDocs();
};

async function fetchVaultDocs() {
  try {
    const { data, error } = await supabase.from('vault_docs').select('*').order('created_at', { ascending: false });
    if(data && !error) {
        vaultDocs = data;
        localStorage.setItem('axon_vault_docs', JSON.stringify(vaultDocs));
    }
  } catch (e) {}
  renderVault();
}
window.fetchVaultDocs = fetchVaultDocs;

function renderVault() {
  const grid = $('vault-list');
  if(!grid) return;
  grid.innerHTML = vaultDocs.map(doc => `
    <div class="vault-card">
      ${doc.cover_image ? `<img src="${doc.cover_image}" alt="cover">` : ''}
      <h4>${doc.title}</h4>
      <p>${doc.content || 'Sin descripción...'}</p>
      <div style="display:flex; gap:0.5rem; margin-top:0.75rem; flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="window.convertVaultToTask('${doc.id}')" style="flex:1; font-size:0.75rem;">📋 Tarea</button>
        <button class="btn btn-outline" onclick="window.convertVaultToCard('${doc.id}')" style="flex:1; font-size:0.75rem; background:rgba(139,92,246,0.1); border-color:var(--primary); color:var(--primary);">🧠 Tarjeta</button>
        <button class="btn btn-outline" onclick="window.openVaultModal('${doc.id}')" style="flex:0; font-size:0.75rem;">✏️</button>
        <button class="btn btn-outline" onclick="window.deleteVaultDoc('${doc.id}')" style="flex:0; font-size:0.75rem; color:var(--danger); border-color:rgba(239,68,68,0.3);">🗑️</button>
      </div>
    </div>
  `).join('') || '<p style="text-align:center; opacity:0.5; grid-column: 1/-1; padding:2rem;">El Cerebro está esperando tus ideas.</p>';
  if (window.lucide) lucide.createIcons();
}

window.convertVaultToTask = (docId) => {
  const doc = vaultDocs.find(d => String(d.id) === String(docId));
  if (!doc) return;
  vaultDocToConvert = docId; 
  $('new-task-title').value = doc.title;
  $('new-task-desc').value = doc.content || '';
  taskModal.style.display = 'flex';
  showToast("Pre-cargado desde el Vault");
};

window.convertVaultToCard = (docId) => {
  const doc = vaultDocs.find(d => String(d.id) === String(docId));
  if (!doc) return;

  const modal = $('card-modal');
  const title = $('card-modal-title');
  const front = $('card-front');
  const back = $('card-back');
  const category = $('card-category');
  const custom = $('card-category-custom');
  const idInput = $('edit-card-id');

  custom.style.display = 'none';
  custom.value = '';
  title.textContent = '🧠 Desde el Cerebro';
  front.value = doc.title || '';
  back.value = doc.content || '';
  category.value = 'General';
  idInput.value = '';
  modal.style.display = 'flex';
  showToast('🧠 Contenido precargado desde el Cerebro');
};

window.deleteVaultDoc = async (id) => {
  if (!confirm("¿Eliminar este documento del Cerebro?")) return;
  try {
    const { error } = await supabase.from('vault_docs').delete().eq('id', id);
    if (error) throw error;
    showToast("🗑️ Documento eliminado del Cerebro");
  } catch (e) {
    vaultDocs = vaultDocs.filter(d => String(d.id) !== String(id));
    localStorage.setItem('axon_vault_docs', JSON.stringify(vaultDocs));
    showToast("🗑️ Documento eliminado (Local)");
  }
  fetchVaultDocs();
};
let selectedProfile = 'Pipe';

window.setStatProfile = (profile, btn) => {
    document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedProfile = profile;
    loadStats();
};

async function loadStats() {
  const { data: sessions } = await supabase.from('focus_sessions').select('*').order('created_at', { ascending: false }).limit(100);
  if (!sessions) return;

  const completed = sessions.filter(s => s.completed);
  const totalSecs = completed.reduce((a,s) => a + (s.duration_seconds||0), 0);
  $('stat-total-pomodoros').textContent = completed.length;
  $('stat-focus-hours').textContent = (totalSecs/3600).toFixed(1)+'h';

  const last7 = Array.from({length:7}, (_,i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return d; });
  const chartData = last7.map(d => {
    const key = d.toDateString();
    return { label: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()], count: completed.filter(s => new Date(s.started_at).toDateString()===key).length };
  });
  const maxCount = Math.max(...chartData.map(d=>d.count), 1);
  $('weekly-chart').innerHTML = chartData.map(d => `<div class="chart-bar-wrapper">
    <div class="chart-bar-value">${d.count||''}</div>
    <div class="chart-bar" style="height:${Math.max(d.count/maxCount*100, 4)}%"></div>
    <div class="chart-bar-label">${d.label}</div>
  </div>`).join('');

  // Fix stat-completion
  const totalSessions = sessions.length || 1;
  const completionRate = Math.round((completed.length / totalSessions) * 100);
  if ($('stat-completion')) $('stat-completion').textContent = completionRate + '%';

  updateStreak(completed);
  updateCoupleStats(allTasks, completed);
  renderJournalMetricsChart();
  renderWeeklySummary();
}
window.loadStats = loadStats;

function updateStreak(completedSessions) {
  const dates = new Set();
  completedSessions.forEach(s => {
    if (s.started_at) dates.add(new Date(s.started_at).toDateString());
  });

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const check = new Date(today);
    check.setDate(today.getDate() - i);
    if (dates.has(check.toDateString())) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  const streakBadge = $('streak-count');
  if (streakBadge) streakBadge.textContent = streak;

  const statStreak = $('stat-streak');
  if (statStreak) statStreak.textContent = streak;

  localStorage.setItem('axon_streak', streak);
}

function renderJournalMetricsChart() {
    const container = $('journal-metrics-chart');
    if (!container) return;

    const localJournals = JSON.parse(localStorage.getItem('axon_journals') || '[]');
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i); return d;
    });

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dailyData = last7.map(d => {
        const dateStr = d.toISOString().slice(0, 10);
        const entries = localJournals.filter(j => j.created_at && j.created_at.startsWith(dateStr));
        const avg = (field) => entries.length > 0
            ? Math.round(entries.reduce((s, e) => s + (e[field] || 0), 0) / entries.length)
            : 0;
        return { label: dayNames[d.getDay()], energy: avg('energy_level'), focus: avg('focus_level'), stress: avg('stress_level') };
    });

    container.innerHTML = dailyData.map(d => `
        <div class="metric-day-column">
            <span style="font-size:0.65rem; color:var(--text-dim); margin-bottom:0.3rem;">${d.label}</span>
            <div class="metric-bar-stack">
                ${d.energy > 0 ? `<div class="metric-segment segment-energy" style="height:${d.energy * 20}%;" title="Energía: ${d.energy}"></div>` : ''}
                ${d.focus > 0 ? `<div class="metric-segment segment-focus" style="height:${d.focus * 20}%;" title="Enfoque: ${d.focus}"></div>` : ''}
                ${d.stress > 0 ? `<div class="metric-segment segment-stress" style="height:${d.stress * 20}%;" title="Estrés: ${d.stress}"></div>` : ''}
            </div>
        </div>
    `).join('') || '<p style="text-align:center;opacity:0.5;padding:1rem;">Haz tu primer Cierre Cognitivo para ver métricas</p>';
}

function renderWeeklySummary() {
    const container = $('weekly-summary-content');
    if (!container) return;

    const journals = JSON.parse(localStorage.getItem('axon_journals') || '[]');
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i); return d;
    });

    const dailyData = last7.map(d => {
        const dateStr = d.toISOString().slice(0, 10);
        const entries = journals.filter(j => j.created_at && j.created_at.startsWith(dateStr));
        const avg = (field) => entries.length > 0
            ? Math.round(entries.reduce((s, e) => s + (e[field] || 0), 0) / entries.length * 10) / 10 : 0;
        // Routine completion
        const routineState = JSON.parse(localStorage.getItem('axon_routine_state_' + dateStr) || '{}');
        const totalRoutines = Object.keys(routineState).length;
        const doneRoutines = Object.values(routineState).filter(v => v === true).length;
        const routinePct = totalRoutines > 0 ? Math.round((doneRoutines / totalRoutines) * 100) : null;
        return { dateStr, label: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()],
            energy: avg('energy_level'), focus: avg('focus_level'), stress: avg('stress_level'),
            routines: routinePct, entries: entries.length };
    });

    const daysWithData = dailyData.filter(d => d.entries > 0);
    if (daysWithData.length < 2) {
        container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;">Necesitas al menos 2 cierres en la semana para ver el resumen. ¡Sigue así! 🌱</p>';
        return;
    }

    const avgEnergy = Math.round(daysWithData.reduce((s, d) => s + d.energy, 0) / daysWithData.length * 10) / 10;
    const avgFocus = Math.round(daysWithData.reduce((s, d) => s + d.focus, 0) / daysWithData.length * 10) / 10;
    const totalRoutineDays = dailyData.filter(d => d.routines !== null).length;
    const avgRoutines = totalRoutineDays > 0
        ? Math.round(dailyData.filter(d => d.routines !== null).reduce((s, d) => s + (d.routines || 0), 0) / totalRoutineDays) : 0;

    // Find best day
    let bestDay = daysWithData[0];
    daysWithData.forEach(d => { if (d.energy > bestDay.energy) bestDay = d; });

    // Area balance from weekly plan blocks
    const today = new Date();
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
    const areaCount = {};
    weekPlan.forEach(b => {
        const blockDate = new Date(b.day + 'T12:00:00');
        if (blockDate >= weekStart && blockDate <= today && b.area) {
            areaCount[b.area] = (areaCount[b.area] || 0) + 1;
        }
    });
    const areaEntries = Object.entries(areaCount);
    const maxArea = areaEntries.reduce((max, [, c]) => Math.max(max, c), 1);

    container.innerHTML = `
        <div class="weekly-stats-grid">
            <div class="weekly-stat"><span class="weekly-stat-num">${avgEnergy}</span><span class="weekly-stat-label">Energía prom.</span></div>
            <div class="weekly-stat"><span class="weekly-stat-num">${avgFocus}</span><span class="weekly-stat-label">Enfoque prom.</span></div>
            <div class="weekly-stat"><span class="weekly-stat-num">${avgRoutines}%</span><span class="weekly-stat-label">Rutinas</span></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-dim);text-align:center;margin-top:0.5rem;">
            🌟 Tu mejor día fue <strong>${bestDay.label}</strong> (energía ${bestDay.energy})
        </p>
        ${areaEntries.length > 0 ? `
        <div style="margin-top:0.8rem;">
            <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.3rem;">⚖️ Balance de Áreas</p>
            ${areaEntries.map(([area, count]) => `
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
                    <span style="font-size:0.75rem;width:60px;">${getAreaEmoji(area)} ${area}</span>
                    <div class="progress-bar-container" style="height:4px;flex:1;"><div class="progress-bar-fill" style="width:${(count/maxArea)*100}%;background:${getAreaColor(area)};"></div></div>
                    <span style="font-size:0.7rem;color:var(--text-dim);">${count}</span>
                </div>
            `).join('')}
        </div>` : ''}
    `;
}

async function updateCoupleStats(tasks, completedSessions) {
  const today = new Date().toDateString();

  // Si no hay tareas cargadas, consultarlas ahora
  if (!tasks || tasks.length === 0) {
    try {
      const { data } = await supabase.from('tasks').select('*');
      if (data) tasks = data;
    } catch(e) { tasks = []; }
  }

  // Pomodoros por persona desde sesiones completadas hoy
  const todaySessions = completedSessions.filter(s =>
    s.started_at && new Date(s.started_at).toDateString() === today
  );

  let pipePomos = 0, tatiPomos = 0;
  todaySessions.forEach(s => {
    const title = (s.task_title || '').toLowerCase();
    if (title.includes('pipe') || title.includes('👨')) pipePomos++;
    else if (title.includes('tati') || title.includes('👩')) tatiPomos++;
  });

  // Si no se puede determinar por título, contar por assignee de las tareas
  if (pipePomos === 0 && tatiPomos === 0 && todaySessions.length > 0) {
    pipePomos = Math.floor(todaySessions.length / 2);
    tatiPomos = todaySessions.length - pipePomos;
  }

  // Tareas completadas hoy por persona
  let pipeTasks = 0, tatiTasks = 0;
  tasks.forEach(t => {
    if (t.status === 'done' && t.completed_at && new Date(t.completed_at).toDateString() === today) {
      if (t.assignee === 'Pipe') pipeTasks++;
      else if (t.assignee === 'Tati') tatiTasks++;
      else { pipeTasks++; tatiTasks++; }
    }
  });

  // Agua por perfil (formato ISO YYYY-MM-DD, igual que getWaterKey)
  const todayISO = new Date().toISOString().slice(0, 10);
  let pipeWater = parseFloat(localStorage.getItem('axon_water_Pipe_' + todayISO) || '0');
  let tatiWater = parseFloat(localStorage.getItem('axon_water_Tati_' + todayISO) || '0');
  // Fallback: intentar formato viejo toDateString
  if (pipeWater === 0) pipeWater = parseFloat(localStorage.getItem('axon_water_Pipe_' + today) || '0');
  if (tatiWater === 0) tatiWater = parseFloat(localStorage.getItem('axon_water_Tati_' + today) || '0');

  // Mostrar quién va ganando
  const pipeScore = pipePomos + pipeTasks + Math.floor(pipeWater);
  const tatiScore = tatiPomos + tatiTasks + Math.floor(tatiWater);

  const pipeFire = $('pipe-fire');
  const tatiFire = $('tati-fire');
  if (pipeFire) pipeFire.style.display = pipeScore > tatiScore ? 'block' : 'none';
  if (tatiFire) tatiFire.style.display = tatiScore > pipeScore ? 'block' : 'none';

  const pp = $('pipe-pomos'); if (pp) pp.textContent = pipePomos;
  const pt = $('pipe-tasks'); if (pt) pt.textContent = pipeTasks;
  const pw = $('pipe-water'); if (pw) pw.textContent = pipeWater.toFixed(1);

  const tp = $('tati-pomos'); if (tp) tp.textContent = tatiPomos;
  const tt = $('tati-tasks'); if (tt) tt.textContent = tatiTasks;
  const tw = $('tati-water'); if (tw) tw.textContent = tatiWater.toFixed(1);
}

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

// ==================== MODAL STEPS ====================
window.renderModalSteps = () => {
    const list = $('modal-steps-list');
    if (!list) return;
    list.innerHTML = currentStepsInModal.map((s, i) => {
        const iconAssignee = s.assignee === 'Pipe' ? '👨' : (s.assignee === 'Tati' ? '👩' : '🤝');
        return `<div class="step-item" style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
            <span style="font-size: 0.75rem; opacity: 0.5; min-width: 20px; font-family: monospace;">${i + 1}.</span>
            <input type="text" value="${s.text}" onchange="window.updateModalStep(${i}, 'text', this.value)" style="flex:1; margin:0; padding:4px 8px; font-size:0.85rem;" placeholder="Paso a seguir...">
            <button class="btn-mini" onclick="window.cycleModalStepAssignee(${i})" title="Cambiar responsable">${iconAssignee}</button>
            <button class="btn-mini" onclick="window.removeModalStep(${i})" style="color:var(--danger)">✕</button>
        </div>`;
    }).join('') || '<p style="text-align:center; opacity:0.3; font-size:0.8rem;">No hay pasos definidos.</p>';
};

window.addModalStep = () => {
    currentStepsInModal.push({ text: '', done: false, assignee: 'Ambos' });
    window.renderModalSteps();
};

window.updateModalStep = (i, field, val) => { currentStepsInModal[i][field] = val; };

window.cycleModalStepAssignee = (i) => {
    const s = currentStepsInModal[i];
    const sequence = ['Ambos', 'Pipe', 'Tati'];
    let idx = sequence.indexOf(s.assignee || 'Ambos');
    s.assignee = sequence[(idx + 1) % sequence.length];
    window.renderModalSteps();
};

window.removeModalStep = (i) => {
    currentStepsInModal.splice(i, 1);
    window.renderModalSteps();
};

// ==================== INBOX CONVERSION ====================
window.convertInboxToTask = (docId) => {
    const doc = inboxDocs.find(d => String(d.id) === String(docId));
    if (!doc) return;
    inboxDocToConvert = docId;
    $('new-task-title').value = doc.content;
    $('new-task-desc').value = '';
    taskModal.style.display = 'flex';
    showToast("Pre-cargado desde el Inbox");
};

// ==================== NAVIGATION ====================
window.openAddSelector = () => {
    $('add-selector-modal').style.display = 'flex';
};

window.openTaskModal = () => {
    selectedTaskId = null;
    $('new-task-title').value = '';
    $('new-task-desc').value = '';
    currentStepsInModal = [];
    window.renderModalSteps();
    $('task-modal').style.display = 'flex';
};

window.openQuickCapture = () => {
    const modal = $('quick-capture-modal');
    if (modal) {
        modal.style.display = 'block';
        const input = $('inbox-content');
        if (input) input.focus();
    }
};

window.closeQuickCapture = () => {
    const modal = $('quick-capture-modal');
    if (modal) modal.style.display = 'none';
    const input = $('inbox-content');
    if (input) input.value = '';
};

window.saveInbox = async () => {
    const input = $('inbox-content');
    if (!input) return;
    const text = capitalizeFirstLetter(input.value.trim());
    if (!text) return;

    try {
        const { error } = await supabase.from('inbox').insert([{ content: text }]);
        if (error) throw error;
        showToast("📥 Idea capturada en la Nube");
    } catch (e) {
        console.warn("Error Inbox Supabase:", e);
        inboxDocs.unshift({ id: Date.now(), content: text, created_at: new Date().toISOString() });
        localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
        showToast("📥 Idea capturada Localmente");
    }

    input.value = '';
    window.closeQuickCapture();
    fetchInbox();
};

async function fetchInbox() {
    try {
        const { data, error } = await supabase.from('inbox').select('*').order('created_at', { ascending: false });
        if (data && !error) {
            inboxDocs = data;
            localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
        }
    } catch (e) {
        const local = localStorage.getItem('axon_inbox_docs');
        if (local) inboxDocs = JSON.parse(local);
    }
    renderInbox();
}
window.fetchInbox = fetchInbox;

function renderInbox() {
    const container = $('inbox-list');
    if (!container) return;
    
    container.innerHTML = inboxDocs.map(doc => `
        <div class="inbox-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border);">
            <div style="flex:1; margin-right:10px;">
                <p style="margin:0; font-size:0.9rem; color:var(--text);">${doc.content}</p>
                <small style="opacity:0.5; font-size:0.7rem; color:var(--text-dim);">${new Date(doc.created_at).toLocaleDateString()}</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-mini" onclick="window.convertInboxToTask('${doc.id}')" title="Convertir a Tarea" style="background:var(--surface-light); border:1px solid var(--border); color:var(--text);">
                    <i data-lucide="layers" style="width:14px; height:14px;"></i>
                </button>
                <button class="btn-mini" onclick="window.deleteInboxItem('${doc.id}')" title="Eliminar" style="background:var(--surface-light); border:1px solid var(--border); color:var(--danger);">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                </button>
            </div>
        </div>
    `).join('') || '<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:20px; color:var(--text-dim);">Tu bandeja está vacía.</p>';
    
    if (window.lucide) lucide.createIcons();
}
window.renderInbox = renderInbox;

window.deleteInboxItem = async (id) => {
    if (!confirm("¿Eliminar esta idea del Inbox?")) return;
    try {
        const { error } = await supabase.from('inbox').delete().eq('id', id);
        if (error) throw error;
        showToast("🗑️ Eliminado del Inbox");
    } catch (e) {
        inboxDocs = inboxDocs.filter(d => String(d.id) !== String(id));
        localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
        showToast("🗑️ Eliminado Localmente");
    }
    fetchInbox();
};

// ==================== WATER TRACKER ====================
let waterProfile = localStorage.getItem('axon_water_profile') || 'Pipe';

const getWaterKey = () => {
  const iso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD locale-independent
  return `axon_water_${waterProfile}_${iso}`;
};

// Migrar de formato viejo (toDateString) a ISO si es necesario
const migrateWaterKey = (profile) => {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const oldKey = `axon_water_${profile}_` + today.toDateString();
  const newKey = `axon_water_${profile}_${iso}`;
  const oldVal = localStorage.getItem(oldKey);
  if (oldVal !== null && localStorage.getItem(newKey) === null) {
    localStorage.setItem(newKey, oldVal);
  }
  return parseFloat(localStorage.getItem(newKey) || '0');
};

let waterTotal = migrateWaterKey(waterProfile);

window.switchWaterProfile = (profile, btn) => {
    waterProfile = profile;
    localStorage.setItem('axon_water_profile', profile);

    // Update active button
    document.querySelectorAll('.water-profile-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Reload water total for this profile
    waterTotal = parseFloat(localStorage.getItem(getWaterKey()) || '0');
    updateWaterDisplay();
};

window.addWater = (amount) => {
    const before = waterTotal;
    waterTotal += amount;
    localStorage.setItem(getWaterKey(), waterTotal.toString());
    updateWaterDisplay();
    showToast(`💧 ${waterProfile}: +${amount.toFixed(2)}L | Total: ${waterTotal.toFixed(1)}L`);

    // Dopamina: confeti al llegar a 3L
    if (before < 3 && waterTotal >= 3) {
        fireConfetti();
        setTimeout(() => fireConfetti(), 400);
        showToast(`🏆 ¡${waterProfile} LLEGÓ A 3L! ¡Hidratación óptima! 🎉`);
    }
};

window.resetWater = () => {
    waterTotal = 0;
    localStorage.setItem(getWaterKey(), '0');
    updateWaterDisplay();
};

window.saveWater = () => {
    const litros = waterTotal.toFixed(1);
    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    // Guardar en localStorage por perfil
    const historial = JSON.parse(localStorage.getItem('axon_water_history') || '{}');
    const key = `${waterProfile}_${new Date().toDateString()}`;
    historial[key] = waterTotal;
    localStorage.setItem('axon_water_history', JSON.stringify(historial));

    // Notificación visual
    showToast(`💧 ${waterProfile}: ¡Hidratación guardada! ${litros}L — ${hoy}`);

    // Reiniciar contador para mañana
    waterTotal = 0;
    localStorage.setItem(getWaterKey(), '0');
    updateWaterDisplay();
};

function updateWaterDisplay() {
    const current = $('water-current');
    const fill = $('water-fill');
    if (current) current.textContent = waterTotal.toFixed(1);
    if (fill) fill.style.width = Math.min((waterTotal / 3) * 100, 100) + '%';
}

// Init water profile button on load
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector(`.water-profile-btn[data-water-profile="${waterProfile}"]`);
    if (btn) { btn.classList.add('active'); }
});

// ==================== JSON IMPORT ====================
window.toggleJsonImport = () => {
    const container = $('json-import-container');
    if (container) container.style.display = container.style.display === 'none' ? 'block' : 'none';
};

window.processJsonImport = () => {
    const input = $('json-import-input');
    if (!input || !input.value.trim()) return;
    try {
        const data = JSON.parse(input.value);
        const { rawSlices } = extractStepsFromData(data);
        if (rawSlices.length > 0) {
            currentStepsInModal = rawSlices.map(s => ({
                text: s.task || s.title || s.text || s.descripcion || s.tarea || s.step || 'Paso importado',
                done: false,
                assignee: s.assignee || 'Ambos',
                duration: parseInt(s.duration || s.estimated_time || 25) || 25
            }));
            renderModalSteps();
            if (window.lucide) lucide.createIcons();
            showToast(`✅ ${rawSlices.length} pasos importados`);
        } else {
            showToast('⚠️ No se encontraron pasos en el JSON');
        }
    } catch (e) {
        showToast('❌ JSON inválido. Revisa el formato.');
    }
    input.value = '';
    const container = $('json-import-container');
    if (container) container.style.display = 'none';
};

// ==================== TEMPLATES ====================
window.openSaveTemplateModal = () => {
    $('template-name-input').value = '';
    $('save-template-modal').style.display = 'flex';
};

window.openLoadTemplateModal = async () => {
    $('load-template-modal').style.display = 'flex';
    const list = $('templates-list');
    list.innerHTML = '<p style="color:var(--text-dim); font-size:0.8rem; text-align:center;">Cargando...</p>';
    try {
        const { data } = await supabase.from('weekly_templates').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) {
            list.innerHTML = data.map(t => `
                <div style="background:var(--bg-card); padding:1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border);">
                    <span style="font-weight:600;">${t.name}</span>
                    <button class="btn-mini" onclick="window.loadTemplateById('${t.id}')" style="background:var(--primary); color:white; padding:0.4rem 0.8rem; border-radius:6px;">Cargar</button>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p style="color:var(--text-dim); text-align:center;">No hay plantillas guardadas</p>';
        }
    } catch(e) {
        const local = JSON.parse(localStorage.getItem('axon_templates') || '[]');
        if (local.length > 0) {
            list.innerHTML = local.map(t => `
                <div style="background:var(--bg-card); padding:1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border);">
                    <span style="font-weight:600;">${t.name}</span>
                    <button class="btn-mini" onclick="window.loadTemplateById('${t.id}')" style="background:var(--primary); color:white; padding:0.4rem 0.8rem; border-radius:6px;">Cargar</button>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p style="color:var(--text-dim); text-align:center;">No hay plantillas guardadas</p>';
        }
    }
};

window.loadTemplateById = async (id) => {
    let template = null;
    try {
        const { data, error } = await supabase.from('weekly_templates').select('*').eq('id', id).maybeSingle();
        if (error) console.error('Supabase load error:', error.message);
        if (data) template = data;
    } catch(e) {
        console.error('Template load exception:', e);
    }

    if (!template) {
        const local = JSON.parse(localStorage.getItem('axon_templates') || '[]');
        template = local.find(t => String(t.id) === String(id));
    }

    if (!template) { showToast('⚠️ Plantilla no encontrada'); return; }

    // DEBUG: ver la estructura real
    console.log('Template loaded:', template);
    console.log('Template.data type:', typeof template.data);
    console.log('Template.data:', template.data);

    // Intentar múltiples formatos de data
    let snapshot = template.data;
    if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch(e) { console.error('JSON parse failed:', e); }
    }

    // Si data no es el objeto directo, buscar en otras claves
    if (!snapshot || typeof snapshot !== 'object' || (!snapshot.routines && !snapshot.weekPlan)) {
        // Intentar con template completo como snapshot
        if (template.routines || template.weekPlan) {
            snapshot = template;
        }
    }

    if (!snapshot || typeof snapshot !== 'object') {
        console.error('Template data is not an object:', template);
        showToast('⚠️ Formato de plantilla inválido — revisa la consola');
        return;
    }

    if (snapshot.routines && Array.isArray(snapshot.routines)) {
        routines.length = 0;
        routines.push(...snapshot.routines);
        localStorage.setItem('axon_routines', JSON.stringify(routines));
        console.log('Loaded', snapshot.routines.length, 'routines');
    } else {
        console.warn('No routines array found in template');
    }

    if (snapshot.weekPlan && Array.isArray(snapshot.weekPlan)) {
        weekPlan.length = 0;
        weekPlan.push(...snapshot.weekPlan);
        localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
        console.log('Loaded', snapshot.weekPlan.length, 'plan blocks');
    } else {
        console.warn('No weekPlan array found in template');
    }

    $('load-template-modal').style.display = 'none';
    renderRoutines();
    renderPlanner();
    showToast('✅ Plantilla cargada. Revisa tu semana.');
};

window.confirmSaveTemplate = async () => {
    const name = $('template-name-input').value.trim();
    if (!name) { showToast('⚠️ Ponle un nombre a la plantilla'); return; }

    const snapshot = { routines: routines.slice(), weekPlan: weekPlan.slice() };
    try {
        const { error } = await supabase.from('weekly_templates').insert([{ name, data: snapshot }]);
        if (error) throw error;
        showToast('☁️ Plantilla guardada en la nube');
    } catch(e) {
        const templates = JSON.parse(localStorage.getItem('axon_templates') || '[]');
        templates.push({ id: Date.now().toString(), name, data: snapshot });
        localStorage.setItem('axon_templates', JSON.stringify(templates));
        showToast('💾 Plantilla guardada localmente');
    }
    $('save-template-modal').style.display = 'none';
};

// Initialize water display on load
updateWaterDisplay();

// Initial calls
document.addEventListener('DOMContentLoaded', () => {
    renderRoutines();
    renderPlanner();
    // Restore study reminder
    const savedHour = localStorage.getItem('axon_reminder_hour');
    const savedMinute = localStorage.getItem('axon_reminder_minute');
    if (savedHour && savedMinute) {
        window.scheduleStudyReminder(parseInt(savedHour), parseInt(savedMinute));
    } else {
        window.scheduleStudyReminder(10, 0); // Default: 10am
    }
    setTimeout(() => {
        fetchInbox();
        fetchTasks();
        if (window.loadCards) window.loadCards();
        initIcons();
        // Request notification permission on load
        window.requestNotificationPermission();
        // Reset water daily
        waterTotal = migrateWaterKey(waterProfile);
        updateWaterDisplay();
        // Restore timer if it was running (mobile background / page reload)
        const restored = restoreTimerState();
        if (restored) {
          showToast('⏱️ Pomodoro restaurado');
        }
    }, 1000);
});





