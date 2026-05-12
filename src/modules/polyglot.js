import { supabase, $, showToast, initIcons } from './config.js';
import { POLYGLOT_TRANSLATE_URL } from './config.js';

export function initPolyglot() {
  // ==================== POLYGLOT HUB ====================
  const POLYGLOT_LANGUAGES = {
    fr: { name: 'Francés', flag: '🇫🇷', tts: 'fr-FR' },
    pt: { name: 'Portugués', flag: '🇵🇹', tts: 'pt-PT' },
    de: { name: 'Alemán', flag: '🇩🇪', tts: 'de-DE' },
    hi: { name: 'Hindi', flag: '🇮🇳', tts: 'hi-IN' },
    ar: { name: 'Árabe', flag: '🇸🇦', tts: 'ar-SA' },
    ko: { name: 'Coreano', flag: '🇰🇷', tts: 'ko-KR' },
    zh: { name: 'Chino', flag: '🇨🇳', tts: 'zh-CN' }
  };
  const POLYGLOT_LANG_IDS = Object.keys(POLYGLOT_LANGUAGES);
  
  const POLYGLOT_ALPHABETS = {
    fr: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>À à Â â Æ æ Ç ç É é È è Ê ê Ë ë Î î Ï ï Ô ô Œ œ Ù ù Û û Ü ü' },
    pt: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>Á á Â â Ã ã À à Ç ç É é Ê ê Í í Ó ó Ô ô Õ õ Ú ú Ü ü' },
    de: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>Ä ä Ö ö Ü ü ß' },
    hi: { script: 'Devanagari', chars: 'अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह' },
    ar: { script: 'Árabe', chars: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي' },
    ko: { script: 'Hangul', chars: 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ<br>ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ' },
    zh: { script: 'Hanzi (Simplificado)', chars: '的 一 是 不 了 人 我 在 有 他 这 中 大 来 上 国 个 到 说 们 为 子 和 你 地 出 道 也 时 年 得 就 那 要 下 以 生 会 自 着 去 之 过 家 学 对 可 她 里 后 么 天 然 能 没 日 面 心 经 成 发 工 向 动 走 做 爱 开 手 分 长 水 头 机 当 住 部 打 党 方 又 白 如 前 所 定 见 月 把 但 信 使 全 女 数 注 公 很' }
  };
  
  window.polyglotState = {
    phrases: [],
    entries: [],
    config: null,
    filterLang: 'all',
    filterCat: 'all',
    searchQuery: '',
    sourceLanguage: 'es',
    studyQueue: [],
    currentStudyIndex: 0,
    chart: null
  };
  
  // ===== DATA FETCHING =====
  async function fetchPolyglotData() {
    const [phraseRes, entryRes, configRes] = await Promise.all([
      supabase.from('polyglot_phrases').select('*').order('created_at', { ascending: false }),
      supabase.from('polyglot_entries').select('*'),
      supabase.from('polyglot_config').select('*')
    ]);
    if (phraseRes.data) window.polyglotState.phrases = phraseRes.data;
    if (entryRes.data) window.polyglotState.entries = entryRes.data;
    if (configRes.data && configRes.data.length > 0) {
      window.polyglotState.config = configRes.data[0];
      window.polyglotState.sourceLanguage = configRes.data[0].source_language || 'es';
    }
  
    // Populate category filter
    const catFilter = $('polyglot-cat-filter');
    if (catFilter) {
      const cats = [...new Set(window.polyglotState.phrases.map(p => p.category).filter(Boolean))];
      catFilter.innerHTML = '<option value="all">Todas las categorías</option>' +
        cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
    }
  
    renderPolyglotDashboard();
    renderPhraseList();
  }
  
  // ===== DASHBOARD =====
  function renderPolyglotDashboard() {
    const phrases = window.polyglotState.phrases;
    const entries = window.polyglotState.entries;
  
    // Stats
    const phraseCount = $('polyglot-phrase-count');
    if (phraseCount) phraseCount.textContent = phrases.length;
  
    // Pending: entries due for review
    const now = new Date();
    const pending = entries.filter(e => new Date(e.next_review) <= now && e.srs_level < 6);
    const pendingEl = $('polyglot-pending-count');
    if (pendingEl) pendingEl.textContent = pending.length;
  
    // Mastered: entries at level 6
    const mastered = entries.filter(e => e.srs_level >= 6);
    const masteredEl = $('polyglot-mastered-count');
    if (masteredEl) masteredEl.textContent = mastered.length;
  
    // Progress per language for radar
    const langProgress = {};
    POLYGLOT_LANG_IDS.forEach(id => {
      const langEntries = entries.filter(e => e.language_id === id);
      const avgLevel = langEntries.length > 0
        ? langEntries.reduce((s, e) => s + (e.srs_level || 0), 0) / langEntries.length
        : 0;
      langProgress[id] = Math.round(avgLevel * 100 / 6); // percentage
    });
  
    // Radar chart
    const canvas = document.getElementById('polyglot-radar-chart');
    if (canvas && typeof Chart !== 'undefined') {
      if (window.polyglotState.chart) {
        window.polyglotState.chart.destroy();
      }
      const ctx = canvas.getContext('2d');
      window.polyglotState.chart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: POLYGLOT_LANG_IDS.map(id => POLYGLOT_LANGUAGES[id].flag + ' ' + POLYGLOT_LANGUAGES[id].name),
          datasets: [{
            label: 'Progreso',
            data: POLYGLOT_LANG_IDS.map(id => langProgress[id]),
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            borderColor: '#8b5cf6',
            borderWidth: 2,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#fff',
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: { display: false },
              grid: { color: 'rgba(255,255,255,0.05)' },
              angleLines: { color: 'rgba(255,255,255,0.05)' },
              pointLabels: { color: '#64748b', font: { size: 9 } }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  
    // Daily language suggestion
    suggestDailyLanguage(entries);
  }
  
  function suggestDailyLanguage(entries) {
    const el = $('polyglot-daily-lang-name');
    const reasonEl = $('polyglot-daily-lang-reason');
    if (!el) return;
  
    const today = new Date().toDateString();
    const cached = localStorage.getItem('polyglot_daily_lang');
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (c.date === today) {
          el.textContent = POLYGLOT_LANGUAGES[c.lang]?.flag + ' ' + POLYGLOT_LANGUAGES[c.lang]?.name;
          if (reasonEl) reasonEl.textContent = c.reason;
          return;
        }
      } catch(e) {}
    }
  
    // Find weakest language: lowest avg SRS with most pending
    let weakest = POLYGLOT_LANG_IDS[0];
    let weakestScore = Infinity;
    const now = new Date();
    POLYGLOT_LANG_IDS.forEach(id => {
      const langEntries = entries.filter(e => e.language_id === id);
      const pendingCount = langEntries.filter(e => new Date(e.next_review) <= now).length;
      const avgLevel = langEntries.length > 0
        ? langEntries.reduce((s, e) => s + (e.srs_level || 0), 0) / langEntries.length
        : 0;
      const score = avgLevel - (pendingCount * 0.1); // bias towards pending
      if (score < weakestScore) {
        weakestScore = score;
        weakest = id;
      }
    });
  
    const reasons = [
      'tiene más repasos pendientes',
      'necesitas reforzarlo',
      'es el que menos práctica tiene',
      'toca ponerse al día'
    ];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    el.textContent = POLYGLOT_LANGUAGES[weakest].flag + ' ' + POLYGLOT_LANGUAGES[weakest].name;
    if (reasonEl) reasonEl.textContent = '💡 ' + reason;
  
    localStorage.setItem('polyglot_daily_lang', JSON.stringify({ date: today, lang: weakest, reason }));
  }
  
  // ===== PHRASE LIST =====
  function renderPhraseList() {
    const list = $('polyglot-phrase-list');
    if (!list) return;
  
    let filtered = [...window.polyglotState.phrases];
    const entries = window.polyglotState.entries;
  
    // Filter by language
    if (window.polyglotState.filterLang !== 'all') {
      const phraseIdsWithLang = entries.filter(e => e.language_id === window.polyglotState.filterLang).map(e => e.phrase_id);
      filtered = filtered.filter(p => phraseIdsWithLang.includes(p.id));
    }
  
    // Filter by category
    if (window.polyglotState.filterCat !== 'all') {
      filtered = filtered.filter(p => p.category === window.polyglotState.filterCat);
    }
  
    // Search
    if (window.polyglotState.searchQuery) {
      const q = window.polyglotState.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.source_es || '').toLowerCase().includes(q) ||
        (p.source_en || '').toLowerCase().includes(q)
      );
    }
  
    if (filtered.length === 0) {
      list.innerHTML = '<div class="finance-empty">🌍 No hay frases aún. ¡Crea tu primera frase para aprender!</div>';
      return;
    }
  
    list.innerHTML = filtered.map(p => {
      const phraseEntries = entries.filter(e => e.phrase_id === p.id);
      const masteredCount = phraseEntries.filter(e => e.srs_level >= 6).length;
      const sourceText = window.polyglotState.sourceLanguage === 'en' && p.source_en ? p.source_en : p.source_es;
      const sourceLabel = window.polyglotState.sourceLanguage === 'en' ? '🇬🇧' : '🇪🇸';
  
      return `
        <div class="polyglot-phrase-item">
          <div class="polyglot-phrase-source">
            <div class="polyglot-phrase-source-text">${escHtml(sourceText)}</div>
            <div class="polyglot-phrase-source-lang">${sourceLabel} · ${p.category || 'General'} · ${masteredCount}/${POLYGLOT_LANG_IDS.length} dominados</div>
          </div>
          <div class="polyglot-phrase-langs">
            ${POLYGLOT_LANG_IDS.map(id => {
              const e = phraseEntries.find(ent => ent.language_id === id);
              const cls = e && e.srs_level >= 6 ? 'mastered' : '';
              return `<span class="polyglot-phrase-lang-dot ${cls}" title="${POLYGLOT_LANGUAGES[id].name}${e ? ' Nivel ' + e.srs_level : ''}">${POLYGLOT_LANGUAGES[id].flag}</span>`;
            }).join('')}
          </div>
          <div class="polyglot-phrase-actions">
            <button class="finance-tx-action" onclick="window.editPolyglotPhrase('${p.id}')" title="Editar">✏️</button>
            <button class="finance-tx-action" onclick="window.deletePolyglotPhrase('${p.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // ===== FILTERS =====
  window.filterPolyglotLang = (lang, btn) => {
    window.polyglotState.filterLang = lang;
    document.querySelectorAll('.polyglot-lang-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPhraseList();
  };
  window.filterPolyglotCategory = (cat) => {
    window.polyglotState.filterCat = cat;
    renderPhraseList();
  };
  window.filterPolyglotSearch = (q) => {
    window.polyglotState.searchQuery = q;
    renderPhraseList();
  };
  
  // ===== PHRASE CRUD =====
  window.openPolyglotPhraseModal = async (id) => {
    const modal = $('polyglot-phrase-modal');
    if (!modal) return;
  
    if (id) {
      $('polyglot-phrase-modal-title').textContent = '✏️ Editar Frase';
      const p = window.polyglotState.phrases.find(x => x.id === id);
      if (!p) return;
      $('edit-polyglot-phrase-id').value = id;
      $('polyglot-source-es').value = p.source_es || '';
      $('polyglot-source-en').value = p.source_en || '';
      $('polyglot-phrase-category').value = p.category || 'General';
  
      // Load entries for this phrase
      const { data: phraseEntries } = await supabase.from('polyglot_entries').select('*').eq('phrase_id', id);
      renderLangAccordion(phraseEntries || []);
    } else {
      $('polyglot-phrase-modal-title').textContent = '🌍 Nueva Frase';
      $('edit-polyglot-phrase-id').value = '';
      $('polyglot-source-es').value = '';
      $('polyglot-source-en').value = '';
      $('polyglot-phrase-category').value = 'Saludos';
      renderLangAccordion([]);
    }
    modal.style.display = 'flex';
  };
  
  function renderLangAccordion(existingEntries) {
    const container = $('polyglot-lang-accordion');
    if (!container) return;
  
    container.innerHTML = POLYGLOT_LANG_IDS.map(id => {
      const lang = POLYGLOT_LANGUAGES[id];
      const entry = existingEntries.find(e => e.language_id === id);
      const native = entry ? entry.native_text : '';
      const phonetic = entry ? entry.phonetic : '';
      const literal = entry ? entry.literal_translation : '';
      const natural = entry ? entry.natural_translation : '';
      const hasData = native || phonetic || literal || natural;
  
      return `
        <details class="polyglot-lang-entry-form" ${hasData ? 'open' : ''}>
          <summary>${lang.flag} ${lang.name} ${hasData ? '✅' : '⬜'}</summary>
          <div class="form-body">
            <input type="hidden" class="pe-lang-id" value="${id}">
            <div class="form-row">
              <label class="input-label">🔤 Escritura nativa</label>
              <input type="text" class="finance-input pe-native" value="${escHtml(native)}" placeholder="Texto en ${lang.name}...">
            </div>
            <div class="form-row">
              <label class="input-label">🎤 Fonética / Romanización</label>
              <input type="text" class="finance-input pe-phonetic" value="${escHtml(phonetic)}" placeholder="Ej: Bonjour, Nǐ hǎo...">
            </div>
            <div class="form-row">
              <label class="input-label">📖 Traducción literal (palabra x palabra)</label>
              <input type="text" class="finance-input pe-literal" value="${escHtml(literal)}" placeholder="Ej: Good morning, how you are?">
            </div>
            <div class="form-row">
              <label class="input-label">💬 Traducción natural</label>
              <input type="text" class="finance-input pe-natural" value="${escHtml(natural)}" placeholder="Significado real en español/inglés...">
            </div>
          </div>
        </details>
      `;
    }).join('');
  }
  
  window.savePolyglotPhrase = async () => {
    const id = $('edit-polyglot-phrase-id').value;
    const source_es = $('polyglot-source-es').value.trim();
    const source_en = $('polyglot-source-en').value.trim();
    const category = $('polyglot-phrase-category').value;
  
    if (!source_es) { showToast('⚠️ La frase en español es obligatoria'); return; }
  
    let phraseId = id;
  
    if (id) {
      const { error } = await supabase.from('polyglot_phrases').update({ source_es, source_en, category }).eq('id', id);
      if (error) { showToast('⚠️ Error frase: ' + error.message); console.error(error); return; }
    } else {
      const { data, error } = await supabase.from('polyglot_phrases').insert([{ source_es, source_en, category }]).select().single();
      if (error) { showToast('⚠️ Error frase: ' + error.message); console.error(error); return; }
      phraseId = data.id;
    }
  
    // Save entries
    const entryInputs = document.querySelectorAll('.polyglot-lang-entry-form');
    for (const details of entryInputs) {
      const langId = details.querySelector('.pe-lang-id')?.value;
      if (!langId) continue;
      const native = details.querySelector('.pe-native')?.value?.trim() || '';
      const phonetic = details.querySelector('.pe-phonetic')?.value?.trim() || '';
      const literal = details.querySelector('.pe-literal')?.value?.trim() || '';
      const natural = details.querySelector('.pe-natural')?.value?.trim() || '';
  
      const existing = window.polyglotState.entries.find(e => e.phrase_id === phraseId && e.language_id === langId);
  
      if (existing) {
        const { error } = await supabase.from('polyglot_entries').update({
          native_text: native, phonetic, literal_translation: literal, natural_translation: natural
        }).eq('id', existing.id);
        if (error) { showToast('⚠️ Error entrada: ' + error.message); console.error(error); return; }
      } else if (native || phonetic || literal || natural) {
        const { error } = await supabase.from('polyglot_entries').insert([{
          phrase_id: phraseId, language_id: langId,
          native_text: native, phonetic, literal_translation: literal, natural_translation: natural,
          srs_level: 0, next_review: new Date().toISOString()
        }]);
        if (error) { showToast('⚠️ Error entrada: ' + error.message); console.error(error); return; }
      }
    }
  
    showToast(id ? '✅ Frase actualizada' : '✅ Frase creada');
    window.closeModal('polyglot-phrase-modal');
    fetchPolyglotData();
  };
  
  window.editPolyglotPhrase = (id) => window.openPolyglotPhraseModal(id);
  
  window.deletePolyglotPhrase = async (id) => {
    if (!confirm('¿Eliminar esta frase y todas sus traducciones?')) return;
    const { error } = await supabase.from('polyglot_phrases').delete().eq('id', id);
    if (error) { showToast('⚠️ Error al eliminar'); return; }
    showToast('🗑️ Frase eliminada');
    fetchPolyglotData();
  };
  
  // ===== AUTO-TRANSLATE WITH N8N =====
  window.translatePolyglotPhrase = async () => {
    const source_es = $('polyglot-source-es')?.value?.trim();
    const source_en = $('polyglot-source-en')?.value?.trim();
    if (!source_es && !source_en) { showToast('⚠️ Escribe la frase en español o inglés primero'); return; }
  
    const btn = $('polyglot-translate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Traduciendo...'; }
  
    try {
      const response = await fetch(POLYGLOT_TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_es, source_en })
      });
  
      if (!response.ok) throw new Error('HTTP ' + response.status);
  
      const data = await response.json();
  
      // Fill the accordion fields
      let filled = 0;
      const translationMap = Array.isArray(data) ? data[0] : data;
      for (const [langId, translations] of Object.entries(translationMap)) {
        const details = document.querySelector(`.polyglot-lang-entry-form summary`);
        // Find the details element for this language
        const allDetails = document.querySelectorAll('.polyglot-lang-entry-form');
        for (const d of allDetails) {
          const langInput = d.querySelector('.pe-lang-id');
          if (langInput && langInput.value === langId) {
            const nativeInput = d.querySelector('.pe-native');
            const phoneticInput = d.querySelector('.pe-phonetic');
            const literalInput = d.querySelector('.pe-literal');
            const naturalInput = d.querySelector('.pe-natural');
  
            if (translations.native_text && nativeInput) {
              nativeInput.value = translations.native_text;
              filled++;
            }
            if (translations.phonetic && phoneticInput) {
              phoneticInput.value = translations.phonetic;
              filled++;
            }
            if (translations.literal_translation && literalInput) {
              literalInput.value = translations.literal_translation;
              filled++;
            }
            if (translations.natural_translation && naturalInput) {
              naturalInput.value = translations.natural_translation;
              filled++;
            }
  
            // Open this accordion
            d.setAttribute('open', '');
            break;
          }
        }
      }
  
      showToast(`✅ ${filled} campos traducidos. Revisa antes de guardar.`);
    } catch (e) {
      console.error('Translation error:', e);
      showToast('⚠️ Error al traducir. ¿El webhook de n8n está activo?');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Traducir con IA'; }
    }
  };
  
  // ===== STUDY =====
  window.startPolyglotStudy = () => {
    const entries = window.polyglotState.entries;
    if (entries.length === 0) { showToast('🌍 Crea algunas frases primero'); return; }
  
    const now = new Date();
    // Build queue: phrases that have at least one entry due or not mastered
    const due = entries.filter(e => new Date(e.next_review) <= now || e.srs_level < 6);
  
    if (due.length === 0) { showToast('🎉 Todo revisado por hoy. ¡Buen trabajo!'); return; }
  
    // Group by phrase, prioritize phrases with most due entries
    const phraseDue = {};
    due.forEach(e => {
      if (!phraseDue[e.phrase_id]) phraseDue[e.phrase_id] = [];
      phraseDue[e.phrase_id].push(e);
    });
  
    // Sort: phrases with most due entries first
    const sortedPhrases = Object.entries(phraseDue)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([phraseId]) => phraseId);
  
    window.polyglotState.studyQueue = sortedPhrases;
    window.polyglotState.currentStudyIndex = 0;
  
    const modal = $('polyglot-study-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderPolyglotStudyCard();
  };
  
  function renderPolyglotStudyCard() {
    const queue = window.polyglotState.studyQueue;
    const idx = window.polyglotState.currentStudyIndex;
  
    if (idx >= queue.length) {
      showToast('🎉 ¡Estudio completado por hoy!');
      window.closePolyglotStudy();
      fetchPolyglotData();
      return;
    }
  
    const phraseId = queue[idx];
    const phrase = window.polyglotState.phrases.find(p => p.id === phraseId);
    if (!phrase) { window.polyglotState.currentStudyIndex++; renderPolyglotStudyCard(); return; }
  
    // Progress
    const progress = $('polyglot-study-progress');
    if (progress) progress.textContent = `${idx + 1} / ${queue.length}`;
  
    // Source phrase
    const source = $('polyglot-study-source');
    const sourceLangLabel = window.polyglotState.sourceLanguage === 'en' ? '🇬🇧 Inglés' : '🇪🇸 Español';
    const sourceText = window.polyglotState.sourceLanguage === 'en' && phrase.source_en ? phrase.source_en : phrase.source_es;
    if (source) {
      source.innerHTML = `${escHtml(sourceText)} <small>${sourceLangLabel} · ${phrase.category || 'General'}</small>`;
    }
  
    const sourceLangEl = $('polyglot-study-source-lang');
    if (sourceLangEl) sourceLangEl.textContent = sourceLangLabel;
  
    // Language grid
    const grid = $('polyglot-study-lang-grid');
    if (!grid) return;
  
    const phraseEntries = window.polyglotState.entries.filter(e => e.phrase_id === phraseId);
  
    grid.innerHTML = POLYGLOT_LANG_IDS.map(id => {
      const lang = POLYGLOT_LANGUAGES[id];
      const entry = phraseEntries.find(e => e.language_id === id);
      const level = entry ? entry.srs_level || 0 : 0;
      const isDue = entry && new Date(entry.next_review) <= new Date();
      const statusText = !entry ? 'Sin traducción' : level >= 6 ? '✅ Dominado' : isDue ? '📝 Pendiente' : `Nv. ${level}`;
      const levelLabel = level >= 6 ? '✅' : level >= 4 ? '💪' : level >= 2 ? '📖' : '🆕';
  
      return `
        <div class="polyglot-lang-card ${entry && entry.native_text ? '' : ''}" data-lang="${id}" data-entry-id="${entry ? entry.id : ''}" data-phrase-id="${phraseId}" onclick="window.togglePolyglotLang(this)">
          <div class="polyglot-lang-card-header">
            <span class="polyglot-lang-card-flag">${lang.flag}</span>
            <span class="polyglot-lang-card-name">${lang.name}</span>
            <span class="polyglot-lang-card-level">${levelLabel}</span>
          </div>
          <div class="polyglot-lang-card-status">${statusText}</div>
          <div class="polyglot-lang-layers" style="display:none;">
            ${entry ? `
              <div class="polyglot-layer" data-layer="native">
                <div class="polyglot-layer-label">🔤 Nativo</div>
                <div class="polyglot-layer-text">${entry.native_text || '—'}</div>
              </div>
              <div class="polyglot-layer" data-layer="phonetic">
                <div class="polyglot-layer-label">
                  🎤 Fonética
                  <button class="polyglot-layer-toggle" onclick="event.stopPropagation();window.togglePolyglotLayer(this)">👁️</button>
                </div>
                <div class="polyglot-layer-text">${entry.phonetic || '—'}</div>
              </div>
              <div class="polyglot-layer" data-layer="literal">
                <div class="polyglot-layer-label">
                  📖 Literal
                  <button class="polyglot-layer-toggle" onclick="event.stopPropagation();window.togglePolyglotLayer(this)">👁️</button>
                </div>
                <div class="polyglot-layer-text">${entry.literal_translation || '—'}</div>
              </div>
              <div class="polyglot-layer" data-layer="natural">
                <div class="polyglot-layer-label">
                  💬 Natural
                  <button class="polyglot-layer-toggle" onclick="event.stopPropagation();window.togglePolyglotLayer(this)">👁️</button>
                </div>
                <div class="polyglot-layer-text">${entry.natural_translation || '—'}</div>
              </div>
              <div style="display:flex;gap:0.3rem;margin-top:0.3rem;align-items:center;flex-wrap:wrap;">
                <button class="polyglot-audio-btn" onclick="event.stopPropagation();window.playPolyglotAudio('${escHtml(entry.native_text || entry.phonetic)}','${id}')" title="Escuchar pronunciación">▶️ Audio</button>
                <button class="polyglot-audio-btn" onclick="event.stopPropagation();window.togglePolyglotWriting(this,'${id}','${escHtml(entry.native_text || '')}')" title="Practicar escritura con S-Pen">🖊️ Escribir</button>
              </div>
              <div class="polyglot-canvas-container" style="display:none;" data-lang="${id}">
                <canvas class="polyglot-canvas"></canvas>
                <div class="polyglot-canvas-toolbar">
                  <span style="font-size:0.55rem;color:var(--text-dim);flex:1;">Practica con el S-Pen ✍️</span>
                  <button class="polyglot-canvas-btn" onclick="event.stopPropagation();window.clearPolyglotCanvas(this)">🗑️ Limpiar</button>
                </div>
              </div>
            ` : '<div style="font-size:0.65rem;color:var(--text-muted);">Agrega traducción desde el editor</div>'}
          </div>
          ${entry && entry.native_text ? `
          <div class="polyglot-srs-row" style="display:none;">
            <button class="polyglot-srs-btn hard" onclick="event.stopPropagation();window.answerPolyglotEntry('${entry.id}','difficult', this)" data-difficulty="difficult">😰 Difícil</button>
            <button class="polyglot-srs-btn medium" onclick="event.stopPropagation();window.answerPolyglotEntry('${entry.id}','good', this)" data-difficulty="good">🙂 Media</button>
            <button class="polyglot-srs-btn easy" onclick="event.stopPropagation();window.answerPolyglotEntry('${entry.id}','easy', this)" data-difficulty="easy">😄 Fácil</button>
          </div>` : ''}
        </div>
      `;
    }).join('');
  }
  
  // Reveal/collapse language in study
  window.togglePolyglotLang = (card) => {
    const layers = card.querySelector('.polyglot-lang-layers');
    const srs = card.querySelector('.polyglot-srs-row');
    if (!layers) return;
  
    const isRevealed = card.classList.contains('revealed');
    card.classList.toggle('revealed');
  
    if (isRevealed) {
      layers.style.display = 'none';
      if (srs) srs.style.display = 'none';
    } else {
      layers.style.display = 'flex';
      layers.style.flexDirection = 'column';
      layers.style.gap = '0.25rem';
      if (srs) srs.style.display = 'flex';
    }
  };
  
  // Toggle individual layer (hide/show to force memory)
  window.togglePolyglotLayer = (btn) => {
    const layer = btn.closest('.polyglot-layer');
    if (layer) {
      layer.classList.toggle('hidden');
      btn.textContent = layer.classList.contains('hidden') ? '🙈' : '👁️';
    }
  };
  
  // Play TTS audio
  window.playPolyglotAudio = (text, langId) => {
    if (!text || text === '—') return;
    if (!window.speechSynthesis) { showToast('⚠️ TTS no disponible en este navegador'); return; }
  
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
  
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = POLYGLOT_LANGUAGES[langId]?.tts || langId;
    utterance.rate = 0.85; // slightly slower for learning
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };
  
  // Toggle writing canvas (S-Pen)
  window.togglePolyglotWriting = (btn, langId, refText) => {
    const card = btn.closest('.polyglot-lang-card');
    if (!card) return;
    const container = card.querySelector('.polyglot-canvas-container');
    if (!container) return;
  
    const isVisible = container.style.display !== 'none';
    if (isVisible) {
      container.style.display = 'none';
      btn.textContent = '🖊️ Escribir';
      return;
    }
  
    container.style.display = 'block';
    btn.textContent = '🖊️ Ocultar';
  
    // Replace reference text
    let refEl = container.querySelector('.polyglot-canvas-ref');
    if (refText && !refEl) {
      refEl = document.createElement('div');
      refEl.className = 'polyglot-canvas-ref';
      refEl.textContent = refText;
      container.insertBefore(refEl, container.querySelector('canvas'));
    } else if (refEl) {
      refEl.textContent = refText || '';
    }
  
    // Init canvas
    const canvas = container.querySelector('canvas');
    if (canvas && !canvas.dataset.initialized) {
      canvas.dataset.initialized = 'true';
      initPolyglotCanvas(canvas);
    }
  };
  
  window.clearPolyglotCanvas = (btn) => {
    const container = btn.closest('.polyglot-canvas-container');
    if (!container) return;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim() || '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  
  function initPolyglotCanvas(canvas) {
    let drawing = false;
    const ctx = canvas.getContext('2d');
    let lastX = 0, lastY = 0;
  
    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Redraw with background
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim() || '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw light grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }
  
    resize();
    window.addEventListener('resize', resize);
  
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX || e.pageX) - rect.left, y: (e.clientY || e.pageY) - rect.top };
    }
  
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      const pos = getPos(e);
      lastX = pos.x; lastY = pos.y;
      canvas.setPointerCapture(e.pointerId);
    });
  
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = pos.x; lastY = pos.y;
    });
  
    canvas.addEventListener('pointerup', () => { drawing = false; });
    canvas.addEventListener('pointerleave', () => { drawing = false; });
  }
  
  // SRS for individual entry
  window.answerPolyglotEntry = async (entryId, difficulty, btn) => {
    const entry = window.polyglotState.entries.find(e => e.id === entryId);
    if (!entry) return;
  
    // Mark selected
    const card = btn.closest('.polyglot-lang-card');
    card.querySelectorAll('.polyglot-srs-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  
    // SRS computation (same logic as existing flashcards)
    let newLevel = entry.srs_level || 0;
    let intervalDays = 0;
  
    if (difficulty === 'difficult') {
      newLevel = Math.max(0, newLevel - 1);
      intervalDays = 0;
    } else if (difficulty === 'good') {
      newLevel = Math.min(6, newLevel + 1);
      intervalDays = [0.00694, 1, 3, 7, 14, 30, 90][newLevel] || 1;
    } else { // easy
      newLevel = Math.min(6, newLevel + 2);
      intervalDays = [0.00694, 1, 3, 7, 14, 30, 90][newLevel] || 3;
    }
  
    const nextReview = new Date();
    if (intervalDays < 1) {
      nextReview.setMinutes(nextReview.getMinutes() + 10);
    } else {
      nextReview.setDate(nextReview.getDate() + intervalDays);
    }
  
    // Update Supabase
    const updates = {
      srs_level: newLevel,
      next_review: nextReview.toISOString(),
      reviews_count: (entry.reviews_count || 0) + 1,
      last_review: new Date().toISOString(),
      last_interval: intervalDays
    };
    await supabase.from('polyglot_entries').update(updates).eq('id', entryId);
  
    // Update local state
    Object.assign(entry, updates);
    const xpGain = difficulty === 'difficult' ? 10 : difficulty === 'good' ? 5 : 2;
    showToast(`${POLYGLOT_LANGUAGES[entry.language_id]?.flag || ''} ${difficulty === 'difficult' ? '😰' : difficulty === 'good' ? '🙂' : '😄'} +${xpGain} XP`);
  
    // Auto-collapse and move to next after brief delay
    setTimeout(() => {
      card.classList.remove('revealed');
      const layers = card.querySelector('.polyglot-lang-layers');
      const srsRow = card.querySelector('.polyglot-srs-row');
      if (layers) layers.style.display = 'none';
      if (srsRow) srsRow.style.display = 'none';
    }, 600);
  };
  
  // Navigation
  window.nextPolyglotCard = () => {
    window.polyglotState.currentStudyIndex++;
    renderPolyglotStudyCard();
  };
  window.prevPolyglotCard = () => {
    if (window.polyglotState.currentStudyIndex > 0) {
      window.polyglotState.currentStudyIndex--;
      renderPolyglotStudyCard();
    }
  };
  window.closePolyglotStudy = () => {
    window.closeModal('polyglot-study-modal');
    fetchPolyglotData();
  };
  
  // ===== ALPHABETS =====
  window.openPolyglotAlphabets = () => {
    const modal = $('polyglot-alphabet-modal');
    const content = $('polyglot-alphabet-content');
    if (!modal || !content) return;
  
    content.innerHTML = `<div class="polyglot-alphabet-list">
      ${POLYGLOT_LANG_IDS.map(id => {
        const a = POLYGLOT_ALPHABETS[id];
        const lang = POLYGLOT_LANGUAGES[id];
        const chars = a.chars.split('<br>').map(line =>
          line.split(' ').filter(Boolean).map(ch =>
            `<span class="polyglot-alphabet-char" title="${ch}">${ch}</span>`
          ).join('')
        ).join('<br>');
        return `
          <div class="polyglot-alphabet-lang">
            <h4>${lang.flag} ${lang.name} <span style="font-weight:400;font-size:0.65rem;color:var(--text-dim);">(${a.script})</span></h4>
            <div style="font-size:0.65rem; color:var(--text-dim); margin-bottom:0.3rem;">
              ${id === 'zh' ? 'Caracteres comunes (frecuencia):' : 'Alfabeto:'}
            </div>
            <div>${chars}</div>
          </div>
        `;
      }).join('')}
    </div>`;
  
    modal.style.display = 'flex';
  };
  
  // ===== CONFIG =====
  window.openPolyglotConfig = async () => {
    const modal = $('polyglot-config-modal');
    if (!modal) return;
  
    // Load current config
    const { data: configs } = await supabase.from('polyglot_config').select('*');
    const cfg = configs && configs.length > 0 ? configs[0] : null;
  
    if (cfg) {
      $('polyglot-config-profile').value = cfg.profile || 'Pipe';
      $('polyglot-config-source').value = cfg.source_language || 'es';
    }
  
    // Render lang order
    const orderContainer = $('polyglot-config-lang-order');
    if (orderContainer) {
      const order = (cfg?.preferred_languages || POLYGLOT_LANG_IDS);
      orderContainer.innerHTML = order.map(id =>
        `<span class="polyglot-config-lang-tag" data-lang="${id}">${POLYGLOT_LANGUAGES[id].flag} ${POLYGLOT_LANGUAGES[id].name}</span>`
      ).join('');
    }
  
    modal.style.display = 'flex';
  };
  
  window.savePolyglotConfig = async () => {
    const profile = $('polyglot-config-profile').value;
    const sourceLanguage = $('polyglot-config-source').value;
  
    const { data: existing } = await supabase.from('polyglot_config').select('id').limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('polyglot_config').update({ profile, source_language: sourceLanguage }).eq('id', existing[0].id);
    } else {
      await supabase.from('polyglot_config').insert([{ profile, source_language: sourceLanguage }]);
    }
  
    window.polyglotState.sourceLanguage = sourceLanguage;
    showToast('✅ Configuración guardada');
    window.closeModal('polyglot-config-modal');
    fetchPolyglotData();
  };
  
  // Close modals
  document.addEventListener('click', (e) => {
    ['polyglot-phrase-modal', 'polyglot-study-modal', 'polyglot-alphabet-modal', 'polyglot-config-modal'].forEach(id => {
      const el = $(id);
      if (el && e.target === el) el.style.display = 'none';
    });
  });

  return { fetchPolyglotData };
}
