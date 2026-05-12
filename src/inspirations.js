import { supabase, $, showToast, escHtml } from './db.js';

// Current filter state
let _insFilter = 'all';

window.switchDiscoverTab = (tab, btn) => {
  document.querySelectorAll('.finance-subtab[data-dtab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-discover .finance-tab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('discover-tab-' + tab);
  if (el) el.classList.add('active');
  if (tab === 'media') renderMediaVault();
  if (tab === 'dolar') renderDolarDetail();
};

// Detect platform from URL
function detectPlatform(url) {
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('threads.net')) return 'Threads';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X/Twitter';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  return 'Web';
}

// Manual capture — no webhooks needed
window.captureInspiration = async () => {
  const url = $('inspiration-url')?.value?.trim();
  const desc = $('inspiration-desc')?.value?.trim();
  const category = $('inspiration-category')?.value || 'Otro';

  if (!url) { showToast('⚠️ Pegá un link primero'); return; }
  if (!url.startsWith('http://') && !url.startsWith('https://')) { showToast('⚠️ Eso no parece un link válido'); return; }

  const btn = document.querySelector('#discover-tab-inspirations .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

  try {
    const platform = detectPlatform(url);
    // Auto-generate a short title from the description or URL
    const title = desc
      ? desc.substring(0, 60) + (desc.length > 60 ? '...' : '')
      : platform + ' — ' + new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

    const { error } = await supabase.from('inspirations').insert([{
      url,
      title,
      description: desc || '',
      summary: desc || '',
      platform,
      category,
      status: 'nuevo'
    }]);

    if (error) throw error;

    showToast('✅ Inspiración guardada');
    $('inspiration-url').value = '';
    $('inspiration-desc').value = '';
    $('inspiration-category').value = 'Otro';
    if (window.fetchDiscoverData) window.fetchDiscoverData();
  } catch (e) {
    console.error(e);
    showToast('⚠️ Error al guardar: ' + (e.message || 'intenta de nuevo'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
  }
};

// Filter inspirations by status
window.filterInspirations = (filter, btn) => {
  _insFilter = filter;
  document.querySelectorAll('[data-ifilter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderInspirations();
};

// Category color map
const catColors = {
  'Marketing Digital': { bg: '#fce7f3', color: '#be185d', icon: '📱' },
  'IA & Automatización': { bg: '#ede9fe', color: '#7c3aed', icon: '🤖' },
  'Desarrollo Web': { bg: '#dbeafe', color: '#2563eb', icon: '💻' },
  'Finanzas': { bg: '#d1fae5', color: '#059669', icon: '💰' },
  'Diseño': { bg: '#fef3c7', color: '#d97706', icon: '🎨' },
  'Productividad': { bg: '#fff7ed', color: '#ea580c', icon: '⚡' },
  'Negocios': { bg: '#f0fdf4', color: '#16a34a', icon: '📊' },
  'Salud': { bg: '#ecfeff', color: '#0891b2', icon: '🏥' },
  'Otro': { bg: '#f1f5f9', color: '#475569', icon: '📌' },
};

// Platform icons
const platformIcons = {
  'TikTok': '🎵', 'Instagram': '📸', 'YouTube': '▶️',
  'Threads': '🧵', 'Facebook': '👤', 'X/Twitter': '🐦',
  'LinkedIn': '💼', 'Web': '🌐'
};

// Render inspiration cards
window.renderInspirations = renderInspirations;
function renderInspirations() {
  const list = $('inspiration-list'); if (!list) return;
  let items = window._inspirations || [];

  // Apply filter
  if (_insFilter !== 'all') {
    items = items.filter(i => i.status === _insFilter);
  }

  if (!items.length) {
    list.innerHTML = `<div class="finance-empty" style="padding:2rem;text-align:center;">
      ${_insFilter === 'all' ? '💡 Pegá un link y describí de qué trata' : '📭 No hay items con ese filtro'}
    </div>`;
    return;
  }

  list.innerHTML = items.map(i => {
    const statusLabel = { nuevo: '🆕 Nuevo', por_hacer: '📝 Por Hacer', en_progreso: '🔄 En Progreso', hecho: '✅ Hecho', archivado: '📦 Archivado' };
    const cat = catColors[i.category] || catColors['Otro'];
    const platIcon = platformIcons[i.platform] || '🌐';

    return `<div class="polyglot-phrase-item" onclick="window.openInspirationDetail('${i.id}')" style="cursor:pointer;transition:transform 0.15s ease;">
      <div style="display:flex;align-items:flex-start;gap:0.5rem;width:100%;">
        <div style="font-size:1.3rem;min-width:1.5rem;text-align:center;margin-top:0.1rem;">${platIcon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text);margin-bottom:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(i.title || 'Sin título')}</div>
          ${i.description ? `<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.3rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(i.description)}</div>` : ''}
          <div style="display:flex;gap:0.25rem;flex-wrap:wrap;align-items:center;">
            <span style="font-size:0.6rem;padding:0.1rem 0.4rem;border-radius:4px;background:${cat.bg};color:${cat.color};font-weight:600;">${cat.icon} ${escHtml(i.category || 'Otro')}</span>
            <span style="font-size:0.6rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--surface-light);color:var(--text-dim);">${statusLabel[i.status] || '🆕 Nuevo'}</span>
            ${i.platform ? `<span style="font-size:0.6rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--surface-light);color:var(--text-dim);">${escHtml(i.platform)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// Detail modal
window.openInspirationDetail = (id) => {
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;
  const tools = item.tools || [];
  const cat = catColors[item.category] || catColors['Otro'];
  const platIcon = platformIcons[item.platform] || '🌐';
  const statusLabel = { nuevo: '🆕 Nuevo', por_hacer: '📝 Por Hacer', en_progreso: '🔄 En Progreso', hecho: '✅ Hecho', archivado: '📦 Archivado' };

  document.getElementById('inspiration-detail-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
      <span style="font-size:1.5rem;">${platIcon}</span>
      <h3 style="font-size:1rem;margin:0;flex:1;">${escHtml(item.title || 'Sin título')}</h3>
    </div>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.5rem;">
      <span style="font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:4px;background:${cat.bg};color:${cat.color};font-weight:600;">${cat.icon} ${escHtml(item.category || 'Otro')}</span>
      ${item.platform ? `<span style="font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--surface-light);">${escHtml(item.platform)}</span>` : ''}
      <span style="font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--surface-light);">${statusLabel[item.status] || '🆕 Nuevo'}</span>
    </div>
    ${item.description ? `<p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.5rem;line-height:1.4;">${escHtml(item.description)}</p>` : ''}
    ${item.summary && item.summary !== item.description ? `<p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.5rem;line-height:1.4;">${escHtml(item.summary)}</p>` : ''}
    ${tools.length ? `<div style="margin-bottom:0.5rem;"><strong style="font-size:0.7rem;">🔧 Herramientas:</strong><div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.2rem;">${tools.map(t => `<span style="font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--primary-low);color:var(--primary);">${escHtml(t)}</span>`).join('')}</div></div>` : ''}
    <div style="font-size:0.65rem;color:var(--text-dim);margin-bottom:0.75rem;">📅 ${new Date(item.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <a href="${escHtml(item.url)}" target="_blank" class="btn-primary" style="text-decoration:none;padding:0.4rem 0.8rem;font-size:0.75rem;">🔗 Abrir link</a>
      <button class="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.75rem;" onclick="window.changeInspirationStatus('${item.id}', 'por_hacer')">📝 Hacer tarea</button>
      <button class="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.75rem;" onclick="window.toggleInspirationStatus('${item.id}')">${item.status === 'hecho' ? '↩️ Reabrir' : '✅ Marcar hecho'}</button>
      <button class="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.75rem;color:var(--danger);" onclick="window.deleteInspiration('${item.id}')">🗑️ Eliminar</button>
    </div>
  `;
  document.getElementById('inspiration-modal').style.display = 'flex';
};

// Change status
window.changeInspirationStatus = async (id, newStatus) => {
  await supabase.from('inspirations').update({ status: newStatus }).eq('id', id);
  showToast('✅ Estado actualizado');
  window.closeModal('inspiration-modal');
  fetchDiscoverData();
};

window.toggleInspirationStatus = async (id) => {
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;
  const newStatus = item.status === 'hecho' ? 'nuevo' : 'hecho';
  await supabase.from('inspirations').update({ status: newStatus }).eq('id', id);
  window.closeModal('inspiration-modal');
  fetchDiscoverData();
};

// Delete inspiration
window.deleteInspiration = async (id) => {
  if (!confirm('¿Eliminar esta inspiración?')) return;
  await supabase.from('inspirations').delete().eq('id', id);
  showToast('🗑️ Eliminada');
  window.closeModal('inspiration-modal');
  fetchDiscoverData();
};
