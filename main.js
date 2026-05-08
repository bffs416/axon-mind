import { createClient } from '@supabase/supabase-js';
import { createIcons, Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap } from 'lucide';

const supabase = createClient('https://blwaxxacneipoaufpiag.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU');
const N8N_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/pomodoro-sync';
const SLICER_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-slicer';

// ==================== THEME MANAGEMENT ====================
window.setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('axon_theme', theme);
    console.log(`Axon Theme set to: ${theme}`);
};

// Initialize theme
const savedTheme = localStorage.getItem('axon_theme') || 'dark';
window.setTheme(savedTheme);

// ==================== STATE ====================
let timeLeft = 25 * 60, timerId = null, currentMode = 'pomodoro', pomodoroStartTime = null;
let selectedTaskId = null, selectedTaskTitle = "Sesión de Trabajo", currentStepsInModal = [];
let currentSessionId = null, taskToSchedule = null, allTasks = [];
let vaultDocToConvert = null; // Para rastrear qué nota estamos convirtiendo
let sessionsCompleted = 0; // Para el descanso largo cada 4
let currentEnergyFilter = 'all';
let currentAssigneeFilter = 'all';
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

// ==================== DOM ====================
const $ = id => document.getElementById(id);
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
  };
});
const initIcons = () => createIcons({ icons: { Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap } });

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

function showNotification(title, body) {
  if (Notification.permission === 'granted') new Notification(title, { body, icon: '🎯' });
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

async function startTimer() {
  if (timerId) return;
  pomodoroStartTime = Date.now();
  const initialTimeLeft = timeLeft;
  const pomodoroEndTime = Date.now() + initialTimeLeft * 1000;
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
  document.body.classList.add('immersive-mode');
  timerId = setInterval(async () => {
    timeLeft = Math.max(0, Math.ceil((pomodoroEndTime - Date.now()) / 1000));
    updateDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerId); timerId = null;
      playSound('workEnd');
      document.body.classList.remove('immersive-mode');
      document.querySelector('.timer-container').classList.add('timer-alarm');
      setTimeout(() => document.querySelector('.timer-container').classList.remove('timer-alarm'), 3000);
      showNotification('¡Pomodoro Completado!', selectedTaskTitle);
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
            // 20% Rare Trophy
            showNotification('🏆 ¡TROFEO RARO DESBLOQUEADO!', 'Acabas de encontrar el trofeo de la constancia.');
            fireConfetti();
        } else if (rand < 0.5) {
            // 30% Confetti + Fun Fact
            const facts = [
                "Dato TDAH: Completar tareas libera dopamina, ¡sigue así!",
                "Dato TDAH: El hiperfoco es un superpoder si lo apuntas bien.",
                "Dato TDAH: Los descansos activos mejoran la memoria a corto plazo."
            ];
            showToast(facts[Math.floor(Math.random() * facts.length)]);
            fireConfetti();
        } else {
            // 50% Normal Motivation
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

      // syncCalendar('free'); // Desactivado para no saturar el calendario
      fetchTasks(); loadStats();
      startBtn.disabled = false; pauseBtn.disabled = true;
    }
  }, 1000);
  startBtn.disabled = true; pauseBtn.disabled = false;
}

pauseBtn.onclick = async () => {
  clearInterval(timerId); timerId = null;
  document.body.classList.remove('immersive-mode');
  if (currentSessionId) {
    const dur = Math.round((Date.now() - pomodoroStartTime)/1000);
    await supabase.from('focus_sessions').update({ ended_at: new Date().toISOString(), duration_seconds: dur, completed: false }).eq('id', currentSessionId);
    currentSessionId = null;
  }
  startBtn.disabled = false; pauseBtn.disabled = true;
};

