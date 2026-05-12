import { supabase, $, showToast, escHtml } from './db.js';

const INSPIRATION_WEBHOOK = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/inspiration-capture';

window.switchDiscoverTab = (tab, btn) => {
  document.querySelectorAll('.finance-subtab[data-dtab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-discover .finance-tab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('discover-tab-' + tab);
  if (el) el.classList.add('active');
  if (tab === 'media') renderMediaVault();
  if (tab === 'dolar') renderDolarDetail();
};

window.captureInspiration = async () => {
  const url = $('inspiration-url')?.value?.trim();
  if (!url) { showToast('⚠️ Pegá un link primero'); return; }
  if (!url.startsWith('http://') && !url.startsWith('https://')) { showToast('⚠️ Eso no parece un link válido'); return; }
  const btn = document.querySelector('#view-discover .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analizando...'; }
  try {
    const res = await fetch(INSPIRATION_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('✅ Inspiración guardada');
    $('inspiration-url').value = '';
    fetchDiscoverData();
  } catch(e) {
    console.error(e);
    showToast('⚠️ Error al analizar. ¿El webhook de n8n está activo?');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Analizar'; }
  }
};

window.openInspirationDetail = (id) => {
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;
  const tools = item.tools || [];
  document.getElementById('inspiration-detail-content').innerHTML = `
    ${item.image_url ? '<img src="' + escHtml(item.image_url) + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:0.75rem;">' : ''}
    <h3 style="font-size:1rem;margin-bottom:0.3rem;">${escHtml(item.title || 'Sin título')}</h3>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.5rem;">
      <span style="font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--surface-light);">${escHtml(item.platform)}</span>
      <span style="font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--surface-light);">${escHtml(item.category)}</span>
      ${item.difficulty ? '<span style="font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--surface-light);">' + escHtml(item.difficulty) + '</span>' : ''}
    </div>
    ${item.summary ? '<p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.5rem;">' + escHtml(item.summary) + '</p>' : ''}
    ${tools.length ? '<div style="margin-bottom:0.5rem;"><strong style="font-size:0.7rem;">🔧 Herramientas:</strong><div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.2rem;">' + tools.map(t => '<span style="font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--primary-low);color:var(--primary);">' + escHtml(t) + '</span>').join('') + '</div></div>' : ''}
    ${item.estimated_time ? '<p style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.3rem;">⏱️ ' + escHtml(item.estimated_time) + '</p>' : ''}
    <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
      <a href="${escHtml(item.url)}" target="_blank" class="btn-primary" style="text-decoration:none;padding:0.4rem 0.8rem;font-size:0.75rem;">🔗 Abrir link</a>
      <button class="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.75rem;" onclick="window.toggleInspirationStatus(\'${item.id}\')">${item.status === 'hecho' ? '↩️ Reabrir' : '✅ Marcar hecho'}</button>
    </div>
  `;
  document.getElementById('inspiration-modal').style.display = 'flex';
};

window.toggleInspirationStatus = async (id) => {
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;
  const newStatus = item.status === 'hecho' ? 'nuevo' : 'hecho';
  await supabase.from('inspirations').update({ status: newStatus }).eq('id', id);
  window.closeModal('inspiration-modal');
  fetchDiscoverData();
};
