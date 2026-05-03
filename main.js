import { createClient } from '@supabase/supabase-js';
import { createIcons, Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X } from 'lucide';

const supabase = createClient('https://blwaxxacneipoaufpiag.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU');
const N8N_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/pomodoro-sync';

// ==================== STATE ====================
let timeLeft = 25 * 60, timerId = null, currentMode = 'pomodoro', pomodoroStartTime = null;
let selectedTaskId = null, selectedTaskTitle = "Sesión de Trabajo", currentStepsInModal = [];
let currentSessionId = null, taskToSchedule = null, allTasks = [];
let sessionsCompleted = 0; // Para el descanso largo cada 4
let currentEnergyFilter = 'all';
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
const viewBtns = document.querySelectorAll('.nav-btn, .tab-btn');
const views = document.querySelectorAll('.view');

const initIcons = () => createIcons({ icons: { Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X } });

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
    timeLeft--;
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

      syncCalendar('free');
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
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (!data) return;
  allTasks = data;
  
  let filteredTasks = data;
  
  // Filter by Frozen status
  if (showFrozen) {
      filteredTasks = data.filter(t => t.status === 'frozen');
  } else {
      filteredTasks = data.filter(t => t.status !== 'frozen');
  }

  // Filter by Energy
  if (currentEnergyFilter !== 'all') {
      filteredTasks = filteredTasks.filter(t => (t.energy_level || 'medium') === currentEnergyFilter);
  }

  taskList.innerHTML = filteredTasks.map(task => {
    const steps = task.steps || [], done = steps.filter(s=>s.done).length;
    const prog = steps.length ? (done/steps.length)*100 : (task.status==='done'?100:0);
    const stale = staleDays(task);
    const staleClass = (task.status !== 'done' && task.status !== 'frozen') ? (stale >= 5 ? 'stale-danger' : stale >= 2 ? 'stale-warning' : '') : '';
    const sel = selectedTaskId === task.id ? 'selected' : '';
    
    // Energy Tag
    const eLvl = task.energy_level || 'medium';
    let energyTag = '';
    if(eLvl === 'high') energyTag = '<span class="energy-tag high">⚡ Alta</span>';
    if(eLvl === 'medium') energyTag = '<span class="energy-tag medium">🔋 Media</span>';
    if(eLvl === 'low') energyTag = '<span class="energy-tag low">🪫 Baja</span>';

    return `<div class="task-card ${task.status==='done'?'done':''} ${task.status==='frozen'?'frozen':''} ${staleClass} ${sel}" data-id="${task.id}" data-title="${task.title}">
      <div style="width:100%">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="task-info"><h4>${task.title} ${energyTag}</h4><p>${task.description||''}</p>
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
            <button class="btn-mini" onclick="event.stopPropagation();window.openSchedule('${task.title.replace(/'/g,"\\'")}')" title="Agendar"><i data-lucide="calendar"></i></button>
            ${stale >= 2 && task.status !== 'done' && task.status !== 'frozen' ? `<button class="btn-mini" onclick="event.stopPropagation();window.reschedule('${task.id}','${task.title.replace(/'/g,"\\'")}')">📅</button>` : ''}
            <button class="task-check" onclick="event.stopPropagation();window.toggleTask('${task.id}','${task.status}')"><i data-lucide="${task.status==='done'?'check':'circle'}"></i></button>
          </div>
        </div>
        ${steps.length ? `<div class="progress-bar-container"><div class="progress-bar-fill" style="width:${prog}%"></div></div>
          <div class="steps-container">${steps.map((s,i)=>`<div class="step-item ${s.done?'done':''}">
            <div class="action-btns">
              <button class="btn-mini" onclick="event.stopPropagation();window.focusStep('${task.id}','${task.title.replace(/'/g,"\\'")+': '+s.text.replace(/'/g,"\\'")}')"><i data-lucide="play" style="width:12px"></i></button>
              <button class="btn-mini" onclick="event.stopPropagation();window.openSchedule('${(task.title+': '+s.text).replace(/'/g,"\\'")}')"><i data-lucide="calendar" style="width:12px"></i></button>
            </div>
            <span onclick="event.stopPropagation();window.toggleStep('${task.id}',${i})">${s.text}</span>
          </div>`).join('')}</div>` : ''}
      </div></div>`;
  }).join('') || `<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay tareas en esta vista.</p>`;
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
window.reschedule = (id, title) => { window.openSchedule(title); };

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

// ==================== MODALS ====================
$('add-task-btn').onclick = () => { 
    currentStepsInModal = []; 
    $('modal-steps-list').innerHTML = ''; 
    $('new-task-title').value = ''; 
    $('new-task-desc').value = ''; 
    $('new-task-energy').value = 'medium';
    $('task-modal').style.display = 'flex'; 
};

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

window.sliceWithAI = () => {
    const title = $('new-task-title').value;
    if(!title) return showToast("Escribe primero el nombre del proyecto para rebanarlo");
    
    showToast("🔪 IA Rebanando: " + title);
    
    // Simulación de "slicing" lógico basado en el título
    const steps = ["Investigación inicial 🧠", "Boceto de estructura 📝", "Implementación base 🛠️", "Pulido y detalles ✨"];
    
    currentStepsInModal = steps.map(s => ({text: s, done: false}));
    $('modal-steps-list').innerHTML = currentStepsInModal.map(s=>`<div class="step-item"><i data-lucide="circle" style="width:12px"></i> ${s.text}</div>`).join('');
    initIcons();
};

$('close-modal').onclick = () => $('task-modal').style.display = 'none';
$('add-step-to-list').onclick = () => {
  const v = $('step-input').value; if(!v) return;
  currentStepsInModal.push({text:v,done:false}); $('step-input').value = '';
  $('modal-steps-list').innerHTML = currentStepsInModal.map(s=>`<div class="step-item"><i data-lucide="circle" style="width:12px"></i> ${s.text}</div>`).join('');
  initIcons();
};
$('save-task').onclick = async () => {
  const title = $('new-task-title').value; if(!title) return;
  const energy = $('new-task-energy').value;
  await supabase.from('tasks').insert([{ title, description: $('new-task-desc').value, energy_level: energy, status: 'todo', steps: currentStepsInModal }]);
  $('task-modal').style.display = 'none'; fetchTasks();
};

window.openSchedule = (title) => {
  taskToSchedule = title; $('schedule-task-name').textContent = title;
  const now = new Date(); now.setMinutes(now.getMinutes()+5);
  $('schedule-time').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('schedule-modal').style.display = 'flex';
};
$('confirm-schedule').onclick = async () => {
  const t = $('schedule-time').value; if(!t) return;
  const start = new Date(t), end = new Date(start.getTime()+25*60000);
  selectedTaskTitle = taskToSchedule;
  await syncCalendar('scheduled', start.toISOString(), end.toISOString());
  $('schedule-modal').style.display = 'none';
  showToast("📅 ¡Agendado! Tu teléfono te avisará.");
};
$('close-schedule-modal').onclick = () => $('schedule-modal').style.display = 'none';

// ==================== ROUTINES ====================
const routines = JSON.parse(localStorage.getItem('axon_routines') || '[]');

function renderRoutines() {
  const dayLabels = ['D','L','M','X','J','V','S'];
  $('routines-list').innerHTML = routines.map(r => `<div class="routine-chip">
    <span>${r.emoji} ${r.name}</span>
    <span class="routine-chip-days">${r.days.map(d => dayLabels[d]).join('')} ${r.time} (${r.duration}min)</span>
    <button class="routine-chip-remove" onclick="window.removeRoutine('${r.id}')">✕</button>
  </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.8rem">Aún no tienes rutinas. ¡Agrega tus pilares!</p>';
}