resetBtn.onclick = () => {
  clearInterval(timerId); timerId = null; timeLeft = modes[currentMode];
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
  taskList.innerHTML = filteredTasks.map(task => {
    const steps = task.steps || [], doneCount = steps.filter(s=>s.done).length;
    const prog = steps.length ? (doneCount/steps.length)*100 : (task.status==='done'?100:0);
    const stale = staleDays(task);
    const staleClass = (task.status !== 'done' && task.status !== 'frozen') ? (stale >= 5 ? 'stale-danger' : stale >= 2 ? 'stale-warning' : '') : '';
    const sel = selectedTaskId === task.id ? 'selected' : '';
    
    // Energy & Assignee Tags
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
  }).join('') || `<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay tareas en esta vista.</p>`;

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
  currentStepsInModal = JSON.parse(JSON.stringify(task.steps || [])); // Deep copy para evitar mutar el original antes de guardar
  renderModalSteps();
  $('save-task').textContent = 'Actualizar Proyecto';
  taskModal.style.display = 'flex';

  // Override save to update instead of insert
  $('save-task').onclick = async () => {
    const title = $('new-task-title').value; if (!title) return;
    const energy = $('new-task-energy').value;
    const assignee = $('new-task-assignee') ? $('new-task-assignee').value : 'Ambos';
    const { error } = await supabase.from('tasks').update({ title, description: $('new-task-desc').value, energy_level: energy, assignee: assignee, steps: currentStepsInModal }).eq('id', id);
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
    vaultDocToConvert = null; // Limpiamos si es una creación manual
    currentStepsInModal = []; 
    $('modal-steps-list').innerHTML = ''; 
    $('new-task-title').value = ''; 
    $('new-task-desc').value = ''; 
    $('new-task-energy').value = 'medium';
    $('save-task').onclick = createProject; // Restaura la función de crear
    $('task-modal').style.display = 'flex'; 
    if(window.lucide) lucide.createIcons();
};
if($('add-task-btn')) $('add-task-btn').onclick = window.openAddTaskModal;
let journalMood = 'neutral';
document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.style.filter = 'grayscale(1)');
        btn.style.filter = 'none';
        btn.style.transform = 'scale(1.2)';
        journalMood = btn.dataset.mood;
    };
});

