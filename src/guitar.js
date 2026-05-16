
import { supabase, $, showToast, escHtml } from './db.js';
import { GUITAR_MASTER_CATALOG } from './guitar_catalog.js';

window.guitarState = {
  learnedIds: [],
  currentLesson: null,
  xp: 0,
  filterLevel: 'all',
  selectedDots: [],
  showHint: false
};

// --- AUDIO ENGINE ---
let audioCtx = null;
function playGuitarNote(string, fret) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const baseFreqs = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41]; // 1st to 6th string
  const freq = baseFreqs[string - 1] * Math.pow(2, fret / 12);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'triangle'; // Softer, more guitar-like than sine
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 1.5);
}

export async function initGuitarModule() {
  const saved = localStorage.getItem('axon_guitar_progress');
  if (saved) {
    const data = JSON.parse(saved);
    window.guitarState.learnedIds = data.learnedIds || [];
    window.guitarState.xp = data.xp || 0;
  }
  
  drawFretboardUI();
  drawCircleOfFifths();
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
  const stringsY = [15, 45, 75, 105, 135, 165];

  for (let i = 1; i <= fretCount; i++) {
    const x = 40 + (i * fretSpacing);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', 0);
    line.setAttribute('x2', x); line.setAttribute('y2', 180);
    line.setAttribute('stroke', '#475569'); line.setAttribute('stroke-width', '2');
    fretsGroup.appendChild(line);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x - (fretSpacing/2)); text.setAttribute('y', 195);
    text.setAttribute('fill', '#64748b'); text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle'); text.textContent = i;
    fretsGroup.appendChild(text);

    if ([3, 5, 7, 9, 15].includes(i)) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x - (fretSpacing/2)); circle.setAttribute('cy', 90);
      circle.setAttribute('r', 5); circle.setAttribute('fill', 'rgba(255,255,255,0.1)');
      markersGroup.appendChild(circle);
    }
    if (i === 12) {
      [45, 135].forEach(y => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', x - (fretSpacing/2)); c.setAttribute('cy', y);
        c.setAttribute('r', 5); c.setAttribute('fill', 'rgba(255,255,255,0.1)');
        markersGroup.appendChild(c);
      });
    }
  }

  for (let f = 0; f <= fretCount; f++) {
    const xStart = f === 0 ? 35 : 40 + ((f - 1) * fretSpacing);
    const width = f === 0 ? 5 : fretSpacing;
    for (let s = 1; s <= 6; s++) {
      const y = stringsY[s-1] - 15;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xStart); rect.setAttribute('y', y);
      rect.setAttribute('width', width); rect.setAttribute('height', 30);
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
    playGuitarNote(string, fret);
  }
  renderActiveDots();
  hideFeedback();
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
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 11);
    circle.setAttribute('fill', dot.status === 'correct' ? '#10b981' : dot.status === 'wrong' ? '#ef4444' : '#8b5cf6');
    circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '2');
    dotsGroup.appendChild(circle);

    // Note label
    if (dot.label || (window.guitarState.currentLesson?.positions.find(p => p.string === dot.string && p.fret === dot.fret)?.label)) {
      const label = dot.label || window.guitarState.currentLesson?.positions.find(p => p.string === dot.string && p.fret === dot.fret)?.label;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x); text.setAttribute('y', y + 4);
      text.setAttribute('fill', '#fff'); text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', '800'); text.setAttribute('text-anchor', 'middle');
      text.textContent = label;
      dotsGroup.appendChild(text);
    }
  });
}

window.toggleGuitarHint = () => {
  window.guitarState.showHint = !window.guitarState.showHint;
  const hintGroup = $('guitar-hints-group');
  if (!hintGroup) return;
  hintGroup.innerHTML = '';
  
  if (window.guitarState.showHint && window.guitarState.currentLesson) {
    const fretSpacing = 810 / 15;
    const stringsY = [15, 45, 75, 105, 135, 165];
    window.guitarState.currentLesson.positions.forEach(pos => {
      const x = pos.fret === 0 ? 37.5 : 40 + (pos.fret * fretSpacing) - (fretSpacing/2);
      const y = stringsY[pos.string - 1];
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 9);
      circle.setAttribute('fill', '#fff');
      hintGroup.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x); text.setAttribute('y', y + 3);
      text.setAttribute('fill', '#0f172a'); text.setAttribute('font-size', '8');
      text.setAttribute('font-weight', '900'); text.setAttribute('text-anchor', 'middle');
      text.textContent = pos.label;
      hintGroup.appendChild(text);
    });
  }
};

