// ==================== AXON MIND — ORCHESTRATOR ====================
import {
  supabase, N8N_URL, ARCHITECT_URL, SLICER_URL, POLYGLOT_TRANSLATE_URL, FINANCE_ASSISTANT_URL,
  modes, weekPlan, ALARM_CONFIG, motivations,
  SRS_INTERVALS, MAX_SRS_LEVEL, SRS_XP, POLYMATH_LEVELS,
  POLYGLOT_LANGUAGES, POLYGLOT_LANG_IDS, POLYGLOT_ALPHABETS,
  capitalizeFirstLetter, linkify, escHtml, formatCurrency, formatCurrencyUSD, fmtMoney,
  setTheme, initIcons, showToast, showNotification, ensureNotificationPermission,
  playSound, fireConfetti, requestWakeLock, releaseWakeLock,
  saveTimerState, clearTimerState
} from './src/db.js';

import { initTimer } from './src/modules/timer.js';
import { initTasks } from './src/modules/tasks.js';
import { initCards } from './src/modules/cards.js';
import { initFinance } from './src/modules/finance.js';
import { initPolyglot } from './src/modules/polyglot.js';
import { initPlanner } from './src/modules/planner.js';
import { initVault } from './src/modules/vault.js';
import { initJournal } from './src/modules/journal.js';
import { initWater } from './src/modules/water.js';
import { initCareer } from './src/modules/career.js';
import { initStoryboarder } from './src/modules/storyboarder/storyboarder.js';

import { initGuitarModule } from './src/guitar.js';
import './src/inspirations.js';
import './src/mediavault.js';

// ==================== INITIALIZE GLOBAL STATE ON WINDOW ====================
window.timeLeft = 25 * 60;
window.timerId = null;
window.currentMode = 'pomodoro';
window.pomodoroStartTime = null;
window.pomodoroEndTime = null;
window.selectedTaskId = null;
window.selectedTaskTitle = "Sesión de Trabajo";
window.currentStepsInModal = [];
window.currentSessionId = null;
window.taskToSchedule = null;
window.allTasks = [];
window.vaultDocs = [];
window.inboxDocs = [];
window.vaultDocToConvert = null;
window.inboxDocToConvert = null;
window.sessionsCompleted = 0;
window.currentEnergyFilter = 'all';
window.currentAssigneeFilter = 'all';
window.interrogation = { round: 0, idea: '', projectTitle: '', questions: [], allAnswers: [] };
window.showFrozen = false;
window.wakeLock = null;
window.weekPlan = weekPlan;
window.modes = modes;

// Re-bind helper function
window.$ = id => document.getElementById(id);
const $ = window.$;

// ==================== INITIALIZE DOM ELEMENT GLOBALS ====================
window.minutesEl = $('timer-minutes');
window.secondsEl = $('timer-seconds');
window.invisibleTimerBar = $('invisible-timer-bar');
window.progressCircle = document.querySelector('.progress-ring__circle');
window.startBtn = $('start-btn');
window.pauseBtn = $('pause-btn');
window.resetBtn = $('reset-btn');
window.taskList = $('task-list');
window.calStatus = $('calendar-status');
window.activeTaskEmoji = $('active-task-emoji');
window.activeTaskTitle = $('active-task-title');
window.activeTaskStatus = $('active-task-status');
window.sessionDots = $('session-dots');
window.taskModal = $('task-modal');
window.vaultModal = $('vault-modal');

// ==================== INITIALIZE MODULES ====================
initTimer();
initCards();

const financeMod = initFinance();
window.fetchFinanceData = financeMod.fetchFinanceData;

const polyglotMod = initPolyglot();
window.fetchPolyglotData = polyglotMod.fetchPolyglotData;

const plannerMod = initPlanner();
window.renderRoutines = plannerMod.renderRoutines;
window.renderPlanner = plannerMod.renderPlanner;
window.loadGCal = plannerMod.loadGCal;

window.initCareer = initCareer;
initCareer();

window.initGuitarModule = initGuitarModule;
initGuitarModule();