window.saveDailyJournal = async () => {
    const wins = $('journal-wins').value;
    const frustrations = $('journal-frustrations').value;
    
    showToast("📔 Guardando cierre cognitivo...");
    
    // Intento de guardado en Supabase
    const { error } = await supabase.from('daily_journal').insert([{
        mood: journalMood, wins, frustrations
    }]);
    
    if(error) {
        console.warn("No se pudo guardar en Supabase, usando backup local.");
        localStorage.setItem('axon_journal_' + new Date().toDateString(), JSON.stringify({journalMood, wins, frustrations}));
    }
    
    $('journal-modal').style.display = 'none';
    showMultipotentialSummary();
};

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
    return { rawSlices, parsedTitle, parsedDesc };
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
            })
        });

        if (!response.ok) throw new Error("Error en la conexión con la IA");

        const dataRaw = await response.json();
        const { rawSlices, parsedTitle, parsedDesc } = extractStepsFromData(dataRaw);
        
        if (parsedTitle) titleField.value = parsedTitle;
        if (parsedDesc) descField.value = parsedDesc;

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

    try {
        const response = await fetch('https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-slicer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea })
        });
        
        const dataRaw = await response.json();
        const { rawSlices, parsedTitle, parsedDesc } = extractStepsFromData(dataRaw);

        if (parsedTitle) titleField.value = parsedTitle;
        if (parsedDesc) descField.value = parsedDesc;
        
        if (rawSlices.length > 0) {
            currentStepsInModal = rawSlices.map(s => ({
                text: s.task || s.descripcion || s.tarea || s.text || s.step || "Paso sin nombre",
                done: false,
                assignee: s.assignee || s.responsable || '🤝 Ambos',
                duration: parseInt(s.duration || s.estimated_time || s.duracion || s.tiempo || s.time) || 25
            }));
            
            renderModalSteps();
            if(window.lucide) lucide.createIcons();
            showToast("✅ Proyecto rebanado y listo");
        } else {
            console.error("AXON DEBUG - No se encontraron tareas. Datos crudos:", dataRaw);
            showToast("⚠️ La IA no devolvió tareas claras.");
        }
    } catch (e) {
        console.error("Error en suggestWithAI:", e);
        showToast("❌ Error al conectar con el Arquitecto.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
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
  const v = $('step-input').value; if(!v) return;
  const a = $('step-assignee') ? $('step-assignee').value : '🤝 Ambos';
  const d = $('step-duration') ? parseInt($('step-duration').value) : 30;
  currentStepsInModal.push({text:v, done:false, assignee:a, duration: d}); 
  $('step-input').value = '';
  if ($('step-duration')) $('step-duration').value = '';
  
  // Re-render list using the same editable template
  renderModalSteps();
  initIcons();
};
const createProject = async () => {
  const title = $('new-task-title').value; if(!title) return;
  const energy = $('new-task-energy').value;
  const assignee = $('new-task-assignee') ? $('new-task-assignee').value : 'Ambos';
  const { error } = await supabase.from('tasks').insert([{ 
    title, 
    description: $('new-task-desc').value, 
    energy_level: energy, 
    assignee: assignee,
    status: 'todo', 
    steps: currentStepsInModal
  }]);
  if (error) {
    console.error("Error al crear tarea:", error);
    showToast("Error al crear: " + error.message);
    return;
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

// ==================== HELPERS ====================
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

        blocksHtml += `<div class="plan-block ${b.isRoutine?'routine':''} ${b.synced?'synced':''}">
          <div class="plan-block-info">
            <span class="plan-block-time">${format12h(b.time)}</span>
            <span class="plan-block-title">${b.taskTitle}${b.duration ? ` (${formatDuration(b.duration)})`:''}</span>
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
    weekPlan.push({ id: Date.now().toString(), day: dateStr, time, taskTitle: title, synced: false, duration });
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
  if (!window.confirm(`¿Quieres limpiar todos los bloques de Axon Mind del día ${dateStr} en tu Google Calendar?`)) return;
  
  calStatus.textContent = 'Cleaning day...';
  try {
    const url = new URL(N8N_URL);
    await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_day', day: dateStr })
    });

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

$('sync-all-btn').onclick = async () => {
  const days = getWeekDays();
  const allRoutineBlocks = days.flatMap(d => getRoutineBlocksForDay(d).map(b => ({...b, day: d.toISOString().slice(0,10)})));
  const unsyncedWork = weekPlan.filter(b => !b.synced);
  const syncedRoutineIds = JSON.parse(sessionStorage.getItem('synced_routines') || '[]');
  const unsyncedRoutines = allRoutineBlocks.filter(b => !syncedRoutineIds.includes(b.id));
  const allUnsynced = [...unsyncedWork, ...unsyncedRoutines];

  if (!allUnsynced.length) { showToast("✅ Todo ya está sincronizado"); return; }
  
  calStatus.textContent = 'Syncing...';
  let count = 0;
  let failed = [];

  for (const block of allUnsynced) {
    const datePart = block.day; // YYYY-MM-DD
    const timePart = block.time; // HH:mm
    const dur = block.duration || 30;
    
    // Calculamos fin en minutos
    const startTotalMin = timeToMin(timePart);
    const endTotalMin = startTotalMin + dur;
    const endTimePart = minToTime(endTotalMin);

    // Calculamos el offset UTC local (ej: "-05:00" para Colombia)
    const offsetMin = new Date().getTimezoneOffset(); // en minutos, signo invertido
    const sign = offsetMin <= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60).toString().padStart(2, '0');
    const absM = (Math.abs(offsetMin) % 60).toString().padStart(2, '0');
    const tzOffset = `${sign}${absH}:${absM}`; // ej: "-05:00"

    try {
      const url = new URL(N8N_URL);
      const res = await fetch(url.toString(), { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId: block.taskTitle, 
          status: 'scheduled', 
          // ISO 8601 con offset explícito para que GCal no lo mueva
          startTime: `${datePart}T${timePart}:00${tzOffset}`, 
          endTime: `${datePart}T${endTimePart}:00${tzOffset}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          duration: dur,
          isRoutine: block.isRoutine
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (block.isRoutine) syncedRoutineIds.push(block.id);
      else block.synced = true;
      count++;
      
      // Pequeña pausa para evitar rate-limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error("Sync error:", e);
      failed.push(block.taskTitle);
    }
  }

  localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
  sessionStorage.setItem('synced_routines', JSON.stringify(syncedRoutineIds));
  
  if (failed.length > 0) {
    calStatus.textContent = 'Sync partial';
    showToast(`⚠️ Error en: ${failed.join(', ')}`, 5000);
  } else {
    calStatus.textContent = 'All Synced!';
    fireConfetti();
    showToast(`📅 ¡${count} bloques subidos a Calendar!`);
  }
  
  renderPlanner();
};

