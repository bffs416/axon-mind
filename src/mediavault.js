import { supabase, $, showToast, escHtml } from './db.js';

window.openMediaModal = (id) => {
  const modal = $('media-modal');
  if (!modal) return;
  if (id) {
    const item = window._mediaItems?.find(i => i.id === id);
    if (!item) return;
    $('media-modal-title').textContent = '✏️ Editar';
    $('edit-media-id').value = id;
    $('media-title').value = item.title || '';
    $('media-type').value = item.type || 'pelicula';
    $('media-status').value = item.status || 'quiero_ver';
    $('media-platform').value = item.platform || '';
    $('media-genre').value = item.genre || '';
    $('media-rating').value = item.rating || '';
    $('media-recommender').value = item.recommender || '';
    $('media-url').value = item.url || '';
    $('media-notes').value = item.notes || '';
  } else {
    $('media-modal-title').textContent = '🎬 Agregar';
    $('edit-media-id').value = '';
    $('media-title').value = '';
    $('media-type').value = 'pelicula';
    $('media-status').value = 'quiero_ver';
    $('media-platform').value = '';
    $('media-genre').value = '';
    $('media-rating').value = '';
    $('media-recommender').value = '';
    $('media-url').value = '';
    $('media-notes').value = '';
  }
  modal.style.display = 'flex';
};

window.saveMediaItem = async () => {
  const id = $('edit-media-id').value;
  const title = $('media-title').value.trim();
  if (!title) { showToast('⚠️ El título es obligatorio'); return; }
  const record = {
    title, type: $('media-type').value, status: $('media-status').value,
    platform: $('media-platform').value.trim(), genre: $('media-genre').value.trim(),
    rating: parseInt($('media-rating').value) || null,
    recommender: $('media-recommender').value.trim(), url: $('media-url').value.trim(),
    notes: $('media-notes').value.trim(), image_url: ''
  };
  if (id) {
    await supabase.from('media_vault').update(record).eq('id', id);
    showToast('✅ Actualizado');
  } else {
    await supabase.from('media_vault').insert([record]);
    showToast('✅ Agregado');
  }
  window.closeModal('media-modal');
  fetchDiscoverData();
};

window.deleteMediaItem = async (id) => {
  if (!confirm('¿Eliminar?')) return;
  await supabase.from('media_vault').delete().eq('id', id);
  showToast('🗑️ Eliminado');
  renderMediaVault();
};

function renderMediaVault() {
  const list = $('media-list');
  if (!list) return;
  const items = window._mediaItems || [];
  const typeFilter = $('media-type-filter')?.value || 'all';
  const statusFilter = $('media-status-filter')?.value || 'all';
  let filtered = [...items];
  if (typeFilter !== 'all') filtered = filtered.filter(i => i.type === typeFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(i => i.status === statusFilter);
  if (!filtered.length) {
    list.innerHTML = '<div class="finance-empty">🎬 ' + (items.length ? 'No hay resultados' : 'Agrega películas, series y artistas') + '</div>';
    return;
  }
  list.innerHTML = filtered.map(i => {
    const statusEmoji = { quiero_ver: '👀', viendo: '📺', visto: '✅', abandonado: '💤' };
    const typeEmoji = { pelicula: '🎬', serie: '📺', artista: '🎤', cancion: '🎵', documental: '📖', libro: '📚' };
    return '<div class="polyglot-phrase-item"><div class="polyglot-phrase-source"><div class="polyglot-phrase-source-text">' + (typeEmoji[i.type] || '📌') + ' ' + escHtml(i.title) + '</div><div class="polyglot-phrase-source-lang">' + (statusEmoji[i.status] || '') + ' ' + i.status + (i.platform ? ' · ' + escHtml(i.platform) : '') + (i.rating ? ' · ⭐' + i.rating : '') + (i.recommender ? ' · vía ' + escHtml(i.recommender) : '') + '</div></div><div class="polyglot-phrase-actions"><button class="finance-tx-action" onclick="window.openMediaModal(\'' + i.id + '\')">✏️</button><button class="finance-tx-action" onclick="window.deleteMediaItem(\'' + i.id + '\')">🗑️</button></div></div>';
  }).join('');
}
window.renderMediaVault = renderMediaVault;