initTasks({
  fetchInbox: () => window.fetchInbox?.(),
  fetchVaultDocs: () => window.fetchVaultDocs?.(),
  renderVault: () => window.renderVault?.(),
  renderInbox: () => window.renderInbox?.(),
  startTimer: () => window.startTimer?.()
});

initVault({
  fetchTasks: () => window.fetchTasks?.(),
  renderRoutines: () => window.renderRoutines?.(),
  renderPlanner: () => window.renderPlanner?.()
});

initJournal({
  showMultipotentialSummary: () => window.showMultipotentialSummary?.()
});

const waterModule = initWater();

// ==================== TAB ROUTING ====================
const viewBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');
const dropdown = $('sb-nav-dropdown');
const dropdownTrigger = $('sb-dropdown-trigger');

viewBtns.forEach(btn => {
  btn.onclick = () => {
    const viewId = btn.getAttribute('data-view');
    viewBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));

    btn.classList.add('active');
    const targetView = $('view-' + viewId);
    if (targetView) targetView.classList.add('active');

    // Manejo del texto y estado activo del botón "Más..."
    const isInsideDropdown = btn.closest('.dropdown-content') !== null;
    if (isInsideDropdown && dropdownTrigger) {
      const textNoBadge = btn.innerText.replace(/\s\d+$/, '').trim();
      dropdownTrigger.querySelector('span').textContent = 'Más: ' + textNoBadge;
      dropdownTrigger.classList.add('active');
      if (dropdown) dropdown.classList.remove('open');
    } else if (dropdownTrigger) {
      dropdownTrigger.querySelector('span').textContent = 'Más';
      dropdownTrigger.classList.remove('active');
    }

    if (viewId === 'stats') { if (window.loadStats) window.loadStats(); }
    if (viewId === 'cards') { if (window.loadCards) window.loadCards(); }
    if (viewId === 'inbox') { if (window.fetchInbox) window.fetchInbox(); }
    if (viewId === 'vault') { if (window.fetchVaultDocs) window.fetchVaultDocs(); }
    if (viewId === 'plan') {
      if (window.renderRoutines) window.renderRoutines();
      if (window.renderPlanner) window.renderPlanner();
      if (window.loadGCal) window.loadGCal();
    }
    if (viewId === 'finances') { if (window.fetchFinanceData) window.fetchFinanceData(); }
    if (viewId === 'polyglot') { if (window.fetchPolyglotData) window.fetchPolyglotData(); }
    if (viewId === 'guitar') { if (window.initGuitarModule) window.initGuitarModule(); }
    if (viewId === 'discover') { if (window.fetchDiscoverData) window.fetchDiscoverData(); }
    if (viewId === 'trabajo') { if (window.initCareer) window.initCareer(); }
    if (viewId === 'storyboarder') { initStoryboarder(); }
  };
});

window.goToStoryboarder = (projectName) => {
  const btn = document.querySelector('.tab-btn[data-view="storyboarder"]');
  if (btn) {
    btn.click();
  }
  if (window.selectStoryboardProject) {
    window.selectStoryboardProject(projectName);
  }
};

// Eventos para abrir/cerrar el dropdown de navegación
if (dropdownTrigger && dropdown) {
  dropdownTrigger.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  };
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });
}

// ==================== GLOBAL AUTO-CAPITALIZATION ====================
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const type = el.type ? el.type.toLowerCase() : '';
    if (type === 'password' || type === 'email' || type === 'url' || el.dataset.noCap === 'true') return;
    
    const val = el.value;
    if (val.length > 0 && val[0] !== val[0].toUpperCase()) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = val.charAt(0).toUpperCase() + val.slice(1);
      if (el.setSelectionRange) {
        el.setSelectionRange(start, end);
      }
    }
  }
});

// ==================== SCROLL TO HIDE FAB ====================
let lastScrollY = window.scrollY || document.documentElement.scrollTop;
const fabContainer = document.querySelector('.fab-container');

window.addEventListener('scroll', () => {
    if (window.innerWidth > 1024) {
        fabContainer?.classList.remove('fab-hidden');
        return;
    }
    
    const currentScrollY = window.scrollY || document.documentElement.scrollTop;
    
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        fabContainer?.classList.add('fab-hidden');
    } else if (currentScrollY < lastScrollY) {
        fabContainer?.classList.remove('fab-hidden');
    }
    lastScrollY = currentScrollY;
}, { passive: true });

