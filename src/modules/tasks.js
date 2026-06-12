import { supabase, $, showToast, initIcons, fireConfetti, capitalizeFirstLetter, linkify, formatDuration } from './config.js';
import { ARCHITECT_URL, SLICER_URL } from './config.js';

export function initTasks(deps) {
  const { fetchInbox, fetchVaultDocs, renderVault, renderInbox, startTimer } = deps;
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
    const openStates = {};
    if (taskList) {
      taskList.querySelectorAll('details').forEach(det => {
        const summary = det.querySelector('summary');
        if (summary) {
          // Extraemos solo el texto del título, ignorando el badge del contador
          const titleText = summary.childNodes[0]?.textContent?.trim() || "";
          if (titleText) openStates[titleText] = det.open;
        }
      });
    }
  
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
              <p>${linkify(task.description||'')}</p>
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
              <button class="btn-mini" onclick="event.stopPropagation();window.goToStoryboarder(decodeURIComponent('${encodeURIComponent(task.title)}'))" title="Guion y Storyboard"><i data-lucide="camera"></i></button>
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
    const personalTasks = filteredTasks.filter(t => (t.category || 'Personal') === 'Personal');
    const workTasks = filteredTasks.filter(t => (t.category || 'Personal') === 'Trabajo');
    const otherTasks = filteredTasks.filter(t => {
      const cat = t.category || 'Personal';
      return cat !== 'Personal' && cat !== 'Trabajo';
    });
  
    let html = '';
  
    const renderGroup = (title, icon, tasks, catClass) => {
      const count = tasks.length;
      const doneCount = tasks.filter(t => t.status === 'done').length;
      const groupKey = `${icon} ${title}`;
      const isOpen = openStates[groupKey] || false;
      
      return `
        <div class="category-group">
          <details ${isOpen ? 'open' : ''}>
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
      const { error } = await supabase.from('tasks').update({ 
        title, 
        description: capitalizeFirstLetter($('new-task-desc').value), 
        energy_level: energy, 
        assignee: assignee, 
        category: category,
        steps: currentStepsInModal 
      }).eq('id', id);
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
    return task.category || taskCategories[String(task.id)] || 'Personal';
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
      category: category,
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
    await window.syncCalendar('scheduled', start.toISOString(), end.toISOString());
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

  window.fetchTasks = fetchTasks;

  // 👇 JSON IMPORT TOGGLE (dentro del modal de tareas)
  window.toggleJsonImport = () => {
    const container = $('json-import-container');
    if (container) {
      const isVisible = container.style.display !== 'none';
      container.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        const input = container.querySelector('textarea');
        if (input) input.focus();
      }
    }
  };

  return { fetchTasks, loadStats: window.loadStats || (() => {}) };
}