window.validateGuitarSelection = () => {
  const lesson = window.guitarState.currentLesson;
  if (!lesson) { showToast('⚠️ Selecciona una lección primero'); return; }

  const correctPos = lesson.positions;
  const selected = window.guitarState.selectedDots;

  if (selected.length === 0) { showFeedback('No has marcado ninguna nota.', 'error'); return; }

  let allCorrect = true;
  selected.forEach(s => {
    const isCorrect = correctPos.some(cp => cp.string === s.string && cp.fret === s.fret);
    s.status = isCorrect ? 'correct' : 'wrong';
    if (!isCorrect) allCorrect = false;
  });

  const missing = correctPos.some(cp => !selected.some(s => s.string === cp.string && s.fret === cp.fret));
  if (missing) allCorrect = false;

  renderActiveDots();

  if (allCorrect) {
    window.guitarState.xp += 25;
    if (!window.guitarState.learnedIds.includes(lesson.id)) window.guitarState.learnedIds.push(lesson.id);
    localStorage.setItem('axon_guitar_progress', JSON.stringify({ learnedIds: window.guitarState.learnedIds, xp: window.guitarState.xp }));
    showFeedback('¡Perfecto! Has memorizado la posición.', 'success');
    updateGuitarDashboard(); renderGuitarLessonList(); fireConfetti();
  } else {
    showFeedback('Hay errores en la posición. Los puntos rojos están mal ubicados.', 'error');
  }
};

function showFeedback(text, type) {
  const panel = $('guitar-feedback-panel');
  const txt = $('guitar-feedback-text');
  const title = $('guitar-feedback-title');
  const icon = $('guitar-feedback-icon');
  panel.style.display = 'block';
  txt.textContent = text;
  title.textContent = type === 'success' ? '¡Excelente!' : 'Casi...';
  icon.textContent = type === 'success' ? '🎯' : '⚠️';
  panel.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
}

function hideFeedback() {
  const panel = $('guitar-feedback-panel');
  if (panel) panel.style.display = 'none';
}

// --- CIRCLE OF FIFTHS ---
const FIFTHS_DATA = [
  { key: 'C', rel: 'Am', neighbors: ['F', 'G', 'Dm', 'Em'] },
  { key: 'G', rel: 'Em', neighbors: ['C', 'D', 'Am', 'Bm'] },
  { key: 'D', rel: 'Bm', neighbors: ['G', 'A', 'Em', 'F#m'] },
  { key: 'A', rel: 'F#m', neighbors: ['D', 'E', 'Bm', 'C#m'] },
  { key: 'E', rel: 'C#m', neighbors: ['A', 'B', 'F#m', 'G#m'] },
  { key: 'B', rel: 'G#m', neighbors: ['E', 'F#', 'C#m', 'D#m'] },
  { key: 'Gb', rel: 'Ebm', neighbors: ['B', 'Db', 'G#m', 'Bbm'] },
  { key: 'Db', rel: 'Bbm', neighbors: ['Gb', 'Ab', 'Ebm', 'Fm'] },
  { key: 'Ab', rel: 'Fm', neighbors: ['Db', 'Eb', 'Bbm', 'Cm'] },
  { key: 'Eb', rel: 'Cm', neighbors: ['Ab', 'Bb', 'Fm', 'Gm'] },
  { key: 'Bb', rel: 'Gm', neighbors: ['Eb', 'F', 'Cm', 'Dm'] },
  { key: 'F', rel: 'Dm', neighbors: ['Bb', 'C', 'Gm', 'Am'] }
];