window.openSaveTemplateModal = () => {
  $('template-name-input').value = '';
  $('save-template-modal').style.display = 'flex';
};

window.confirmSaveTemplate = async () => {
  const name = $('template-name-input').value.trim();
  if (!name) return;
  
  const data = {
    name: name,
    routines: routines,
    week_plan: weekPlan
  };
  
  try {
    const { error } = await supabase.from('weekly_templates').insert([data]);
    if (error) throw error;
    showToast("☁️ Plantilla guardada en la Nube");
    $('save-template-modal').style.display = 'none';
  } catch (e) {
    showToast("⚠️ Error al guardar en la Nube");
    console.error(e);
  }
};

window.openLoadTemplateModal = async () => {
  $('load-template-modal').style.display = 'flex';
  $('templates-list').innerHTML = '<p style="color:var(--text-muted); font-size: 0.8rem; text-align:center;">Cargando...</p>';
  
  try {
    const { data, error } = await supabase.from('weekly_templates').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    
    if (!data || data.length === 0) {
      $('templates-list').innerHTML = '<p style="color:var(--text-muted); font-size: 0.8rem; text-align:center;">No tienes plantillas guardadas aún.</p>';
      return;
    }
    
    $('templates-list').innerHTML = data.map(t => `
      <div class="inbox-item" style="padding: 0.8rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div style="cursor: pointer; flex: 1;" onclick="window.applyTemplate('${t.id}')">
          <strong>${t.name}</strong>
          <div style="font-size:0.7rem; color:var(--text-dim)">${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
        <button class="btn-icon" style="color: var(--danger); opacity: 0.6;" onclick="window.deleteTemplate('${t.id}')">
          <i data-lucide="trash-2" style="width: 14px;"></i>
        </button>
      </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
    window._tempTemplates = data;
  } catch (e) {
    $('templates-list').innerHTML = '<p style="color:var(--danger); font-size: 0.8rem; text-align:center;">Error al cargar plantillas.</p>';
    console.error(e);
  }
};

window.deleteTemplate = async (id) => {
  if (!window.confirm("¿Eliminar esta plantilla permanentemente?")) return;
  try {
    const { error } = await supabase.from('weekly_templates').delete().eq('id', id);
    if (error) throw error;
    showToast("🗑️ Plantilla eliminada");
    window.openLoadTemplateModal(); // Refresh
  } catch (e) {
    showToast("⚠️ Error al eliminar");
    console.error(e);
  }
};

window.applyTemplate = (id) => {
  const template = (window._tempTemplates || []).find(t => t.id === id);
  if (!template) return;

  if (!window.confirm(`¿Aplicar "${template.name}"? Se sobrescribirá tu semana actual.`)) return;
  
  // 1. Update Routines (date-agnostic)
  if (template.routines) {
    routines.length = 0;
    routines.push(...template.routines);
    localStorage.setItem('axon_routines', JSON.stringify(routines));
  }
  
  // 2. Update Week Plan (Shift dates to CURRENT week)
  if (template.week_plan && template.week_plan.length > 0) {
    const currentWeek = getWeekDays();
    const currentMonday = currentWeek[0];
    
    // Find the original Monday of the template
    const sorted = [...template.week_plan].sort((a,b) => a.day.localeCompare(b.day));
    const firstDate = new Date(sorted[0].day);
    const firstDayIdx = firstDate.getDay();
    const templateMonday = new Date(firstDate);
    templateMonday.setDate(firstDate.getDate() - (firstDayIdx === 0 ? 6 : firstDayIdx - 1));
    
    const shiftedPlan = template.week_plan.map(block => {
      const bDate = new Date(block.day);
      const diffTime = bDate.getTime() - templateMonday.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const newDate = new Date(currentMonday);
      newDate.setDate(currentMonday.getDate() + diffDays);
      
      return {
        ...block,
        day: newDate.toISOString().slice(0,10),
        synced: false
      };
    });
    
    weekPlan.length = 0;
    weekPlan.push(...shiftedPlan);
    localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
  }
  
  renderRoutines();
  renderPlanner();
  $('load-template-modal').style.display = 'none';
  showToast("✅ Plantilla aplicada y ajustada a esta semana");
};


// ==================== AXON MIND (VAULT & INBOX) ====================
let inboxDocs = JSON.parse(localStorage.getItem('axon_inbox_docs') || '[]');
let vaultDocs = JSON.parse(localStorage.getItem('axon_vault_docs') || '[]');

window.openQuickCapture = () => {
  quickCaptureModal.style.display = 'block';
  setTimeout(() => {
    $('inbox-content').focus();
    initIcons();
  }, 100);
};

window.closeQuickCapture = () => {
  quickCaptureModal.style.display = 'none';
  $('inbox-content').value = '';
};

window.saveInbox = async () => {
  const content = $('inbox-content').value;
  if (!content.trim()) return;
  try {
    const { error } = await supabase.from('inbox').insert([{ content }]);
    if (error) throw error;
    showToast("⚡ Capturado en Inbox (Nube)");
  } catch (e) {
    inboxDocs.unshift({ id: Date.now(), content, created_at: new Date().toISOString() });
    localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
    showToast("⚡ Nota guardada (Local)");
  }
  closeQuickCapture();
  fetchInbox();
};

async function fetchInbox() {
  try {
    const { data, error } = await supabase.from('inbox').select('*').order('created_at', { ascending: false });
    if(data && !error) {
        inboxDocs = data;
        localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
    }
  } catch (e) {}
  renderInbox();
}

function renderInbox() {
  const list = $('inbox-list');
  if(!list) return;
  list.innerHTML = inboxDocs.map(doc => `
    <div class="inbox-item">
      <div class="inbox-item-content">${doc.content}</div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
        <span class="inbox-item-date">${new Date(doc.created_at).toLocaleString()}</span>
        <button class="btn btn-outline" style="padding: 0.3rem 0.5rem; font-size: 0.7rem;" onclick="window.convertInboxToTask('${doc.id}')">Convertir a Tarea</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted); font-size: 0.9rem;">No hay notas en el Inbox.</p>';
}

window.convertInboxToTask = (docId) => {
  const doc = inboxDocs.find(d => String(d.id) === String(docId));
  if (!doc) return;
  inboxDocToConvert = docId; // Marcamos para borrar al guardar
  $('new-task-title').value = "Idea del Inbox";
  $('new-task-desc').value = doc.content;
  taskModal.style.display = 'flex';
  showToast("Pre-cargado desde Inbox");
};


window.openVaultModal = () => {
  $('vault-title').value = '';
  $('vault-content').value = '';
  $('vault-image').value = '';
  vaultModal.style.display = 'flex';
};

window.closeVaultModal = () => vaultModal.style.display = 'none';

window.saveVaultDoc = async () => {
  const title = $('vault-title').value;
  const content = $('vault-content').value;
  const image = $('vault-image').value;
  if (!title) return alert("El título es obligatorio");
  
  try {
    const { error } = await supabase.from('vault_docs').insert([{ title, content, cover_image: image, area: 'General' }]);
    if (error) throw error;
    showToast("Documento guardado en el Cerebro 🧠 (Nube)");
  } catch (e) {
    console.warn("Error Supabase Vault:", e);
    vaultDocs.unshift({ id: Date.now(), title, content, cover_image: image, created_at: new Date().toISOString() });
    localStorage.setItem('axon_vault_docs', JSON.stringify(vaultDocs));
    showToast("Documento guardado 🧠 (Local)");
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

function renderVault() {
  const grid = $('vault-list');
  if(!grid) return;
  grid.innerHTML = vaultDocs.map(doc => `
    <div class="vault-card">
      ${doc.cover_image ? `<img src="${doc.cover_image}" alt="cover">` : ''}
      <h4>${doc.title}</h4>
      <p>${doc.content || 'Sin descripción...'}</p>
      <button class="btn btn-outline" onclick="window.convertVaultToTask('${doc.id}')">Convertir a Tarea</button>
    </div>
  `).join('');
}

window.convertVaultToTask = (docId) => {
  const doc = vaultDocs.find(d => String(d.id) === String(docId));
  if (!doc) return;
  vaultDocToConvert = docId; // Guardamos el ID para borrarlo al guardar el proyecto
  $('new-task-title').value = doc.title;
  $('new-task-desc').value = doc.content || '';
  taskModal.style.display = 'flex';
  showToast("Pre-cargado desde el Vault");
};

// ==================== STATS ====================
// ==================== STATS ====================
let selectedProfile = 'Pipe';

document.querySelectorAll('.profile-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedProfile = btn.dataset.profile;
    loadStats();
  };
});

async function loadStats() {
  // 1. Fetch Focus Sessions
  const { data: sessions } = await supabase.from('focus_sessions').select('*').order('created_at', { ascending: false }).limit(100);
  if (!sessions) return;

  const completed = sessions.filter(s => s.completed);
  const totalSecs = completed.reduce((a,s) => a + (s.duration_seconds||0), 0);
  $('stat-total-pomodoros').textContent = completed.length;
  $('stat-completion').textContent = sessions.length ? Math.round(completed.length/sessions.length*100)+'%' : '0%';
  $('stat-focus-hours').textContent = (totalSecs/3600).toFixed(1)+'h';

  const dates = [...new Set(completed.map(s => new Date(s.started_at).toDateString()))].sort((a,b) => new Date(b)-new Date(a));
  let streak = 0;
  const check = new Date(); check.setHours(0,0,0,0);
  for (const d of dates) {
    const dd = new Date(d); dd.setHours(0,0,0,0);
    if (dd.getTime() === check.getTime()) { streak++; check.setDate(check.getDate()-1); }
    else if (dd < check) break;
  }
  $('stat-streak').textContent = streak;
  $('streak-count').textContent = streak;

  const last7 = Array.from({length:7}, (_,i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return d; });
  
  // Render Pomodoro Chart
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

  // 2. Fetch Journal Metrics
  const { data: journals } = await supabase.from('daily_journal')
    .select('*')
    .eq('profile', selectedProfile)
    .order('created_at', { ascending: false })
    .limit(7);

  if (journals) {
    // Render Wellness Bars
    const journalData = last7.map(d => {
      const entry = journals.find(j => new Date(j.created_at).toDateString() === d.toDateString());
      return { 
        label: ['D','L','M','X','J','V','S'][d.getDay()], 
        energy: entry ? entry.energy_level * 20 : 0,
        focus: entry ? entry.focus_level * 20 : 0,
        stress: entry ? entry.stress_level * 20 : 0
      };
    });

    $('journal-metrics-chart').innerHTML = journalData.map(d => `
      <div class="metric-day-column">
        <div class="metric-bar-stack">
          <div class="metric-segment segment-energy" style="height:${d.energy}%" title="Energía"></div>
          <div class="metric-segment segment-focus" style="height:${d.focus}%" title="Enfoque"></div>
          <div class="metric-segment segment-stress" style="height:${d.stress}%" title="Estrés"></div>
        </div>
        <div class="chart-bar-label">${d.label}</div>
      </div>
    `).join('');

    // Render Reflections
    $('journal-list').innerHTML = journals.map(j => `
      <div class="journal-card">
        <h5><span>${j.mood} ${new Date(j.created_at).toLocaleDateString()}</span> <span>👤 ${j.profile}</span></h5>
        <div style="margin-bottom:0.5rem">
          <span class="metric-badge">🔋 E:${j.energy_level}</span>
          <span class="metric-badge">🧠 F:${j.focus_level}</span>
          <span class="metric-badge">🔥 S:${j.stress_level}</span>
          <span class="metric-badge">😴 ${j.sleep_hours}h</span>
        </div>
        <p><strong>Victoria:</strong> ${j.wins || '---'}</p>
        <p><strong>Lección:</strong> ${j.life_lesson || '---'}</p>
        <p><strong>Frustración:</strong> ${j.frustrations || '---'}</p>
      </div>
    `).join('') || '<p>Aún no hay reflexiones para este perfil.</p>';
  }

  // 3. Render Session List
  $('sessions-list').innerHTML = sessions.slice(0,8).map(s => `<div class="session-item">
    <span class="session-title">${s.task_title}</span>
    <div class="session-meta">
      <span>${s.duration_seconds ? Math.round(s.duration_seconds/60)+'min' : '-'}</span>
      <span class="${s.completed?'session-complete':'session-incomplete'}">${s.completed?'✓ Completo':'⊘ Parcial'}</span>
    </div>
  </div>`).join('');
}

// ==================== NAVIGATION ====================
viewBtns.forEach(btn => btn.onclick = () => {
  viewBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const targetId = btn.dataset.view ? `view-${btn.dataset.view}` : btn.dataset.target;
  views.forEach(v => v.classList.remove('active'));
  $(targetId).classList.add('active');
  if(targetId === 'view-tasks') fetchTasks();
  if(targetId === 'view-plan') { renderRoutines(); renderPlanner(); }
  if(targetId === 'view-stats') loadStats();
  if(targetId === 'view-vault') { fetchVaultDocs(); fetchInbox(); }
});

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    window.openQuickCapture();
  }
});