$('add-routine-btn').onclick = () => {
  $('routine-name').value = ''; $('routine-time').value = '06:00'; $('routine-duration').value = '60';
  document.querySelectorAll('.day-check input').forEach(cb => cb.checked = false);
  $('routine-modal').style.display = 'flex';
};
$('close-routine-modal').onclick = () => $('routine-modal').style.display = 'none';

$('save-routine').onclick = () => {
  const name = $('routine-name').value; if (!name) return;
  const emoji = $('routine-emoji').value;
  const days = [...document.querySelectorAll('.day-check input:checked')].map(cb => parseInt(cb.value));
  if (!days.length) { showToast("⚠️ Selecciona al menos un día"); return; }
  const time = $('routine-time').value, duration = parseInt($('routine-duration').value) || 60;
  routines.push({ id: Date.now().toString(), name, emoji, days, time, duration });
  localStorage.setItem('axon_routines', JSON.stringify(routines));
  $('routine-modal').style.display = 'none';
  renderRoutines(); renderPlanner();
  showToast(`🔒 Rutina "${name}" creada. ¡Es inamovible!`);
};

window.removeRoutine = (id) => {
  const idx = routines.findIndex(r => r.id === id);
  if (idx > -1) { routines.splice(idx, 1); localStorage.setItem('axon_routines', JSON.stringify(routines)); renderRoutines(); renderPlanner(); }
};