// ==================== POLYGLOT PROACTIVE REMINDERS ====================
async function checkPolyglotReminders() {
    const lastReminder = localStorage.getItem('axon_last_polyglot_reminder');
    const now = new Date();
    if (lastReminder && (now - new Date(lastReminder)) < 6 * 3600 * 1000) {
        return;
    }

    const studyModal = document.getElementById('polyglot-study-modal');
    if (studyModal && studyModal.style.display === 'flex') return;

    const queryTime = new Date(now.getTime() + 30000).toISOString(); 

    const { data: entries, error } = await supabase
        .from('polyglot_entries')
        .select('next_review')
        .lt('srs_level', 6)
        .lte('next_review', queryTime);

    if (error) {
        console.error('❌ Error checking reminders:', error);
        return;
    }

    if (entries && entries.length > 0) {
        console.log(`🔔 Found ${entries.length} pending reviews. Triggering notification...`);
        const granted = await ensureNotificationPermission();
        if (granted) {
            showNotification('🌍 Axon Polyglot', `Tienes ${entries.length} repasos de idiomas pendientes. ¡Es hora de practicar! 🧠`);
            localStorage.setItem('axon_last_polyglot_reminder', now.toISOString());
        }
    }
}

// ==================== DOMContentLoaded INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    if (window.renderRoutines) window.renderRoutines();
    if (window.renderPlanner) window.renderPlanner();
    
    // Restore study reminder
    const savedHour = localStorage.getItem('axon_reminder_hour');
    const savedMinute = localStorage.getItem('axon_reminder_minute');
    if (savedHour && savedMinute) {
        if (window.scheduleStudyReminder) window.scheduleStudyReminder(parseInt(savedHour), parseInt(savedMinute));
    } else {
        if (window.scheduleStudyReminder) window.scheduleStudyReminder(10, 0); // Default: 10am
    }
    
    setTimeout(() => {
        if (window.fetchInbox) window.fetchInbox();
        if (window.fetchTasks) window.fetchTasks();
        if (window.loadCards) window.loadCards();
        initStoryboarder();
        initIcons();
        
        // Request notification permission on load
        if (window.requestNotificationPermission) window.requestNotificationPermission();
        
        // Reset water daily
        if (waterModule) {
            window.waterTotal = waterModule.migrateWaterKey(waterModule.waterProfile);
            waterModule.updateWaterDisplay();
        }
        if (window.fetchWaterFromSupabase) window.fetchWaterFromSupabase();
        
        // Restore timer if it was running (mobile background / page reload)
        if (window.restoreTimerState) {
            const restored = window.restoreTimerState();
            if (restored) {
                showToast('⏱️ Pomodoro restaurado');
            }
        }
        
        if (window.fetchDolarValue) {
            window.fetchDolarValue();
            setInterval(window.fetchDolarValue, 300000); // 5 minutes
        }
        
        // Polyglot proactive reminders
        checkPolyglotReminders();
        setInterval(checkPolyglotReminders, 60000); // Check every 1 min for better precision
        
        // Also check whenever the user returns to the app
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkPolyglotReminders();
            }
        });
    }, 1000);
});

// ==================== GLOBAL SEARCH (Ctrl+K) ====================
let _gsearchActiveIndex = -1;
let _gsearchItems = [];

window.openGlobalSearch = () => {
    const modal = document.getElementById('global-search-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    _gsearchActiveIndex = -1;
    _gsearchItems = [];

    const resultsEl = document.getElementById('gsearch-results');
    if (resultsEl) {
        resultsEl.innerHTML = `
            <div class="gsearch-empty-state">
                <div class="gsearch-empty-icon">🔍</div>
                <p>Escribe para buscar en toda tu app</p>
                <div class="gsearch-hints">
                    <span>📋 <b>Tareas</b></span>
                    <span>🔁 <b>Rutinas</b></span>
                    <span>📅 <b>Planificación</b></span>
                    <span>📚 <b>Vault</b></span>
                </div>
            </div>`;
    }

    const input = document.getElementById('gsearch-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
        input.oninput = () => _gsearchRun(input.value.trim());
        input.onkeydown = _gsearchHandleKey;
    }

    if (window.lucide) window.lucide.createIcons();
};

window.closeGlobalSearch = (e) => {
    if (e && e.target !== document.getElementById('global-search-modal')) return;
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const modal = document.getElementById('global-search-modal');
        if (modal && modal.style.display !== 'none') {
            modal.style.display = 'none';
        } else {
            window.openGlobalSearch();
        }
    }
    if (e.key === 'Escape') {
        const modal = document.getElementById('global-search-modal');
        if (modal && modal.style.display !== 'none') {
            modal.style.display = 'none';
        }
    }
});

