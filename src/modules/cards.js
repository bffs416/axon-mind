import { supabase, $, showToast, initIcons, capitalizeFirstLetter } from './config.js';

export function initCards() {
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
  
      // Capturar estados de expansión actuales de carpetas
      const openFolders = {};
      list.querySelectorAll('details').forEach(det => {
          const catName = det.dataset.category;
          if (catName) openFolders[catName] = det.open;
      });
  
      const categories = [...new Set(allCards.map(c => c.category || 'Sin Categoría'))];
      
      let html = '';
      
      categories.sort().forEach(cat => {
          const cardsInCat = allCards.filter(c => (c.category || 'Sin Categoría') === cat);
          const isOpen = openFolders[cat] !== undefined ? openFolders[cat] : false;
          
          html += `
              <div class="folder-group" style="margin-bottom: 1rem; width: 100%;">
                  <details ${isOpen ? 'open' : ''} data-category="${cat}">
                      <summary style="display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-card); border-radius: 12px; cursor: pointer; font-weight: 600; border: 1px solid var(--border); transition: all 0.2s ease;">
                          <span style="font-size: 1.2rem;">📂</span>
                          <span style="flex: 1;">${cat}</span>
                          <span class="category-badge" style="background: var(--accent); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${cardsInCat.length}</span>
                      </summary>
                      <div class="folder-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; padding: 1rem 0;">
                          ${cardsInCat.map(card => `
                              <div class="card-item" onclick="window.openCardModal('${card.id}')" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; cursor: pointer; transition: transform 0.2s;">
                                  <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">${card.front}</div>
                                  <div style="font-size: 0.8rem; color: var(--text-dim); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.7;">
                                      ${card.back}
                                  </div>
                                  <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                                      <span style="font-size: 0.6rem; color: var(--accent);">SRS Nivel: ${card.srs_level || 0}</span>
                                      <button class="btn-icon" onclick="event.stopPropagation(); window.deleteCard('${card.id}')" style="color: var(--danger); background:none; border:none; cursor:pointer;">
                                          <i data-lucide="trash-2" style="width: 14px;"></i>
                                      </button>
                                  </div>
                              </div>
                          `).join('')}
                      </div>
                  </details>
              </div>
          `;
      });
  
      list.innerHTML = html || '<p style="text-align:center; padding:2rem; opacity:0.5;">No hay tarjetas aún. ¡Crea tu primera carpeta!</p>';
      if (window.lucide) lucide.createIcons();
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
  
  window.clearAllCards = async () => {
      const key = prompt('🔑 Ingresa la clave para limpiar todas las tarjetas:');
      if (key !== '1629') {
          if (key !== null) showToast('🔒 Clave incorrecta');
          return;
      }
      if (!confirm('⚠️ ¿Seguro? Esto eliminará TODAS las tarjetas de estudio (no se puede deshacer).')) return;
  
      showToast('🗑️ Eliminando todas las tarjetas...');
  
      // Obtener todas las tarjetas de Supabase
      try {
          const { data } = await supabase.from('flashcards').select('id');
          if (data && data.length > 0) {
              const ids = data.map(c => c.id);
              const { error } = await supabase.from('flashcards').delete().in('id', ids);
              if (error) console.warn('Supabase delete error:', error.message);
          }
      } catch (e) { console.warn('Error fetching/deleting from Supabase:', e); }
  
      // Limpiar backup local
      localStorage.setItem('axon_cards_backup', '[]');
      allCards = [];
      window.loadCards();
      showToast('✅ Todas las tarjetas han sido eliminadas');
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
  
  window.processJsonCardImport = async () => {
      const input = $('json-import-input').value;
      const defaultCategory = $('json-import-category').value;
      const resultEl = $('json-import-result');
  
      if (!input || !input.trim()) {
          resultEl.innerHTML = '<span style="color:var(--danger);">⚠️ Pega JSON primero.</span>';
          return;
      }
  
      // Strip everything before first [ or { and after last ] or }
      let cleaned = input.trim();
      const firstOpen = Math.min(
          cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : Infinity,
          cleaned.indexOf('{') >= 0 ? cleaned.indexOf('{') : Infinity
      );
      if (firstOpen > 0 && isFinite(firstOpen)) cleaned = cleaned.slice(firstOpen);
      const lastClose = Math.max(
          cleaned.lastIndexOf(']'),
          cleaned.lastIndexOf('}')
      );
      if (lastClose > 0 && lastClose < cleaned.length - 1) cleaned = cleaned.slice(0, lastClose + 1);
  
      // Strip markdown code fences and clean
      if (/^```/i.test(cleaned)) {
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      }
      // Replace smart/curly quotes and other invisible chars that break JSON.parse
      cleaned = cleaned
          .replace(/[“”„‟″‶]/g, '"') // smart double quotes
          .replace(/[‘’‚‛′‵]/g, "'") // smart single quotes
          .replace(/ /g, ' ')   // non-breaking space
          .replace(/​/g, '')    // zero-width space
          .replace(/﻿/g, '');   // BOM
  
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

  return { loadCards: window.loadCards };
}