// ==================== DIARIO DE PAREJA ====================
let selectedMood = '😊';
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.style.transform = 'scale(1)');
    btn.style.transform = 'scale(1.3)';
    selectedMood = btn.textContent;
  };
});

window.saveDailyJournal = async () => {
  const profile = $('journal-profile').value;
  const energy = parseInt($('journal-energy').value) || 3;
  const focus = parseInt($('journal-focus').value) || 3;
  const stress = parseInt($('journal-stress').value) || 3;
  const sleep = parseFloat($('journal-sleep').value) || 7;
  
  const wins = $('journal-wins').value;
  const family = $('journal-family').value;
  const lesson = $('journal-lesson').value;
  const frustrations = $('journal-frustrations').value;

  const entry = {
    profile, energy_level: energy, focus_level: focus, stress_level: stress,
    sleep_hours: sleep, mood: selectedMood,
    wins, family_impact: family, life_lesson: lesson, frustrations
  };

  try {
    const { error } = await supabase.from('daily_journal').insert([entry]);
    if (error) throw error;
    showToast("✅ ¡Cierre Cognitivo Guardado en la Nube! Descansa.");
  } catch (e) {
    console.warn("Supabase Error saving journal:", e);
    const localJournals = JSON.parse(localStorage.getItem('axon_journals') || '[]');
    localJournals.push({...entry, id: Date.now(), created_at: new Date().toISOString()});
    localStorage.setItem('axon_journals', JSON.stringify(localJournals));
    showToast(`Error Nube: ${e.message || 'Desconocido'}. Guardado Local.`);
  }

  $('journal-modal').style.display = 'none';
  $('journal-wins').value = ''; $('journal-family').value = ''; 
  $('journal-lesson').value = ''; $('journal-frustrations').value = '';
};
window.renderModalSteps = () => {
    $('modal-steps-list').innerHTML = currentStepsInModal.map((s, i) => {
        const iconAssignee = s.assignee === 'Pipe' ? '👨' : (s.assignee === 'Tati' ? '👩' : '🤝');
        return `<div class="step-item" style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
            <span style="font-size: 0.75rem; opacity: 0.5; min-width: 20px; font-family: monospace;">${i + 1}.</span>
            <span style="font-size: 1.2rem; min-width: 30px; text-align: center;">${iconAssignee}</span> 
            <input type="text" value="${s.text}" 
                style="flex:1; background:var(--bg-card); border:1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; color:var(--text); font-size:0.85em; font-weight:500;" 
                onchange="window.updateModalStepText(${i}, this.value)">
            <span style="font-size: 0.7em; opacity: 0.6; min-width: 45px; color:var(--text);">⏱️ ${s.duration || 25}m</span>
            <button class="btn-mini" onclick="window.removeModalStep(${i})" style="color:var(--danger); opacity:0.6; background:transparent; border:none; cursor:pointer; font-size:1rem;">✕</button>
        </div>`;
    }).join('');
    initIcons();
};