function _gsearchHighlight(text, query) {
    if (!query) return escHtml(text);
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escHtml(text).replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>');
}

function _gsearchRun(query) {
    const resultsEl = document.getElementById('gsearch-results');
    if (!resultsEl) return;

    if (!query) {
        resultsEl.innerHTML = `
            <div class="gsearch-empty-state">
                <div class="gsearch-empty-icon">🔍</div>
                <p>Escribe para buscar en toda tu app</p>
                <div class="gsearch-hints">
                    <span>📋 <b>Tareas</b></span>
                    <span>🔁 <b>Rutinas</b></span>
                    <span>📅 <b>Planificación</b></span>
                    <span>📚 <b>Vault</b></span>
                </div>
            </div>`;
        _gsearchItems = [];
        _gsearchActiveIndex = -1;
        return;
    }

    const q = query.toLowerCase();
    let html = '';
    _gsearchItems = [];

    // Tareas
    const taskMatches = (window.allTasks || []).filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.steps || []).some(s => (s.text || '').toLowerCase().includes(q))
    ).slice(0, 8);

    if (taskMatches.length > 0) {
        html += `<div class="gsearch-category">📋 Tareas</div>`;
        taskMatches.forEach(t => {
            const matchingStep = (t.steps || []).find(s => (s.text || '').toLowerCase().includes(q));
            const subtitle = matchingStep
                ? `↳ Paso: ${matchingStep.text}`
                : (t.description || '');
            const idx = _gsearchItems.length;
            const safeTitle = (t.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const isDone = t.status === 'done';
            const hasSteps = (t.steps || []).filter(s => !s.isHeader).length > 0;
            _gsearchItems.push({ type: 'task', id: t.id, status: t.status, title: t.title });

            const stepsHtml = hasSteps ? (() => {
                const actionSteps = (t.steps || []).filter(s => !s.isHeader);
                return actionSteps.map((s, realIdx) => {
                    const fullIdx = t.steps.indexOf(s);
                    const stepSafeTitle = `${t.title}: ${s.text}`.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `<div class="gsearch-step-row ${s.scheduled ? 'scheduled' : ''}">
                        <span class="gsearch-step-dot ${s.done ? 'done' : ''}"></span>
                        <span class="gsearch-step-text">${escHtml(s.text || '')}</span>
                        ${s.scheduled ? '<span class="gsearch-step-chip">📅 Agendado</span>' : ''}
                        <button class="gsearch-step-cal-btn"
                            title="Agendar este paso"
                            onclick="event.stopPropagation();window._gsearchScheduleStep('${t.id}', ${fullIdx}, '${stepSafeTitle}', ${s.duration || t.duration || 25})">
                            📅
                        </button>
                    </div>`;
                }).join('');
            })() : '';

            html += `
                <div class="gsearch-item" data-idx="${idx}" data-task-id="${t.id}">
                    <div class="gsearch-item-icon">${isDone ? '✅' : t.status === 'frozen' ? '❄️' : '📋'}</div>
                    <div class="gsearch-item-body" onclick="window._gsearchGo(${idx})" style="cursor:pointer">
                        <div class="gsearch-item-title">${_gsearchHighlight(t.title || 'Sin título', query)}</div>
                        ${subtitle ? `<div class="gsearch-item-subtitle">${_gsearchHighlight(subtitle.slice(0, 80), query)}</div>` : ''}
                    </div>
                    <div class="gsearch-actions" onclick="event.stopPropagation()">
                        <button class="gsearch-action-btn ${isDone ? 'done' : ''}"
                            title="${isDone ? 'Marcar pendiente' : 'Completar'}"
                            onclick="window._gsearchDoToggle('${t.id}','${t.status}')">
                            ${isDone ? '↩' : '✅'}
                        </button>
                        <button class="gsearch-action-btn" title="Editar"
                            onclick="window._gsearchDoEdit('${t.id}')">
                            ✏️
                        </button>
                        <button class="gsearch-action-btn" title="${hasSteps ? 'Ver pasos para agendar' : 'Agendar tarea'}"
                            onclick="${hasSteps
                                ? `window._gsearchToggleSteps('${t.id}')`
                                : `window._gsearchScheduleStep('${t.id}', null, '${safeTitle}', ${t.duration || 25})`
                            }">
                            📅
                        </button>
                    </div>
                </div>
                ${hasSteps ? `<div class="gsearch-step-picker" id="gsearch-steps-${t.id}" style="display:none">
                    <div class="gsearch-step-picker-label">Elige el paso a agendar:</div>
                    ${stepsHtml}
                    <div class="gsearch-step-row gsearch-step-whole">
                        <span class="gsearch-step-dot"></span>
                        <span class="gsearch-step-text" style="font-style:italic">Toda la tarea</span>
                        <button class="gsearch-step-cal-btn"
                            onclick="event.stopPropagation();window._gsearchScheduleStep('${t.id}', null, '${safeTitle}', ${t.duration || 25})">
                            📅
                        </button>
                    </div>
                </div>` : ''}`;
        });
    }

    // Rutinas
    const routineMatches = (window.routines || []).filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
    ).slice(0, 5);

    if (routineMatches.length > 0) {
        if (taskMatches.length > 0) html += `<div class="gsearch-divider"></div>`;
        html += `<div class="gsearch-category">🔁 Rutinas</div>`;
        routineMatches.forEach(r => {
            const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const dayLabels = (r.days || []).map(d => days[d]).join(', ');
            const idx = _gsearchItems.length;
            _gsearchItems.push({ type: 'routine' });
            html += `
                <div class="gsearch-item" data-idx="${idx}" onclick="window._gsearchGo(${idx})">
                    <div class="gsearch-item-icon">${r.emoji || '🔁'}</div>
                    <div class="gsearch-item-body">
                        <div class="gsearch-item-title">${_gsearchHighlight(r.name || 'Rutina', query)}</div>
                        <div class="gsearch-item-subtitle">${r.time || ''} · ${dayLabels}</div>
                    </div>
                    <span class="gsearch-item-badge">${r.duration || 30} min</span>
                </div>`;
        });
    }

    // Planificación Semanal
    const planMatches = (window.weekPlan || []).filter(b =>
        (b.taskTitle || '').toLowerCase().includes(q)
    ).slice(0, 5);

    if (planMatches.length > 0) {
        if (taskMatches.length > 0 || routineMatches.length > 0) html += `<div class="gsearch-divider"></div>`;
        html += `<div class="gsearch-category">📅 Planificación</div>`;
        planMatches.forEach(b => {
            const idx = _gsearchItems.length;
            _gsearchItems.push({ type: 'plan' });
            html += `
                <div class="gsearch-item" data-idx="${idx}" onclick="window._gsearchGo(${idx})">
                    <div class="gsearch-item-icon">📅</div>
                    <div class="gsearch-item-body">
                        <div class="gsearch-item-title">${_gsearchHighlight(b.taskTitle || 'Bloque', query)}</div>
                        <div class="gsearch-item-subtitle">${b.day || ''} · ${b.time || ''}</div>
                    </div>
                    ${b.synced ? '<span class="gsearch-item-badge done">Sync ✓</span>' : ''}
                </div>`;
        });
    }

    // Vault / Inbox
    const vaultAll = [...(window.vaultDocs || []), ...(window.inboxDocs || [])];
    const vaultMatches = vaultAll.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.content || '').toLowerCase().includes(q)
    ).slice(0, 4);

    if (vaultMatches.length > 0) {
        const hasPrev = taskMatches.length || routineMatches.length || planMatches.length;
        if (hasPrev) html += `<div class="gsearch-divider"></div>`;
        html += `<div class="gsearch-category">📚 Vault / Inbox</div>`;
        vaultMatches.forEach(d => {
            const idx = _gsearchItems.length;
            _gsearchItems.push({ type: 'vault', id: d.id });
            html += `
                <div class="gsearch-item" data-idx="${idx}" onclick="window._gsearchGo(${idx})">
                    <div class="gsearch-item-icon">${d.type === 'vault' ? '📚' : '⚡'}</div>
                    <div class="gsearch-item-body">
                        <div class="gsearch-item-title">${_gsearchHighlight(d.title || 'Documento', query)}</div>
                        <div class="gsearch-item-subtitle">${(d.content || '').slice(0, 80)}</div>
                    </div>
                </div>`;
        });
    }

    if (_gsearchItems.length === 0) {
        html = `<div class="gsearch-no-results">😶 Sin resultados para "<b>${escHtml(query)}</b>"</div>`;
    }

    resultsEl.innerHTML = html;
    _gsearchActiveIndex = -1;
}

