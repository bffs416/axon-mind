
import { supabase, $, showToast, escHtml } from './db.js';
import { GUITAR_MASTER_CATALOG } from './guitar_catalog.js';

window.guitarState = {
  learnedIds: [],
  currentLesson: null,
  xp: 0,
  filterLevel: 'all'
};

export async function initGuitarModule() {
  const saved = localStorage.getItem('axon_guitar_progress');
  if (saved) {
    const data = JSON.parse(saved);
    window.guitarState.learnedIds = data.learnedIds || [];
    window.guitarState.xp = data.xp || 0;
  }
  updateGuitarDashboard();
  renderGuitarLessonList();
  initGuitarCanvasListeners();
}

function updateGuitarDashboard() {
  const lessons = window.guitarState.learnedIds;
  const scales = GUITAR_MASTER_CATALOG.filter(l => l.type === 'scale' && lessons.includes(l.id)).length;
  const triads = GUITAR_MASTER_CATALOG.filter(l => l.type === 'triad' && lessons.includes(l.id)).length;
  
  if ($('guitar-scales-count')) $('guitar-scales-count').textContent = scales;
  if ($('guitar-triads-count')) $('guitar-triads-count').textContent = triads;
  if ($('guitar-xp')) $('guitar-xp').textContent = window.guitarState.xp;
}

window.filterGuitarLevel = (lvl) => {
  window.guitarState.filterLevel = lvl;
  renderGuitarLessonList();
};

function renderGuitarLessonList() {
  const container = $('guitar-lesson-list');
  if (!container) return;

  const filtered = GUITAR_MASTER_CATALOG.filter(l => 
    window.guitarState.filterLevel === 'all' || l.level.toString() === window.guitarState.filterLevel
  );

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-dim);">No hay lecciones en este nivel todavía.</p>';
    return;
  }

  container.innerHTML = filtered.map(l => {
    const isLearned = window.guitarState.learnedIds.includes(l.id);
    return `
      <div class="polyglot-phrase-item ${isLearned ? 'mastered' : ''}" onclick="window.loadGuitarLesson('${l.id}')" style="cursor:pointer; border-left: 4px solid ${isLearned ? '#10b981' : '#3b82f6'};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; font-size:0.9rem;">${escHtml(l.name)}</div>
            <div style="font-size:0.7rem; color:var(--text-dim);">${escHtml(l.desc)}</div>
          </div>
          <div style="font-size:0.7rem; font-weight:700; color:var(--accent);">NIVEL ${l.level}</div>
        </div>
      </div>
    `;
  }).join('');
}

window.loadGuitarLesson = (id) => {
  const lesson = GUITAR_MASTER_CATALOG.find(l => l.id === id);
  if (!lesson) return;
  window.guitarState.currentLesson = lesson;
  
  $('guitar-fretboard-ref').textContent = lesson.name;
  $('guitar-theory-tip').textContent = lesson.desc;
  $('guitar-current-level').textContent = `Nivel ${lesson.level}`;
  
  window.clearGuitarCanvas();
  showToast(`🎸 Cargado: ${lesson.name}`);
};

// --- FRETBOARD CANVAS LOGIC ---
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let ctx = null;

function initGuitarCanvasListeners() {
  const canvas = $('guitar-fretboard-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  // High DPI support
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Touch support for S-Pen
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
}

function startDrawing(e) {
  isDrawing = true;
  const rect = e.target.getBoundingClientRect();
  [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
  
  // Drawing a point (dot)
  ctx.beginPath();
  ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5cf6';
  ctx.fill();
}

function draw(e) {
  if (!isDrawing) return;
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.beginPath();
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  [lastX, lastY] = [x, y];
}

function stopDrawing() { isDrawing = false; }

window.clearGuitarCanvas = () => {
  if (!ctx) return;
  const canvas = $('guitar-fretboard-canvas');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.checkGuitarPractice = () => {
  const lesson = window.guitarState.currentLesson;
  if (!lesson) { showToast('⚠️ Selecciona una lección primero'); return; }

  // Simple validation: if they drew something, we assume they practiced
  // (In a future version we could check coordinates against lesson.positions)
  window.guitarState.xp += 10;
  if (!window.guitarState.learnedIds.includes(lesson.id)) {
    window.guitarState.learnedIds.push(lesson.id);
  }
  
  localStorage.setItem('axon_guitar_progress', JSON.stringify({
    learnedIds: window.guitarState.learnedIds,
    xp: window.guitarState.xp
  }));
  
  updateGuitarDashboard();
  renderGuitarLessonList();
  showToast('👏 ¡Excelente práctica! +10 XP');
  
  // Confetti effect or similar could go here
};

window.openInspirarmeGuitarModal = () => {
    // Similar to Polyglot but for Guitar Master
    const nextIndex = window.guitarState.learnedIds.length;
    const lesson = GUITAR_MASTER_CATALOG[nextIndex] || GUITAR_MASTER_CATALOG[0];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center; padding: 2.5rem; background: var(--bg-card); border-radius: 20px;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎸</div>
            <h3 style="color:var(--accent);">Sugerencia Teórica</h3>
            <div style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">${escHtml(lesson.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 2rem;">${escHtml(lesson.desc)}</div>
            <button class="btn-primary" style="width: 100%;" onclick="this.closest('.modal').remove(); window.loadGuitarLesson('${lesson.id}');">
                🚀 Empezar Lección
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};
