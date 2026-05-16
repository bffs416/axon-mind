import {
  supabase, N8N_URL, $, showToast, fireConfetti, initIcons,
  SRS_INTERVALS, MAX_SRS_LEVEL, SRS_XP, capitalizeFirstLetter, escHtml, POLYMATH_LEVELS,
  POLYGLOT_LANGUAGES
} from "./db.js";

window.allCards = [];
window.studyQueue = [];
window.currentCardIndex = -1;
window.currentFilter = 'All';

// ==================== SRS ALGORITHM (Graduated Intervals) ====================
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
window.studyStreakDays = parseInt(localStorage.getItem('axon_study_streak') || '0');

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
        
        const langMatch = Object.values(POLYGLOT_LANGUAGES).find(l => cat && cat.includes(l.name));
        const catColor = langMatch ? langMatch.color : 'var(--border)';
        const catIcon = langMatch ? langMatch.flag : '📂';
        
        html += `
            <div class="folder-group" style="margin-bottom: 1rem; width: 100%;">
                <details ${isOpen ? 'open' : ''} data-category="${cat}">
                    <summary style="display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-card); border-radius: 12px; cursor: pointer; font-weight: 600; border: 1px solid ${langMatch ? catColor : 'var(--border)'}; transition: all 0.2s ease;">
                        <span style="font-size: 1.2rem;">${catIcon}</span>
                        <span style="flex: 1;">${cat}</span>
                        <span class="category-badge" style="background: ${langMatch ? catColor : 'var(--accent)'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${cardsInCat.length}</span>
                    </summary>
                    <div class="folder-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; padding: 1rem 0;">
                        ${cardsInCat.map(card => {
                            const langMatch = Object.values(POLYGLOT_LANGUAGES).find(l => card.category && card.category.includes(l.name));
                            const cardColor = langMatch ? langMatch.color : 'var(--border)';
                            const cardStyle = langMatch ? `border-top: 3px solid ${cardColor};` : `border: 1px solid var(--border);`;
                            
                            return `
                            <div class="card-item" onclick="window.openCardModal('${card.id}')" style="background: var(--bg-card); border-radius: 12px; padding: 1rem; cursor: pointer; transition: transform 0.2s; ${cardStyle}">
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
                            `;
                        }).join('')}
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
window.userXP = parseInt(localStorage.getItem('axon_user_xp') || '0');

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

window.quickAddCard = async (front, back, category) => {
    const cardData = {
        front: capitalizeFirstLetter(front),
        back: capitalizeFirstLetter(back),
        category: category,
        srs_level: 0,
        reviews_count: 0,
        last_review: null,
        next_review: new Date().toISOString()
    };

    // Backup local
    const localCards = JSON.parse(localStorage.getItem('axon_cards_backup') || '[]');

    try {
        const { data, error } = await supabase.from('flashcards').insert([cardData]).select();
        if (error) throw error;

        if (data && data[0]) {
            cardData.id = data[0].id;
            localCards.push(cardData);
            localStorage.setItem('axon_cards_backup', JSON.stringify(localCards));
        }

        showToast(`💡 Card creada en ${category}`);
        window.loadCards();
    } catch (e) {
        console.error('Quick add error:', e);
        // Fallback local
        cardData.id = 'local_' + Date.now();
        cardData.created_at = new Date().toISOString();
        localCards.push(cardData);
        localStorage.setItem('axon_cards_backup', JSON.stringify(localCards));
        showToast('💾 Guardado localmente (DB offline)');
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

export { getPolymathLevel, getXPForNextLevel, checkLevelUp };