// ==================== BATCH JSON IMPORT ====================
window.toggleJsonImport = () => {
    const container = $('json-import-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
};

window.processJsonImport = () => {
    let input = $('json-import-input').value.trim();
    if (!input) return;

    let stepsToProcess = [];

    try {
        // --- MÉTODO 1: JSON ESTÁNDAR ---
        let cleanInput = input.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIdx = cleanInput.indexOf('[');
        const endIdx = cleanInput.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            cleanInput = cleanInput.substring(startIdx, endIdx + 1);
        }
        cleanInput = cleanInput.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
        cleanInput = cleanInput.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

        const data = JSON.parse(cleanInput);
        stepsToProcess = Array.isArray(data) ? data : (data.steps || []);

    } catch (e) {
        console.warn("JSON.parse falló, usando Extractor de Emergencia (Regex)...");
        
        // --- MÉTODO 2: EXTRACTOR DE EMERGENCIA (REGEX) ---
        // Busca cualquier cosa que parezca "text": "Título" o "title": "Título"
        const regex = /"(?:text|title|name)"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(input)) !== null) {
            stepsToProcess.push({ text: match[1] });
        }
    }

    if (stepsToProcess.length > 0) {
        stepsToProcess.forEach(item => {
            let stepText = "";
            
            // Si es el formato detallado de HansBiomed
            if (item.Objetivo && item["Línea Estratégica"]) {
                const fecha = item.Fecha && item.Fecha !== "Por definir" ? `[${item.Fecha.split('/')[0]}/${item.Fecha.split('/')[1]}] ` : "";
                const formato = item.Formato ? `${item.Formato.split('.')[1] || item.Formato} - ` : "";
                stepText = `${fecha}${formato}${item["Línea Estratégica"]}: ${item.Objetivo}`;
            } else {
                // Fallback a formatos simples
                stepText = typeof item === 'string' ? item : (item.text || item.title || item.name || "Paso");
            }

            // 1. EL TÍTULO (Encabezado)
            currentStepsInModal.push({
                id: Math.random().toString(36).substr(2, 9),
                text: `📌 ${stepText}`,
                done: false,
                isHeader: true
            });

            // 2. ACCIÓN: CREAR
            currentStepsInModal.push({
                id: Math.random().toString(36).substr(2, 9),
                text: `🎨 Crear`,
                done: false,
                assignee: item.assignee || "Ambos",
                duration: 30
            });

            // 3. ACCIÓN: PUBLICAR
            currentStepsInModal.push({
                id: Math.random().toString(36).substr(2, 9),
                text: `🚀 Publicar`,
                done: false,
                assignee: "Tati",
                duration: 5
            });
        });

        renderModalSteps();
        $('json-import-input').value = '';
        $('json-import-container').style.display = 'none';
        showToast(`✅ ¡${stepsToProcess.length} pasos rescatados con éxito!`);
    } else {
        alert("No pude encontrar ninguna lista de tareas. Asegúrate de que el texto contenga el formato [ { 'text': '...' } ]");
    }
};