function drawCircleOfFifths() {
  const container = $('circle-of-fifths-container');
  if (!container) return;
  
  const size = 250;
  const center = size / 2;
  const radius = 100;
  
  let html = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  
  FIFTHS_DATA.forEach((d, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    
    html += `
      <g style="cursor:pointer" onclick="window.selectCircleKey(${i})">
        <circle cx="${x}" cy="${y}" r="18" fill="var(--bg-card)" stroke="var(--border)" stroke-width="1" />
        <text x="${x}" y="${y+5}" fill="var(--text)" font-size="12" font-weight="700" text-anchor="middle">${d.key}</text>
      </g>
    `;
  });
  
  html += `</svg>`;
  container.innerHTML = html;
}

window.selectCircleKey = (idx) => {
  const d = FIFTHS_DATA[idx];
  $('circle-key-title').textContent = `Tonalidad: ${d.key} (${d.rel})`;
  $('circle-key-chords').innerHTML = [d.key, d.rel, ...d.neighbors].map(c => 
    `<span style="padding:4px 10px; background:var(--primary-low); border:1px solid var(--primary); border-radius:6px; font-size:0.75rem; font-weight:600;">${c}</span>`
  ).join('');
  showToast(`🎼 Tonalidad seleccionada: ${d.key}`);
};

// --- REST OF MODULE ---
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
  const filtered = GUITAR_MASTER_CATALOG.filter(l => window.guitarState.filterLevel === 'all' || l.level.toString() === window.guitarState.filterLevel);
  container.innerHTML = filtered.map(l => {
    const isLearned = window.guitarState.learnedIds.includes(l.id);
    return `<div class="polyglot-phrase-item ${isLearned ? 'mastered' : ''}" onclick="window.loadGuitarLesson('${l.id}')" style="cursor:pointer; border-left: 4px solid ${isLearned ? '#10b981' : '#3b82f6'};"><div style="display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:600; font-size:0.9rem;">${escHtml(l.name)}</div><div style="font-size:0.7rem; color:var(--text-dim);">${escHtml(l.desc)}</div></div><div style="font-size:0.7rem; font-weight:700; color:var(--accent);">NIVEL ${l.level}</div></div></div>`;
  }).join('');
}

window.loadGuitarLesson = (id) => {
  const lesson = GUITAR_MASTER_CATALOG.find(l => l.id === id);
  if (!lesson) return;
  window.guitarState.currentLesson = lesson;
  window.guitarState.selectedDots = [];
  window.guitarState.showHint = false;
  $('guitar-fretboard-ref').textContent = lesson.name;
  $('guitar-lesson-desc').textContent = lesson.desc;
  $('guitar-current-level').textContent = `Nivel ${lesson.level}`;
  renderActiveDots(); hideFeedback();
  const hintGroup = $('guitar-hints-group'); if (hintGroup) hintGroup.innerHTML = '';
  showToast(`🎸 Lección: ${lesson.name}`);
};

window.openInspirarmeGuitarModal = () => {
    const nextIndex = window.guitarState.learnedIds.length;
    const lesson = GUITAR_MASTER_CATALOG[nextIndex] || GUITAR_MASTER_CATALOG[0];
    const modal = document.createElement('div');
    modal.className = 'modal'; modal.style.display = 'flex';
    modal.innerHTML = `<div class="modal-content" style="max-width: 400px; text-align: center; padding: 2.5rem; background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border);"><div style="font-size: 3rem; margin-bottom: 1.5rem;">🎸</div><h3 style="color:var(--accent); letter-spacing:1px; text-transform:uppercase; font-size:0.9rem;">Siguiente Paso</h3><div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color:var(--text);">${escHtml(lesson.name)}</div><div style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 2rem; line-height:1.4;">${escHtml(lesson.desc)}</div><button class="btn-primary" style="width: 100%; padding: 14px; font-weight:700;" onclick="this.closest('.modal').remove(); window.loadGuitarLesson('${lesson.id}');">🚀 Empezar ahora</button></div>`;
    document.body.appendChild(modal);
};

window.clearGuitarDots = () => {
  window.guitarState.selectedDots = [];
  renderActiveDots(); hideFeedback();
};

function fireConfetti() {
  if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
}
