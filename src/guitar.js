
import { supabase, $, showToast, escHtml } from './db.js';
import { GUITAR_MASTER_CATALOG } from './guitar_catalog.js';

window.guitarState = {
  learnedIds: [],
  currentLesson: null,
  xp: 0,
  filterLevel: 'all',
  selectedDots: [] // [{string, fret}]
};

export async function initGuitarModule() {
  const saved = localStorage.getItem('axon_guitar_progress');
  if (saved) {
    const data = JSON.parse(saved);
    window.guitarState.learnedIds = data.learnedIds || [];
    window.guitarState.xp = data.xp || 0;
  }
  
  drawFretboardUI();
  updateGuitarDashboard();
  renderGuitarLessonList();
}

function drawFretboardUI() {
  const fretsGroup = $('guitar-frets-group');
  const markersGroup = $('guitar-markers-group');
  const interactionLayer = $('guitar-interaction-layer');
  
  if (!fretsGroup) return;
  
  fretsGroup.innerHTML = '';
  markersGroup.innerHTML = '';
  interactionLayer.innerHTML = '';

  const fretCount = 15;
  const fretSpacing = 810 / fretCount;
  const stringsY = [15, 45, 75, 105, 135, 165]; // Y coordinates for 6 strings (1st to 6th)

  // Draw Frets
  for (let i = 1; i <= fretCount; i++) {
    const x = 40 + (i * fretSpacing);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', 180);
    line.setAttribute('stroke', '#475569');
    line.setAttribute('stroke-width', '2');
    fretsGroup.appendChild(line);

    // Fret numbers
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x - (fretSpacing/2));
    text.setAttribute('y', 195);
    text.setAttribute('fill', '#64748b');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = i;
    fretsGroup.appendChild(text);

    // Fret Markers (Dots on 3, 5, 7, 9, 12, 15)
    if ([3, 5, 7, 9, 15].includes(i)) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x - (fretSpacing/2));
      circle.setAttribute('cy', 90);
      circle.setAttribute('r', 5);
      circle.setAttribute('fill', 'rgba(255,255,255,0.1)');
      markersGroup.appendChild(circle);
    }
    if (i === 12) {
      // Double dot for 12th fret
      const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c1.setAttribute('cx', x - (fretSpacing/2));
      c1.setAttribute('cy', 45);
      c1.setAttribute('r', 5);
      c1.setAttribute('fill', 'rgba(255,255,255,0.1)');
      markersGroup.appendChild(c1);
      
      const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c2.setAttribute('cx', x - (fretSpacing/2));
      c2.setAttribute('cy', 135);
      c2.setAttribute('r', 5);
      c2.setAttribute('fill', 'rgba(255,255,255,0.1)');
      markersGroup.appendChild(c2);
    }
  }

  // Draw Interaction Zones (invisible rects for each fret/string)
  for (let f = 0; f <= fretCount; f++) {
    const xStart = f === 0 ? 35 : 40 + ((f - 1) * fretSpacing);
    const xEnd = f === 0 ? 40 : 40 + (f * fretSpacing);
    const width = xEnd - xStart;

    for (let s = 1; s <= 6; s++) {
      const y = stringsY[s-1] - 15;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xStart);
      rect.setAttribute('y', y);
      rect.setAttribute('width', width);
      rect.setAttribute('height', 30);
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('class', 'fret-zone');
      rect.onclick = () => window.toggleGuitarDot(s, f);
      interactionLayer.appendChild(rect);
    }
  }
}

window.toggleGuitarDot = (string, fret) => {
  const existingIndex = window.guitarState.selectedDots.findIndex(d => d.string === string && d.fret === fret);
  
  if (existingIndex > -1) {
    window.guitarState.selectedDots.splice(existingIndex, 1);
  } else {
    window.guitarState.selectedDots.push({ string, fret });
  }
  
  renderActiveDots();
};

