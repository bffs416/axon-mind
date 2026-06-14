import { storyboardDb } from './storyboard_db.js';
import { effectsLibrary } from './effects_library.js';
import { $, showToast, initIcons } from '../config.js';

let currentProject = 'General';
let allScenes = []; // All scenes for current project
let activeSceneNum = 1;
let activeSceneHeading = 'INT. DEPARTAMENTO - DIA';
let effectsDrawerOpen = false;
let activeShotIndex = null; // For applying effects

export function initStoryboarder() {
  const container = $('view-storyboarder');
  if (!container) return;

  // Render main layout
  renderMainLayout();

  // Load projects and initial scenes
  loadProjectsList();
  loadProjectScenes(currentProject);

  // Setup Global Event Listeners
  setupEventListeners();
}

function renderMainLayout() {
  const container = $('view-storyboarder');
  container.innerHTML = `
    <div class="storyboard-container">
      <!-- Top header bar -->
      <div class="storyboard-header-bar">
        <div class="project-selector-container">
          <label for="sb-project-select">🎬 Proyecto:</label>
          <select id="sb-project-select" class="sb-select"></select>
          <button id="sb-new-project-btn" class="btn btn-secondary btn-sm">➕ Nuevo</button>
        </div>
        
        <div class="view-mode-selector">
          <button class="sb-mode-btn active" data-mode="director">🎥 Dirección</button>
          <button class="sb-mode-btn" data-mode="writing">✍️ Escritura</button>
          <button class="sb-mode-btn" data-mode="grid">🖼️ Storyboard</button>
        </div>
        
        <div class="header-actions">
          <button id="sb-export-pdf" class="btn btn-outline btn-sm"><i data-lucide="file-text"></i> Exportar PDF</button>
        </div>
      </div>

      <!-- Main workspace -->
      <div class="storyboard-workspace">
        
        <!-- Sidebar: Scenes list -->
        <aside class="storyboard-sidebar">
          <div class="sidebar-header">
            <h3>🎬 Escenas</h3>
            <button id="sb-add-scene-btn" class="btn-icon-sm" title="Nueva Escena">➕</button>
          </div>
          <div id="sb-scenes-list" class="sidebar-list">
            <!-- Scene items injected here -->
          </div>
        </aside>

        <!-- Center Stage: Editors and views -->
        <main class="storyboard-stage">
          <!-- Scene heading editor -->
          <div class="scene-heading-editor-container">
            <input type="text" id="sb-scene-heading-input" placeholder="INT. COCHE - NOCHE" value="${activeSceneHeading}">
          </div>

          <!-- Views -->
          <div id="sb-view-director" class="sb-view-pane active">
            <div id="sb-director-shots-list" class="sb-shots-list"></div>
          </div>
          
          <div id="sb-view-writing" class="sb-view-pane">
            <div id="sb-writing-editor" class="sb-writing-paper">
              <!-- Text-only script editor -->
            </div>
          </div>
          
          <div id="sb-view-grid" class="sb-view-pane">
            <div id="sb-grid-container" class="sb-grid-gallery"></div>
          </div>
        </main>

        <!-- Right drawer: Effects & Camera Library -->
        <aside class="storyboard-effects-drawer" id="sb-effects-drawer">
          <div class="drawer-header">
            <h3>📚 Biblioteca Técnica</h3>
            <button id="sb-close-drawer-btn" class="btn-icon-sm">✖</button>
          </div>
          
          <div class="drawer-search">
            <input type="text" id="sb-effect-search-input" placeholder="Buscar efecto (ej. bullet time, picado)...">
          </div>
          
          <div class="drawer-tabs">
            <button class="drawer-tab active" data-cat="all">Todos</button>
            <button class="drawer-tab" data-cat="lens">Planos</button>
            <button class="drawer-tab" data-cat="angle">Ángulos</button>
            <button class="drawer-tab" data-cat="movement">Cámara</button>
            <button class="drawer-tab" data-cat="effect">Visuales</button>
          </div>
          
          <div id="sb-effects-list" class="drawer-list"></div>
        </aside>

      </div>
    </div>

    <!-- Lightbox Modal -->
    <div id="sb-lightbox-modal" class="sb-lightbox" onclick="closeLightbox()">
      <span class="sb-lightbox-close">&times;</span>
      <img class="sb-lightbox-content" id="sb-lightbox-img">
      <div id="sb-lightbox-caption"></div>
    </div>

    <!-- Sketchpad Modal -->
    <div id="sb-sketchpad-modal" class="modal" style="display:none; z-index:200000; align-items:center; justify-content:center;">
      <div class="modal-content" style="max-width: 700px; padding: 1.5rem; display:flex; flex-direction:column; gap:1rem; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">🎨 Dibujar Boceto de Referencia</h3>
          <button class="btn-icon-sm" onclick="window.closeDrawingSketchpad()" style="background:none; border:none; color:var(--text); font-size:1.2rem; cursor:pointer;">✖</button>
        </div>
        
        <!-- Controls bar -->
        <div class="sketchpad-controls" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; background:var(--bg-deep); padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:0.3rem;">
            <label style="font-size:0.75rem; color:var(--text-dim);">Color:</label>
            <input type="color" id="sketch-color" value="#ffffff" style="border:none; width:32px; height:32px; padding:0; background:none; cursor:pointer; outline:none;">
          </div>
          <div style="display:flex; align-items:center; gap:0.3rem; flex:1; min-width:120px;">
            <label style="font-size:0.75rem; color:var(--text-dim);">Grosor:</label>
            <input type="range" id="sketch-size" min="1" max="20" value="3" style="flex:1; accent-color:var(--primary);">
          </div>
          <button id="sketch-eraser" class="btn btn-secondary btn-sm" onclick="window.toggleSketchEraser()" style="padding:0.4rem 0.6rem; font-size:0.75rem;">🧽 Borrar</button>
          <button class="btn btn-secondary btn-sm" onclick="window.undoSketch()" style="padding:0.4rem 0.6rem; font-size:0.75rem;">↩️ Deshacer</button>
          <button class="btn btn-secondary btn-sm" onclick="window.clearSketchCanvas()" style="padding:0.4rem 0.6rem; font-size:0.75rem;">🗑️ Limpiar</button>
          <button class="btn btn-secondary btn-sm" onclick="window.toggleSketchTheme()" id="sketch-theme-btn" title="Alternar Pizarra Blanca/Negra" style="padding:0.4rem 0.6rem; font-size:0.75rem;">🌗 Pizarra</button>
        </div>
        
        <!-- Canvas container -->
        <div class="canvas-container" style="background:#121212; border-radius:8px; border:1px solid var(--border); overflow:hidden; position:relative; aspect-ratio:16/9; width:100%;">
          <canvas id="sketch-canvas" style="display:block; width:100%; height:100%; cursor:crosshair; touch-action:none;"></canvas>
        </div>
        
        <div class="modal-actions" style="margin-top:0.5rem; display:flex; justify-content:flex-end; gap:0.5rem;">
          <button class="btn btn-ghost" onclick="window.closeDrawingSketchpad()" style="padding:0.5rem 1rem; font-size:0.85rem;">Cancelar</button>
          <button class="btn btn-primary" onclick="window.saveSketch()" style="padding:0.5rem 1rem; font-size:0.85rem;">💾 Guardar Boceto</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== DATA LOADING ====================

async function loadProjectsList() {
  const selector = $('sb-project-select');
  if (!selector) return;
  
  const projects = await storyboardDb.fetchProjects();
  selector.innerHTML = projects.map(p => `<option value="${p}">${p}</option>`).join('');
  selector.value = currentProject;
}

async function loadProjectScenes(projName) {
  currentProject = projName;
  const scenes = await storyboardDb.fetchScenes(currentProject);
  allScenes = scenes;

  // If there are no scenes, create an empty one
  if (allScenes.length === 0) {
    activeSceneNum = 1;
    activeSceneHeading = 'INT. DEPARTAMENTO - DIA';
    await createEmptyShot(1, activeSceneHeading, 1);
    return;
  }

  // Get active scene heading
  const firstInActive = allScenes.find(s => s.scene_number === activeSceneNum);
  if (firstInActive) {
    activeSceneHeading = firstInActive.scene_heading;
  } else {
    activeSceneNum = allScenes[0].scene_number;
    activeSceneHeading = allScenes[0].scene_heading;
  }

  const headingInput = $('sb-scene-heading-input');
  if (headingInput) headingInput.value = activeSceneHeading;

  renderScenesSidebar();
  renderActiveSceneShots();
}

function renderScenesSidebar() {
  const list = $('sb-scenes-list');
  if (!list) return;

  // Group by scene_number
  const grouped = {};
  allScenes.forEach(s => {
    if (!grouped[s.scene_number]) {
      grouped[s.scene_number] = s.scene_heading;
    }
  });

  const sceneNumbers = Object.keys(grouped).map(Number).sort((a,b) => a - b);
  
  list.innerHTML = sceneNumbers.map(num => `
    <div class="sidebar-item ${num === activeSceneNum ? 'active' : ''}" onclick="window.selectStoryboardScene(${num})" style="position:relative; display:flex; align-items:center; justify-content:space-between; width:100%;">
      <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
        <span class="scene-num-badge">Esc ${num}</span>
        <span class="scene-title-text">${grouped[num] || 'Escena Sin Título'}</span>
      </div>
      <button class="btn-delete-scene" onclick="event.stopPropagation(); window.deleteStoryboardScene(${num})" title="Eliminar Escena Completa" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:0.8rem; opacity:0.5; padding: 2px 4px; transition: all 0.2s ease;">🗑️</button>
    </div>
  `).join('');
}

window.selectStoryboardScene = (num) => {
  activeSceneNum = num;
  const scene = allScenes.find(s => s.scene_number === num);
  if (scene) {
    activeSceneHeading = scene.scene_heading;
    const headingInput = $('sb-scene-heading-input');
    if (headingInput) headingInput.value = activeSceneHeading;
  }
  
  renderScenesSidebar();
  renderActiveSceneShots();
};

window.deleteStoryboardScene = async (sceneNum) => {
  if (!confirm(`¿Eliminar la Escena ${sceneNum} y TODAS sus tomas de forma permanente?`)) return;
  
  try {
    const shotsToDelete = allScenes.filter(s => s.scene_number === sceneNum && s.project_name === currentProject);
    for (const s of shotsToDelete) {
      await storyboardDb.deleteScene(s.id);
    }
    
    // Update local cache
    allScenes = allScenes.filter(s => !(s.scene_number === sceneNum && s.project_name === currentProject));
    
    if (activeSceneNum === sceneNum) {
      const remainingNums = [...new Set(allScenes.map(s => s.scene_number))];
      if (remainingNums.length > 0) {
        activeSceneNum = Math.min(...remainingNums);
        const nextScene = allScenes.find(s => s.scene_number === activeSceneNum);
        activeSceneHeading = nextScene ? nextScene.scene_heading : 'INT. ESCENA - DIA';
      } else {
        activeSceneNum = 1;
        activeSceneHeading = 'INT. ESCENA - DIA';
        await createEmptyShot(1, activeSceneHeading, 1);
        return;
      }
    }
    
    renderScenesSidebar();
    renderActiveSceneShots();
    showToast(`🗑️ Escena ${sceneNum} eliminada`);
  } catch (e) {
    console.error(e);
    showToast('⚠️ Error al eliminar la escena');
  }
};

window.selectStoryboardProject = async (projectName) => {
  currentProject = projectName;
  await loadProjectsList();
  await loadProjectScenes(projectName);
};

// ==================== SHOT RENDERING ====================

function renderActiveSceneShots() {
  const activeShots = allScenes.filter(s => s.scene_number === activeSceneNum)
                              .sort((a,b) => a.shot_number - b.shot_number);
  
  // Save current view mode status
  const currentMode = document.querySelector('.sb-mode-btn.active')?.dataset.mode || 'director';
  
  if (currentMode === 'director') {
    renderDirectorMode(activeShots);
  } else if (currentMode === 'writing') {
    renderWritingMode(activeShots);
  } else if (currentMode === 'grid') {
    renderGridMode(activeShots);
  }
  
  initIcons();
}

function renderDirectorMode(shots) {
  const container = $('sb-director-shots-list');
  if (!container) return;

  container.innerHTML = shots.map((s, index) => {
    const shotOptionsHtml = `
      <div class="shot-camera-field">
        <label>Planos:</label>
        <select class="shot-select" onchange="window.updateShotField('${s.id}', 'camera_shot_type', this.value)">
          <option value="">Selecciona Plano</option>
          <option value="EWS" ${s.camera_shot_type === 'EWS' ? 'selected' : ''}>Gran Plano General (EWS)</option>
          <option value="WS" ${s.camera_shot_type === 'WS' ? 'selected' : ''}>Plano General (WS)</option>
          <option value="MS" ${s.camera_shot_type === 'MS' ? 'selected' : ''}>Plano Medio (MS)</option>
          <option value="MCU" ${s.camera_shot_type === 'MCU' ? 'selected' : ''}>Plano Medio Corto (MCU)</option>
          <option value="CU" ${s.camera_shot_type === 'CU' ? 'selected' : ''}>Primer Plano (CU)</option>
          <option value="ECU" ${s.camera_shot_type === 'ECU' ? 'selected' : ''}>Primerísimo Plano (ECU)</option>
        </select>
      </div>

      <div class="shot-camera-field">
        <label>Ángulo:</label>
        <select class="shot-select" onchange="window.updateShotField('${s.id}', 'camera_angle', this.value)">
          <option value="">Selecciona Ángulo</option>
          <option value="Normal" ${s.camera_angle === 'Normal' ? 'selected' : ''}>Nivel de Ojos (Normal)</option>
          <option value="Low Angle" ${s.camera_angle === 'Low Angle' ? 'selected' : ''}>Contrapicado (Low)</option>
          <option value="High Angle" ${s.camera_angle === 'High Angle' ? 'selected' : ''}>Picado (High)</option>
          <option value="Dutch Angle" ${s.camera_angle === 'Dutch Angle' ? 'selected' : ''}>Aberrante (Dutch)</option>
          <option value="Zenith" ${s.camera_angle === 'Zenith' ? 'selected' : ''}>Cenital (Top Down)</option>
        </select>
      </div>

      <div class="shot-camera-field">
        <label>Cámara:</label>
        <select class="shot-select" onchange="window.updateShotField('${s.id}', 'camera_movement', this.value)">
          <option value="">Selecciona Movimiento</option>
          <option value="Fijo" ${s.camera_movement === 'Fijo' ? 'selected' : ''}>Estático (Fijo)</option>
          <option value="Pan" ${s.camera_movement === 'Pan' ? 'selected' : ''}>Paneo (Pan)</option>
          <option value="Tilt" ${s.camera_movement === 'Tilt' ? 'selected' : ''}>Inclinación (Tilt)</option>
          <option value="Dolly" ${s.camera_movement === 'Dolly' ? 'selected' : ''}>Dolly / Track</option>
          <option value="Steadicam" ${s.camera_movement === 'Steadicam' ? 'selected' : ''}>Estabilizador (Steadicam)</option>
          <option value="Handheld" ${s.camera_movement === 'Handheld' ? 'selected' : ''}>En mano (Handheld)</option>
        </select>
      </div>

      <div class="shot-camera-field">
        <label>Efecto Visual:</label>
        <div style="display:flex; gap:0.2rem;">
          <input type="text" class="shot-input" value="${s.visual_effect || ''}" onchange="window.updateShotField('${s.id}', 'visual_effect', this.value)" placeholder="Bullet Time, Vertigo..." id="fx-input-${s.id}">
          <button class="btn-mini-tech" onclick="window.openEffectsDrawer('${s.id}', ${index})" title="Ver librería de efectos">📚</button>
        </div>
      </div>
    `;

    const imgPreviewHtml = s.reference_image_url 
      ? `
        <div class="shot-img-wrapper" style="position:relative; width:100%; height:100%;">
          <img src="${s.reference_image_url}" class="shot-preview-img" onclick="window.openLightbox('${s.reference_image_url}', 'Toma ${s.shot_number}')" title="Haga clic para expandir">
          <div class="shot-img-overlay-actions">
            <button class="overlay-action-btn" onclick="event.stopPropagation(); window.triggerFileInput('${s.id}')" title="Subir Imagen">📂 Subir</button>
            <button class="overlay-action-btn" onclick="event.stopPropagation(); window.promptImageLink('${s.id}')" title="Pegar Enlace">🔗 URL</button>
            <button class="overlay-action-btn" onclick="event.stopPropagation(); window.openDrawingSketchpad('${s.id}')" title="Dibujar Boceto">🎨 Dibujar</button>
          </div>
        </div>
      `
      : `
        <div class="shot-preview-placeholder">
          <i data-lucide="image" style="width:24px; height:24px;"></i>
          <span>Agregar Referencia</span>
          <div class="placeholder-actions" onclick="event.stopPropagation()">
            <button class="placeholder-action-btn" onclick="window.triggerFileInput('${s.id}')" title="Subir Imagen">📂 Subir</button>
            <button class="placeholder-action-btn" onclick="window.promptImageLink('${s.id}')" title="Pegar Enlace">🔗 URL</button>
            <button class="placeholder-action-btn" onclick="window.openDrawingSketchpad('${s.id}')" title="Dibujar Boceto">🎨 Dibujar</button>
          </div>
        </div>
      `;

    return `
      <div class="director-shot-card" data-id="${s.id}">
        <!-- Columna 1: Datos Técnicos y Referencia Visual -->
        <div class="shot-col-technical">
          <div class="shot-tech-header">
            <span class="shot-num-title">Toma ${s.shot_number}</span>
            <div class="shot-actions">
              <button class="btn-mini-danger" onclick="window.deleteStoryboardShot('${s.id}')" title="Eliminar toma">🗑️</button>
            </div>
          </div>
          
          <div class="shot-img-container">
            ${imgPreviewHtml}
            <input type="file" id="file-${s.id}" class="shot-file-input" style="display:none" onchange="window.handleShotImageUpload('${s.id}', this)">
          </div>

          <div class="shot-camera-options">
            ${shotOptionsHtml}
          </div>

          <div class="shot-links-container">
            <label>🔗 Enlaces de Referencia (Separar con comas):</label>
            <textarea class="shot-links-textarea" placeholder="https://shotdeck.com/..., https://frameset.app/..." oninput="window.debouncedUpdateShotLinks('${s.id}', this.value)">${(s.reference_links || []).join(', ')}</textarea>
          </div>
        </div>

        <!-- Columna 2: Escritura Literaria (Estilo Kit Scenarist) -->
        <div class="shot-col-literary">
          <div class="scenarist-editor">
            <div class="scenarist-field">
              <span class="scenarist-label">ACCIÓN</span>
              <textarea class="scenarist-textarea" placeholder="Descripción de la acción física, sonido y ambiente..." oninput="window.debouncedUpdateShotField('${s.id}', 'action_description', this.value)">${s.action_description || ''}</textarea>
            </div>
            
            <div class="scenarist-field">
              <span class="scenarist-label">PERSONAJE</span>
              <input type="text" class="scenarist-input-char" placeholder="PERSONAJE" value="${s.character_name || ''}" oninput="window.debouncedUpdateShotField('${s.id}', 'character_name', this.value)" onkeydown="window.handleCharacterKeydown(event, '${s.id}')" id="char-input-${s.id}">
            </div>

            <div class="scenarist-field">
              <span class="scenarist-label">DIÁLOGO</span>
              <textarea class="scenarist-textarea-dialogue" placeholder="(Diálogo del personaje...)" oninput="window.debouncedUpdateShotField('${s.id}', 'dialogue', this.value)" onkeydown="window.handleDialogueKeydown(event, '${s.id}')" id="dialogue-input-${s.id}">${s.dialogue || ''}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('') + `
    <div style="display:flex; justify-content:center; padding:1.5rem 0;">
      <button class="btn btn-primary" onclick="window.addShotToActiveScene()">➕ Nueva Toma (Alt+N)</button>
    </div>
  `;
}

