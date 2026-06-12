import { supabase, $, showToast, escHtml } from './config.js';
import { format12h, formatDuration, timeToMin, minToTime } from './config.js';

export function initPlanner() {
  // ==================== ROUTINES ====================
  const routines = JSON.parse(localStorage.getItem('axon_routines') || '[]');
  window.routines = routines;
  
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
  window.gcalId1 = localStorage.getItem('axon_gcal_id_1') || 'bffs.16.04.95@gmail.com';
  window.gcalId2 = localStorage.getItem('axon_gcal_id_2') || 'ec2bb1482572211b29bf0aaf281832d2701bfff84fb598ab4d91c70d2c3935c2@group.calendar.google.com';
  window.gcalId3 = localStorage.getItem('axon_gcal_id_3') || '42ed8e94b879dca88ae92956a9bf0f4780da36fbbde26f849aabb32a437c2e13@group.calendar.google.com';
  let gcalViewMode = localStorage.getItem('axon_gcal_view') || 'WEEK';
  
  function buildGCalUrl() {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
      let url = `https://calendar.google.com/calendar/embed?showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=${gcalViewMode}&wkst=1&bgcolor=%23ffffff&ctz=${tz}`;
      if (window.gcalId1) url += `&src=${encodeURIComponent(window.gcalId1)}&color=%234285F4`;
      if (window.gcalId2) url += `&src=${encodeURIComponent(window.gcalId2)}&color=%23E67C73`;
      if (window.gcalId3) url += `&src=${encodeURIComponent(window.gcalId3)}&color=%237986CB`;
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
      $('gcal-id-1').value = window.gcalId1;
      $('gcal-id-2').value = window.gcalId2;
      $('gcal-id-3').value = window.gcalId3;
      $('gcal-settings-modal').style.display = 'flex';
  };
  
  window.saveGCalUrl = () => {
      window.gcalId1 = $('gcal-id-1').value.trim();
      window.gcalId2 = $('gcal-id-2').value.trim();
      window.gcalId3 = $('gcal-id-3').value.trim();
      localStorage.setItem('axon_gcal_id_1', window.gcalId1);
      localStorage.setItem('axon_gcal_id_2', window.gcalId2);
      localStorage.setItem('axon_gcal_id_3', window.gcalId3);
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
      loadGCal();
  });
  
  // ==================== WEEKLY PLANNER ====================
  window.getWeekDays = function getWeekDays() {
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
  
  window.getRoutineBlocksForDay = function getRoutineBlocksForDay(date) {
    const dayOfWeek = date.getDay();
    return routines.filter(r => r.days.includes(dayOfWeek)).map(r => ({
      id: `routine-${r.id}-${date.toISOString().slice(0,10)}`,
      time: r.time, taskTitle: `${r.emoji} ${r.name}`, isRoutine: true, duration: r.duration, synced: false
    }));
  }
  window.getRoutineBlocksForDay = getRoutineBlocksForDay;
  
  window.renderPlanner = function renderPlanner() {
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
      const calendars = [window.gcalId2, window.gcalId3].filter(Boolean);
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
      
      const calendars = [window.gcalId2, window.gcalId3].filter(Boolean);
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

  return { renderRoutines, renderPlanner, loadGCal: window.loadGCal };
}

// ==================== TEMPLATES (Cloud / Local Storage) ====================
window.openSaveTemplateModal = () => {
  const modal = $('save-template-modal');
  if (!modal) { showToast('⚠️ Modal no encontrado'); return; }
  $('template-name-input').value = '';
  modal.style.display = 'flex';
};

window.confirmSaveTemplate = () => {
  const name = $('template-name-input')?.value.trim();
  if (!name) { showToast('⚠️ Dale un nombre a la plantilla'); return; }

  const template = {
    id: Date.now().toString(),
    name,
    routines: JSON.parse(localStorage.getItem('axon_routines') || '[]'),
    weekPlan: JSON.parse(localStorage.getItem('axon_week_plan') || '[]'),
    savedAt: new Date().toISOString()
  };

  const templates = JSON.parse(localStorage.getItem('axon_templates') || '[]');
  // Evitar duplicados por nombre
  const existingIdx = templates.findIndex(t => t.name === name);
  if (existingIdx >= 0) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem('axon_templates', JSON.stringify(templates));

  $('save-template-modal').style.display = 'none';
  showToast(`☁️ Plantilla "${name}" guardada`);
};

window.openLoadTemplateModal = () => {
  const modal = $('load-template-modal');
  if (!modal) { showToast('⚠️ Modal no encontrado'); return; }

  const templates = JSON.parse(localStorage.getItem('axon_templates') || '[]');
  const list = $('templates-list');
  if (!list) return;

  if (templates.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;text-align:center;">No hay plantillas guardadas aún.</p>';
  } else {
    list.innerHTML = templates.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);">
        <span>☁️ ${escHtml(t.name)} <small style="opacity:0.5;font-size:0.65rem;">${new Date(t.savedAt).toLocaleDateString()}</small></span>
        <button class="btn-mini" onclick="window.applyTemplate('${t.id}')" style="background:var(--accent);color:black;">Cargar</button>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
};

window.applyTemplate = (templateId) => {
  if (!window.confirm('⚠️ ¿Sobrescribir la planificación actual con esta plantilla? Las rutinas y bloques actuales se perderán.')) return;

  const templates = JSON.parse(localStorage.getItem('axon_templates') || '[]');
  const template = templates.find(t => t.id === templateId);
  if (!template) { showToast('⚠️ Plantilla no encontrada'); return; }

  // Restaurar rutinas y plan
  localStorage.setItem('axon_routines', JSON.stringify(template.routines));
  localStorage.setItem('axon_week_plan', JSON.stringify(template.weekPlan));

  // Recargar datos globales
  if (window.routines) {
    window.routines.length = 0;
    window.routines.push(...template.routines);
  }
  window.weekPlan.length = 0;
  window.weekPlan.push(...template.weekPlan);

  // Re-render
  if (window.renderRoutines) window.renderRoutines();
  if (window.renderPlanner) window.renderPlanner();

  $('load-template-modal').style.display = 'none';
  showToast(`☁️ Plantilla "${template.name}" cargada`);
};