function renderActiveDots() {
  const dotsGroup = $('guitar-dots-group');
  if (!dotsGroup) return;
  dotsGroup.innerHTML = '';

  const fretSpacing = 810 / 15;
  const stringsY = [15, 45, 75, 105, 135, 165];

  window.guitarState.selectedDots.forEach(dot => {
    const x = dot.fret === 0 ? 37.5 : 40 + (dot.fret * fretSpacing) - (fretSpacing/2);
    const y = stringsY[dot.string - 1];
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 10);
    circle.setAttribute('fill', '#8b5cf6');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2');
    circle.style.filter = 'drop-shadow(0 0 5px #8b5cf6)';
    dotsGroup.appendChild(circle);
  });
}

window.clearGuitarDots = () => {
  window.guitarState.selectedDots = [];
  renderActiveDots();
  hideFeedback();
};

window.validateGuitarSelection = () => {
  const lesson = window.guitarState.currentLesson;
  if (!lesson) { showToast('⚠️ Selecciona una lección primero'); return; }

  const correctPos = lesson.positions;
  const selected = window.guitarState.selectedDots;

  if (selected.length === 0) {
      showFeedback('❌ No has marcado ninguna nota.', 'error');
      return;
  }

  // Check if all selected are in correct and all correct are in selected
  const allCorrect = correctPos.every(cp => selected.some(s => s.string === cp.string && s.fret === cp.fret));
  const noExtras = selected.every(s => correctPos.some(cp => cp.string === s.string && cp.fret === s.fret));

  if (allCorrect && noExtras) {
    window.guitarState.xp += 25;
    if (!window.guitarState.learnedIds.includes(lesson.id)) {
      window.guitarState.learnedIds.push(lesson.id);
    }
    saveProgress();
    showFeedback('🎉 ¡Perfecto! Has memorizado la posición correctamente.', 'success');
    updateGuitarDashboard();
    renderGuitarLessonList();
    fireConfetti();
  } else {
    showFeedback('❌ Posición incorrecta. Revisa el diagrama e inténtalo de nuevo.', 'error');
  }
};

function showFeedback(text, type) {
  const panel = $('guitar-feedback-panel');
  const txt = $('guitar-feedback-text');
  const icon = $('guitar-feedback-icon');
  
  panel.style.display = 'block';
  txt.textContent = text;
  icon.textContent = type === 'success' ? '🎯' : '⚠️';
  panel.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
  panel.style.background = type === 'success' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)';
}

function hideFeedback() {
  const panel = $('guitar-feedback-panel');
  if (panel) panel.style.display = 'none';
}

function saveProgress() {
  localStorage.setItem('axon_guitar_progress', JSON.stringify({
    learnedIds: window.guitarState.learnedIds,
    xp: window.guitarState.xp
  }));
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
  window.guitarState.selectedDots = [];
  
  $('guitar-fretboard-ref').textContent = lesson.name;
  $('guitar-lesson-desc').textContent = lesson.desc;
  $('guitar-current-level').textContent = `Nivel ${lesson.level}`;
  
  renderActiveDots();
  hideFeedback();
  showToast(`🎸 Lección: ${lesson.name}`);
};

window.openInspirarmeGuitarModal = () => {
    const nextIndex = window.guitarState.learnedIds.length;
    const lesson = GUITAR_MASTER_CATALOG[nextIndex] || GUITAR_MASTER_CATALOG[0];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center; padding: 2.5rem; background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border);">
            <div style="font-size: 3rem; margin-bottom: 1.5rem;">🎸</div>
            <h3 style="color:var(--accent); letter-spacing:1px; text-transform:uppercase; font-size:0.9rem;">Siguiente Paso en tu Ruta</h3>
            <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color:var(--text);">${escHtml(lesson.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 2rem; line-height:1.4;">${escHtml(lesson.desc)}</div>
            <button class="btn-primary" style="width: 100%; padding: 14px; font-weight:700;" onclick="this.closest('.modal').remove(); window.loadGuitarLesson('${lesson.id}');">
                🚀 Empezar ahora
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};

function fireConfetti() {
    if (window.confetti) {
        window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}