function renderWritingMode(shots) {
  const container = $('sb-writing-editor');
  if (!container) return;

  container.innerHTML = `
    <div class="writing-paper-inner">
      <div class="writing-scene-heading">${activeSceneHeading}</div>
      ${shots.map(s => {
        let dialogueHtml = '';
        if (s.character_name) {
          dialogueHtml = `
            <div class="script-character">${s.character_name.toUpperCase()}</div>
            <div class="script-dialogue">${s.dialogue || '...'}</div>
          `;
        }
        return `
          <div class="script-shot-block" data-shot="${s.shot_number}">
            <div class="script-shot-label">TOMA ${s.shot_number} ${s.camera_shot_type ? `[${s.camera_shot_type}]` : ''} ${s.camera_angle ? `[${s.camera_angle}]` : ''}</div>
            <div class="script-action">${s.action_description || '(Sin descripción)'}</div>
            ${dialogueHtml}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderGridMode(shots) {
  const container = $('sb-grid-container');
  if (!container) return;

  container.innerHTML = shots.map(s => {
    const cameraDetail = [s.camera_shot_type, s.camera_angle, s.camera_movement, s.visual_effect].filter(Boolean).join(' · ');
    return `
      <div class="sb-grid-card">
        <div class="sb-grid-img-holder" onclick="window.openLightbox('${s.reference_image_url || 'https://via.placeholder.com/320x180/1c1917/a8a29e?text=Sin+Referencia'}', 'Toma ${s.shot_number}')">
          <img src="${s.reference_image_url || 'https://via.placeholder.com/320x180/1c1917/a8a29e?text=Sin+Referencia'}">
          <span class="sb-grid-num-badge">${s.scene_number}.${s.shot_number}</span>
        </div>
        <div class="sb-grid-info">
          <div class="sb-grid-camera">${cameraDetail || 'Cámara no especificada'}</div>
          <div class="sb-grid-action">${s.action_description || 'Sin descripción'}</div>
          ${s.character_name ? `
            <div class="sb-grid-dialogue">
              <strong>${s.character_name}:</strong> "${s.dialogue || '...'}"
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ==================== ATRIBUTOS Y ACTUALIZACIONES ====================

window.triggerFileInput = (id) => {
  const input = $(`file-${id}`);
  if (input) input.click();
};

window.handleShotImageUpload = async (id, fileInput) => {
  const file = fileInput.files[0];
  if (!file) return;

  const card = document.querySelector(`.director-shot-card[data-id="${id}"]`);
  const imgContainer = card?.querySelector('.shot-img-container');
  if (imgContainer) {
    imgContainer.innerHTML = `<div class="shot-preview-placeholder">⏳ Subiendo...</div>`;
  }

  try {
    const publicUrl = await storyboardDb.uploadReferenceImage(file);
    await window.updateShotField(id, 'reference_image_url', publicUrl);
    showToast('📸 Referencia subida con éxito');
  } catch (e) {
    showToast('⚠️ Error al subir imagen');
    renderActiveSceneShots();
  }
};

window.updateShotField = async (id, field, value) => {
  const scene = allScenes.find(s => s.id === id);
  if (!scene) return;
  scene[field] = value;
  
  try {
    if (field === 'scene_heading') {
      await storyboardDb.updateSceneHeading(scene.project_name, scene.scene_number, value);
      activeSceneHeading = value;
      allScenes.forEach(s => {
        if (s.scene_number === activeSceneNum && s.project_name === currentProject) {
          s.scene_heading = value;
        }
      });
      renderScenesSidebar();
    } else {
      await storyboardDb.saveScene(scene);
    }
  } catch (e) {
    showToast('⚠️ Error al guardar en base de datos');
  }
};

window.updateShotLinks = async (id, val) => {
  const links = val.split(',').map(l => l.trim()).filter(Boolean);
  await window.updateShotField(id, 'reference_links', links);
};

window.addShotToActiveScene = async () => {
  const activeShots = allScenes.filter(s => s.scene_number === activeSceneNum);
  const nextShotNum = activeShots.length > 0 
    ? Math.max(...activeShots.map(s => s.shot_number)) + 1 
    : 1;
  
  await createEmptyShot(activeSceneNum, activeSceneHeading, nextShotNum);
  showToast(`➕ Toma ${nextShotNum} añadida`);
};

async function createEmptyShot(sceneNum, heading, shotNum) {
  const newShot = {
    project_name: currentProject,
    scene_number: sceneNum,
    scene_heading: heading,
    shot_number: shotNum,
    camera_shot_type: '',
    camera_angle: '',
    camera_movement: '',
    visual_effect: '',
    action_description: '',
    character_name: '',
    dialogue: '',
    reference_image_url: '',
    reference_links: []
  };

  try {
    const saved = await storyboardDb.saveScene(newShot);
    allScenes.push(saved);
    renderScenesSidebar();
    renderActiveSceneShots();
  } catch (e) {
    showToast('⚠️ Error al crear nueva toma');
  }
}

window.deleteStoryboardShot = async (id) => {
  if (!confirm('¿Eliminar esta toma permanentemente?')) return;
  
  try {
    await storyboardDb.deleteScene(id);
    allScenes = allScenes.filter(s => s.id !== id);
    
    // If no shots remaining in scene, delete local reference and select another scene
    const remainingShots = allScenes.filter(s => s.scene_number === activeSceneNum);
    if (remainingShots.length === 0) {
      const remainingNums = [...new Set(allScenes.map(s => s.scene_number))];
      if (remainingNums.length > 0) {
        activeSceneNum = remainingNums[0];
      } else {
        await createEmptyShot(1, 'INT. ESCENA - DIA', 1);
        return;
      }
    }
    
    renderScenesSidebar();
    renderActiveSceneShots();
    showToast('🗑️ Toma eliminada');
  } catch (e) {
    showToast('⚠️ Error al eliminar toma');
  }
};

// ==================== ATAJOS DE TECLADO (SCENARIST FIELD) ====================

window.handleCharacterKeydown = (e, id) => {
  // Enter en el Personaje cambia el enfoque al Diálogo de la misma toma
  if (e.key === 'Enter') {
    e.preventDefault();
    const dialogueInput = $(`dialogue-input-${id}`);
    if (dialogueInput) dialogueInput.focus();
  }
};

window.handleDialogueKeydown = (e, id) => {
  // Enter en el Diálogo crea una nueva toma en la escena
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.addShotToActiveScene().then(() => {
      setTimeout(() => {
        const activeShots = allScenes.filter(s => s.scene_number === activeSceneNum)
                                    .sort((a,b) => a.shot_number - b.shot_number);
        const lastShot = activeShots[activeShots.length - 1];
        const lastCharInput = $(`char-input-${lastShot.id}`);
        if (lastCharInput) lastCharInput.focus();
      }, 200);
    });
  }
};

// ==================== EFFECTS DRAWER ====================

window.openEffectsDrawer = (shotId, index) => {
  activeShotIndex = shotId;
  const drawer = $('sb-effects-drawer');
  if (drawer) {
    drawer.classList.add('open');
    effectsDrawerOpen = true;
    renderEffectsLibrary('all');
  }
};

window.closeEffectsDrawer = () => {
  const drawer = $('sb-effects-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    effectsDrawerOpen = false;
  }
};

function renderEffectsLibrary(cat = 'all', query = '') {
  const list = $('sb-effects-list');
  if (!list) return;

  const q = query.toLowerCase();
  const filtered = effectsLibrary.filter(fx => {
    const matchCat = cat === 'all' || fx.category === cat;
    const matchQuery = fx.name.toLowerCase().includes(q) || 
                       fx.tag.toLowerCase().includes(q) || 
                       (fx.description || '').toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  list.innerHTML = filtered.map(fx => `
    <div class="effect-card" onclick="window.applyEffectToActiveShot('${fx.tag}', '${fx.category}')">
      <div class="effect-card-header">
        <span class="effect-badge ${fx.category}">${fx.tag}</span>
        <h4>${fx.name}</h4>
      </div>
      <p class="effect-desc">${fx.description}</p>
      <div class="effect-setup">
        <strong>⚙️ Posicionamiento de Cámara:</strong>
        <p>${fx.setup}</p>
      </div>
      ${fx.referenceUrl ? `<a href="${fx.referenceUrl}" target="_blank" class="effect-link" onclick="event.stopPropagation()">Ver referencia oficial 🔗</a>` : ''}
    </div>
  `).join('');
}

window.applyEffectToActiveShot = async (tag, category) => {
  if (!activeShotIndex) return;

  const shot = allScenes.find(s => s.id === activeShotIndex);
  if (!shot) return;

  if (category === 'lens') {
    shot.camera_shot_type = tag;
  } else if (category === 'angle') {
    shot.camera_angle = tag;
  } else if (category === 'movement') {
    shot.camera_movement = tag;
  } else if (category === 'effect') {
    shot.visual_effect = tag;
    const fxInput = $(`fx-input-${activeShotIndex}`);
    if (fxInput) fxInput.value = tag;
  }

  try {
    await storyboardDb.saveScene(shot);
    renderActiveSceneShots();
    showToast(`📝 Efecto ${tag} aplicado a la toma`);
    window.closeEffectsDrawer();
  } catch (e) {
    showToast('⚠️ Error al aplicar el efecto');
  }
};

// ==================== LIGHTBOX ====================

window.openLightbox = (src, caption) => {
  const modal = $('sb-lightbox-modal');
  const modalImg = $('sb-lightbox-img');
  const captionText = $('sb-lightbox-caption');
  
  if (modal && modalImg) {
    modal.style.display = 'block';
    modalImg.src = src;
    if (captionText) captionText.innerHTML = caption;
  }
};

window.closeLightbox = () => {
  const modal = $('sb-lightbox-modal');
  if (modal) modal.style.display = 'none';
};

// ==================== SKETCHPAD CANVAS DRAWING ENGINE ====================

let sketchCanvas = null;
let sketchCtx = null;
let isDrawing = false;
let sketchColorInput = null;
let sketchSizeInput = null;
let isEraser = false;
let undoStack = [];
let maxUndoSteps = 25;
let sketchTheme = 'dark'; // 'dark' (blackboard) or 'light' (whiteboard)
let activeDrawingShotId = null;

function initSketchpad() {
  sketchCanvas = $('sketch-canvas');
  if (!sketchCanvas) return;
  sketchCtx = sketchCanvas.getContext('2d');
  sketchColorInput = $('sketch-color');
  sketchSizeInput = $('sketch-size');
  
  // Set internal resolution to 1280x720 (16:9 HD standard)
  sketchCanvas.width = 1280;
  sketchCanvas.height = 720;
  
  clearSketchCanvas();
  
  // Setup Pointer Events for Stylus (S Pen) and Mouse/Touch drawing
  sketchCanvas.addEventListener('pointerdown', startDrawing);
  sketchCanvas.addEventListener('pointermove', draw);
  sketchCanvas.addEventListener('pointerup', stopDrawing);
  sketchCanvas.addEventListener('pointerleave', stopDrawing);
}

function clearSketchCanvas() {
  if (!sketchCtx || !sketchCanvas) return;
  sketchCtx.fillStyle = sketchTheme === 'dark' ? '#121212' : '#ffffff';
  sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  saveCanvasState();
}

function saveCanvasState() {
  if (!sketchCanvas) return;
  if (undoStack.length >= maxUndoSteps) {
    undoStack.shift();
  }
  undoStack.push(sketchCanvas.toDataURL());
}

window.undoSketch = () => {
  if (undoStack.length <= 1) return; // Keep the original blank blackboard/whiteboard state
  undoStack.pop(); // discard current state
  const prevStateData = undoStack[undoStack.length - 1];
  const img = new Image();
  img.onload = () => {
    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    sketchCtx.drawImage(img, 0, 0);
  };
  img.src = prevStateData;
};

window.clearSketchCanvas = () => {
  clearSketchCanvas();
};

window.toggleSketchTheme = () => {
  sketchTheme = sketchTheme === 'dark' ? 'light' : 'dark';
  const colorInput = $('sketch-color');
  if (colorInput) {
    colorInput.value = sketchTheme === 'dark' ? '#ffffff' : '#000000';
  }
  clearSketchCanvas();
  showToast(sketchTheme === 'dark' ? 'Pizarra Negra (Carbón)' : 'Pizarra Blanca (Papel)');
};

window.toggleSketchEraser = () => {
  isEraser = !isEraser;
  const eraserBtn = $('sketch-eraser');
  if (eraserBtn) {
    if (isEraser) {
      eraserBtn.classList.add('active');
      eraserBtn.style.background = 'var(--primary)';
      eraserBtn.style.color = '#fff';
    } else {
      eraserBtn.classList.remove('active');
      eraserBtn.style.background = '';
      eraserBtn.style.color = '';
    }
  }
};

function getCoords(e) {
  const rect = sketchCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (sketchCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (sketchCanvas.height / rect.height)
  };
}

function startDrawing(e) {
  isDrawing = true;
  sketchCtx.beginPath();
  const coords = getCoords(e);
  sketchCtx.moveTo(coords.x, coords.y);
  
  sketchCtx.lineCap = 'round';
  sketchCtx.lineJoin = 'round';
  updateBrushSettings();
  
  sketchCtx.lineTo(coords.x, coords.y);
  sketchCtx.stroke();
}

function draw(e) {
  if (!isDrawing) return;
  const coords = getCoords(e);
  sketchCtx.lineTo(coords.x, coords.y);
  sketchCtx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    sketchCtx.closePath();
    saveCanvasState();
  }
}

function updateBrushSettings() {
  if (isEraser) {
    sketchCtx.strokeStyle = sketchTheme === 'dark' ? '#121212' : '#ffffff';
    sketchCtx.lineWidth = (sketchSizeInput?.value || 3) * 4; // Extra width for eraser
  } else {
    sketchCtx.strokeStyle = sketchColorInput?.value || '#ffffff';
    sketchCtx.lineWidth = sketchSizeInput?.value || 3;
  }
}

window.openDrawingSketchpad = (shotId) => {
  activeDrawingShotId = shotId;
  const modal = $('sb-sketchpad-modal');
  if (modal) {
    modal.style.display = 'flex';
    if (!sketchCanvas) {
      initSketchpad();
    } else {
      undoStack = [];
      clearSketchCanvas();
    }
  }
};

window.closeDrawingSketchpad = () => {
  const modal = $('sb-sketchpad-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.saveSketch = async () => {
  if (!activeDrawingShotId || !sketchCanvas) return;
  
  const saveBtn = document.querySelector('#sb-sketchpad-modal .btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '⏳ Guardando...';
  saveBtn.disabled = true;

  try {
    const blob = await new Promise(resolve => sketchCanvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `sketch_${Date.now()}.png`, { type: 'image/png' });
    const publicUrl = await storyboardDb.uploadReferenceImage(file);
    
    await window.updateShotField(activeDrawingShotId, 'reference_image_url', publicUrl);
    
    showToast('🎨 Boceto guardado en la toma');
    window.closeDrawingSketchpad();
    renderActiveSceneShots();
  } catch (e) {
    console.error(e);
    showToast('⚠️ Error al guardar el boceto');
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
};

window.promptImageLink = async (id) => {
  const url = prompt('Introduce la URL/Enlace directo de la imagen de referencia:');
  if (url === null) return;
  if (url.trim() === '') {
    await window.updateShotField(id, 'reference_image_url', '');
    showToast('🗑️ Imagen de referencia eliminada');
  } else {
    await window.updateShotField(id, 'reference_image_url', url.trim());
    showToast('🔗 Enlace de referencia agregado');
  }
  renderActiveSceneShots();
};

// ==================== DEBOUNCED AUTOSAVE HELPERS ====================

let debounceTimers = {};
window.debouncedUpdateShotField = (id, field, value) => {
  const timerKey = `${id}_${field}`;
  if (debounceTimers[timerKey]) {
    clearTimeout(debounceTimers[timerKey]);
  }
  
  // Update local cache immediately so client views are in sync
  const shot = allScenes.find(s => s.id === id);
  if (shot) {
    shot[field] = value;
  }
  
  debounceTimers[timerKey] = setTimeout(async () => {
    try {
      await window.updateShotField(id, field, value);
      delete debounceTimers[timerKey];
    } catch (e) {
      console.error(e);
    }
  }, 1000);
};

let debounceLinksTimers = {};
window.debouncedUpdateShotLinks = (id, val) => {
  if (debounceLinksTimers[id]) {
    clearTimeout(debounceLinksTimers[id]);
  }
  
  debounceLinksTimers[id] = setTimeout(async () => {
    try {
      await window.updateShotLinks(id, val);
      delete debounceLinksTimers[id];
    } catch (e) {
      console.error(e);
    }
  }, 1000);
};

// ==================== INITIALIZATION & EVENT LISTENERS ====================

function setupEventListeners() {
  // Project Selector
  const projSelect = $('sb-project-select');
  if (projSelect) {
    projSelect.onchange = () => {
      loadProjectScenes(projSelect.value);
    };
  }

  // New Project Button
  const newProjBtn = $('sb-new-project-btn');
  if (newProjBtn) {
    newProjBtn.onclick = () => {
      const name = prompt('Nombre del nuevo proyecto filmmaker:');
      if (name) {
        currentProject = name;
        loadProjectScenes(currentProject).then(() => {
          loadProjectsList();
        });
      }
    };
  }

  // Mode buttons (Director, Writing, Storyboard)
  const modeBtns = document.querySelectorAll('.sb-mode-btn');
  modeBtns.forEach(btn => {
    btn.onclick = () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Hide all panes
      document.querySelectorAll('.sb-view-pane').forEach(p => p.classList.remove('active'));
      
      // Show matching pane
      const mode = btn.dataset.mode;
      const targetPane = $('sb-view-' + mode);
      if (targetPane) targetPane.classList.add('active');

      renderActiveSceneShots();
    };
  });

  // Scene Heading Input
  const headingInput = $('sb-scene-heading-input');
  if (headingInput) {
    let headingTimer = null;
    headingInput.oninput = () => {
      if (headingTimer) clearTimeout(headingTimer);
      headingTimer = setTimeout(async () => {
        const activeShots = allScenes.filter(s => s.scene_number === activeSceneNum);
        if (activeShots.length > 0) {
          await window.updateShotField(activeShots[0].id, 'scene_heading', headingInput.value);
          renderActiveSceneShots();
        }
      }, 1000);
    };
  }

  // Add Scene Button
  const addSceneBtn = $('sb-add-scene-btn');
  if (addSceneBtn) {
    addSceneBtn.onclick = () => {
      const allNums = [...new Set(allScenes.map(s => s.scene_number))];
      const nextSceneNum = allNums.length > 0 ? Math.max(...allNums) + 1 : 1;
      const heading = prompt('Encabezado de la nueva escena:', 'INT. NUEVA ESCENA - DIA');
      if (heading) {
        activeSceneNum = nextSceneNum;
        activeSceneHeading = heading;
        createEmptyShot(nextSceneNum, heading, 1);
      }
    };
  }

  // Close Drawer Button
  const closeDrawerBtn = $('sb-close-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.onclick = () => {
      window.closeEffectsDrawer();
    };
  }

  // Effect category filters (tabs)
  const drawerTabs = document.querySelectorAll('.drawer-tab');
  drawerTabs.forEach(tab => {
    tab.onclick = () => {
      drawerTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const searchVal = $('sb-effect-search-input')?.value || '';
      renderEffectsLibrary(tab.dataset.cat, searchVal);
    };
  });

  // Effect Search Input
  const searchInput = $('sb-effect-search-input');
  if (searchInput) {
    searchInput.oninput = () => {
      const activeCat = document.querySelector('.drawer-tab.active')?.dataset.cat || 'all';
      renderEffectsLibrary(activeCat, searchInput.value);
    };
  }

  // Global keyboard shortcuts (Alt+N to add shot)
  document.addEventListener('keydown', (e) => {
    const container = $('view-storyboarder');
    if (!container || !container.classList.contains('active')) return;
    
    // Alt + N for new shot
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      window.addShotToActiveScene();
    }
  });

  // PDF Export Button
  const exportPdfBtn = $('sb-export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.onclick = () => {
      window.print(); // Browser native print matches the custom print stylesheet we'll add
    };
  }
}