// ==================== WEEKLY PLANNER ====================
function getWeekDays() {
  const today = new Date();
  const day = today.getDay();
  // Si hoy es domingo (0), la semana a planificar empieza mañana lunes (+1).
  // Si es otro día, empieza el lunes de esta semana.
  const diff = today.getDate() - day + (day === 0 ? 1 : 1);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(diff+i); return d;
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
    const workBlocks = weekPlan.filter(b => b.day === dateStr);
    const allBlocks = [...routineBlocks, ...workBlocks].sort((a,b) => a.time.localeCompare(b.time));
    const isToday = d.toDateString() === today;
    return `<div class="day-column">
      <div class="day-header">
        <span class="day-name ${isToday?'day-today':''}">${dayNames[i]} ${isToday?'(Hoy)':''}</span>
        <span class="day-date">${d.getDate()}/${d.getMonth()+1}</span>
        <button class="day-add-btn" onclick="window.addPlanBlock('${dateStr}','${dayNames[i]} ${d.getDate()}/${d.getMonth()+1}')">+ Bloque</button>
      </div>
      <div class="plan-blocks">${allBlocks.map(b => `<div class="plan-block ${b.isRoutine?'routine':''} ${b.synced?'synced':''}">
        <div class="plan-block-info"><span class="plan-block-time">${b.time}</span><span class="plan-block-title">${b.taskTitle}${b.duration && b.duration !== 25 ? ` (${b.duration}min)`:''}</span></div>
        ${b.isRoutine ? '<span class="plan-block-lock">🔒</span>' : b.synced ? '<span class="plan-block-synced-icon">✓</span>' : `<button class="plan-block-remove" onclick="window.removePlanBlock('${b.id}')">✕</button>`}
      </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem 0">Sin bloques</p>'}</div>
    </div>`;
  }).join('');
}

window.addPlanBlock = (dateStr, label) => {
  $('plan-block-day-label').textContent = label;
  const sel = $('plan-task-select');
  sel.innerHTML = allTasks.filter(t=>t.status!=='done').map(t => {
    const opts = [`<option value="${t.title}">${t.title}</option>`];
    (t.steps||[]).filter(s=>!s.done).forEach(s => opts.push(`<option value="${t.title}: ${s.text}">↳ ${s.text}</option>`));
    return opts.join('');
  }).join('');
  $('plan-block-time').value = '09:00';
  $('plan-block-modal').style.display = 'flex';
  $('save-plan-block').onclick = () => {
    const title = sel.value, time = $('plan-block-time').value;
    if(!title||!time) return;
    weekPlan.push({ id: Date.now().toString(), day: dateStr, time, taskTitle: title, synced: false });
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

$('sync-all-btn').onclick = async () => {
  // Gather work blocks + routine blocks for the week
  const days = getWeekDays();
  const allRoutineBlocks = days.flatMap(d => getRoutineBlocksForDay(d).map(b => ({...b, day: d.toISOString().slice(0,10)})));
  const unsyncedWork = weekPlan.filter(b => !b.synced);
  // Only sync routines that haven't been synced this session
  const syncedRoutineIds = JSON.parse(sessionStorage.getItem('synced_routines') || '[]');
  const unsyncedRoutines = allRoutineBlocks.filter(b => !syncedRoutineIds.includes(b.id));
  const allUnsunced = [...unsyncedWork, ...unsyncedRoutines];

  if (!allUnsunced.length) { showToast("✅ Todo ya está sincronizado"); return; }
  calStatus.textContent = 'Syncing...';
  let count = 0;
  for (const block of allUnsunced) {
    const start = new Date(`${block.day}T${block.time}:00`);
    const dur = block.duration || 25;
    const end = new Date(start.getTime() + dur*60000);
    const url = new URL(N8N_URL);
    url.searchParams.append('startTime', start.toISOString());
    url.searchParams.append('endTime', end.toISOString());
    url.searchParams.append('taskId', block.taskTitle);
    try {
      await fetch(url.toString(), { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ taskId: block.taskTitle, status:'scheduled', startTime: start.toISOString(), endTime: end.toISOString() })
      });
      if (block.isRoutine) syncedRoutineIds.push(block.id);
      else block.synced = true;
      count++;
    } catch(e) {}
  }
  localStorage.setItem('axon_week_plan', JSON.stringify(weekPlan));
  sessionStorage.setItem('synced_routines', JSON.stringify(syncedRoutineIds));
  calStatus.textContent = 'All Synced!';
  renderPlanner();
  fireConfetti();
  showToast(`📅 ¡${count} bloques subidos a Calendar!`);
};

// ==================== AXON MIND (VAULT & INBOX) ====================
let inboxDocs = JSON.parse(localStorage.getItem('axon_inbox_docs') || '[]');
let vaultDocs = JSON.parse(localStorage.getItem('axon_vault_docs') || '[]');

window.openQuickCapture = () => {
  quickCaptureModal.style.display = 'flex';
  setTimeout(() => $('inbox-content').focus(), 100);
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
  $('new-task-title').value = doc.title;
  $('new-task-desc').value = doc.content || '';
  taskModal.style.display = 'flex';
  showToast("Pre-cargado desde el Vault");
};

// ==================== STATS ====================
async function loadStats() {
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

// ==================== INIT ====================
if (Notification.permission === 'default') Notification.requestPermission();
fetchTasks(); updateDisplay(); renderRoutines(); renderPlanner(); loadStats(); initIcons();