function updateProgressDashboard(tasks) {
    const dashboard = $('progress-dashboard');
    if (!dashboard) return;

    const activeTasks = tasks ? tasks.filter(t => t.status !== 'frozen') : [];
    const completedTasks = activeTasks.filter(t => t.status === 'done');
    const total = activeTasks.length;
    const completedCount = completedTasks.length;
    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // Si no hay tareas, mostramos un mensaje de bienvenida
    if (total === 0) {
        dashboard.innerHTML = `
            <div class="progress-message" style="text-align: center; font-style: normal; opacity: 0.8;">
                ✨ <strong>¡Tablero despejado!</strong> Agrega un proyecto para empezar a medir tu éxito hoy.
            </div>
        `;
        return;
    }

    let message = "";
    if (percent === 0) message = "¡Día de conquista! El primer paso es el más valiente. 🚀";
    else if (percent <= 30) message = "Buen ritmo, Pipe. Cada pieza cuenta para el gran puzzle. 💪";
    else if (percent <= 60) message = "¡Ecuación perfecta! Ya cruzaste el ecuador del éxito. 🔋";
    else if (percent <= 90) message = "¡Viento en popa! El hiperfoco está dando sus frutos. 🔥";
    else if (percent === 100) message = "<strong>🏆 ¡LEYENDA!</strong> Has limpiado el tablero. Tiempo de celebrar. ✨";

    dashboard.innerHTML = `
        <div class="progress-header">
            <div class="progress-title">Progreso del Día</div>
            <div class="progress-stats"><span style="color: var(--primary); font-size: 1.2rem;">${completedCount}</span> / ${total} <small style="opacity: 0.6; font-weight: 400;">proyectos</small></div>
        </div>
        <div class="progress-bar-container" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border);">
            <div class="progress-bar-fill" style="width: ${percent}%"></div>
        </div>
        <div class="progress-message" style="color: var(--text);">${message} <span style="float: right; opacity: 0.7; font-weight: 700;">${percent}%</span></div>
    `;
}

// ==================== INIT ====================
if (Notification.permission === 'default') Notification.requestPermission();
fetchTasks(); updateDisplay(); renderRoutines(); renderPlanner(); loadStats(); initIcons();