window._gsearchDoToggle = (id, status) => {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
    setTimeout(() => window.toggleTask(id, status), 100);
};

window._gsearchDoEdit = (id) => {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
    const focusBtn = document.querySelector('.tab-btn[data-view="focus"]');
    if (focusBtn) focusBtn.click();
    setTimeout(() => window.editTask(id), 150);
};

window._gsearchToggleSteps = (taskId) => {
    const picker = document.getElementById(`gsearch-steps-${taskId}`);
    if (!picker) return;
    const isOpen = picker.style.display !== 'none';
    document.querySelectorAll('.gsearch-step-picker').forEach(p => p.style.display = 'none');
    picker.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window._gsearchScheduleStep = (taskId, stepIndex, title, duration) => {
    const resolvedTaskId = (stepIndex !== null && stepIndex !== undefined) ? taskId : null;
    const resolvedStepIndex = (stepIndex !== null && stepIndex !== undefined) ? stepIndex : null;

    const searchModal = document.getElementById('global-search-modal');
    if (searchModal) searchModal.style.display = 'none';

    window.openSchedule(title, duration || 25, resolvedTaskId, resolvedStepIndex);
};

function _gsearchHandleKey(e) {
    const items = document.querySelectorAll('#gsearch-results .gsearch-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        _gsearchActiveIndex = Math.min(_gsearchActiveIndex + 1, items.length - 1);
        _gsearchUpdateActive(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _gsearchActiveIndex = Math.max(_gsearchActiveIndex - 1, 0);
        _gsearchUpdateActive(items);
    } else if (e.key === 'Enter') {
        if (_gsearchActiveIndex >= 0 && _gsearchActiveIndex < _gsearchItems.length) {
            window._gsearchGo(_gsearchActiveIndex);
        }
    }
}

function _gsearchUpdateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === _gsearchActiveIndex));
    if (_gsearchActiveIndex >= 0 && items[_gsearchActiveIndex]) {
        items[_gsearchActiveIndex].scrollIntoView({ block: 'nearest' });
    }
}

window._gsearchGo = (idx) => {
    const item = _gsearchItems[idx];
    if (!item) return;

    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';

    if (item.type === 'task') {
        const focusBtn = document.querySelector('.tab-btn[data-view="focus"]');
        if (focusBtn) focusBtn.click();
        if (item.id) {
            setTimeout(() => {
                const taskEl = document.querySelector(`.task-card[data-id="${item.id}"]`);
                if (taskEl) {
                    taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    taskEl.classList.add('selected');
                    setTimeout(() => taskEl.classList.remove('selected'), 2500);
                }
            }, 300);
        }
    } else if (item.type === 'routine' || item.type === 'plan') {
        const planBtn = document.querySelector('.tab-btn[data-view="plan"]');
        if (planBtn) planBtn.click();
    } else if (item.type === 'vault') {
        const vaultBtn = document.querySelector('.tab-btn[data-view="vault"]');
        if (vaultBtn) vaultBtn.click();
        if (item.id && window.openVaultModal) {
            setTimeout(() => window.openVaultModal(item.id), 300);
        }
    }
};
