import { supabase, $, showToast, escHtml } from './db.js';
import { DISTILL_URL } from './db.js';

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

// Global delete function
window.deleteInspiration = async (id) => {
  console.log('--- INICIO PROCESO ELIMINAR ---');
  console.log('ID recibido:', id);
  
  if (!id) {
    console.error('Error: ID no proporcionado');
    return;
  }

  const userConfirmed = confirm('¿Seguro que quieres eliminar esta inspiración?');
  console.log('Respuesta del usuario (confirm):', userConfirmed);
  
  if (!userConfirmed) {
    console.log('Eliminación cancelada por el usuario');
    return;
  }
  
  try {
    console.log('Llamando a Supabase para eliminar...');
    const { data, error, status } = await supabase.from('inspirations').delete().eq('id', id);
    
    console.log('Respuesta de Supabase - Status:', status);
    if (error) {
      console.error('Error detallado de Supabase:', error);
      throw error;
    }
    
    console.log('Eliminación exitosa en base de datos. Filas afectadas:', data);
    showToast('🗑️ Eliminada correctamente');
    
    const modal = document.getElementById('inspiration-modal');
    if (modal) {
      modal.style.display = 'none';
      console.log('Modal cerrado');
    }
    
    if (window.fetchDiscoverData) {
      console.log('Refrescando lista...');
      await window.fetchDiscoverData();
    }
    console.log('--- FIN PROCESO ELIMINAR (ÉXITO) ---');
  } catch (e) {
    console.error('Fallo crítico en catch:', e);
    showToast('⚠️ No se pudo eliminar');
  }
};

// Manual capture — with n8n distillation
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
    const title = desc
      ? desc.substring(0, 60) + (desc.length > 60 ? '...' : '')
      : platform + ' — ' + new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

    const { data: inserted, error } = await supabase.from('inspirations').insert([{
      url,
      title,
      description: desc || '',
      summary: desc || '',
      platform,
      category,
      status: 'nuevo'
    }]).select();

    if (error) throw error;

    showToast('✅ Inspiración guardada');
    $('inspiration-url').value = '';
    $('inspiration-desc').value = '';
    $('inspiration-category').value = 'Otro';
    if (window.fetchDiscoverData) window.fetchDiscoverData();

    // Enviar al destilador de n8n
    const inspId = inserted?.[0]?.id;
    if (inspId) {
      fetch(DISTILL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, id: inspId })
      })
        .then(r => r.ok ? r.json() : null)
        .then(raw => {
          if (!raw) return;
          // n8n webhook returns [{...}] not {...}
          const enriched = Array.isArray(raw) ? raw[0] : raw;
          if (!enriched) {
            console.warn('Inspiration: Empty response from distiller');
            return;
          }
          
          console.log('Inspiration: Enriched data received', enriched);
          
          const updateData = {};
          
          // Map dynamic category to fixed categories if possible
          if (enriched.categoria) {
            const cat = enriched.categoria.toLowerCase();
            if (cat.includes('marketing')) updateData.category = 'Marketing Digital';
            else if (cat.includes('ia') || cat.includes('inteligencia') || cat.includes('automatización')) updateData.category = 'IA & Automatización';
            else if (cat.includes('desarrollo') || cat.includes('programación') || cat.includes('código')) updateData.category = 'Desarrollo Web';
            else if (cat.includes('finanzas') || cat.includes('economía')) updateData.category = 'Finanzas';
            else if (cat.includes('diseño') || cat.includes('ux') || cat.includes('ui')) updateData.category = 'Diseño';
            else if (cat.includes('productividad') || cat.includes('organización')) updateData.category = 'Productividad';
            else if (cat.includes('negocio') || cat.includes('emprendimiento')) updateData.category = 'Negocios';
            else if (cat.includes('salud') || cat.includes('bienestar')) updateData.category = 'Salud';
            else updateData.category = 'Otro';
          }
          
          if (enriched.resumen) updateData.summary = enriched.resumen;
          
          // Handle keywords as tools
          if (enriched.palabras_clave) {
            const keywords = Array.isArray(enriched.palabras_clave) ? enriched.palabras_clave : [enriched.palabras_clave];
            updateData.tools = keywords.map(k => k.trim()).filter(Boolean);
          }
          
          if (enriched.accion) updateData.action = enriched.accion;
          
          let fullDesc = '';
          if (enriched.subcategorias) {
            const subs = Array.isArray(enriched.subcategorias) ? enriched.subcategorias : [enriched.subcategorias];
            fullDesc += '📌 SUBCATEGORÍAS:\n' + subs.join(', ') + '\n\n';
          }
          
          // Content extraction (check multiple possible structures)
          const transcription = enriched.content?.parts?.[0]?.text || enriched.transcripcion || enriched.texto;
          if (transcription) {
            fullDesc += '📝 TRANSCRIPCIÓN:\n' + transcription;
          }
          
          if (fullDesc) updateData.description = fullDesc;

          if (Object.keys(updateData).length) {
            console.log('Inspiration: Updating Supabase with', updateData);
            supabase.from('inspirations').update(updateData).eq('id', inspId).then(({ error }) => {
              if (error) console.error('Inspiration: Update error', error);
              if (window.fetchDiscoverData) window.fetchDiscoverData();
            });
          }
        })
        .catch((err) => {
          console.error('Inspiration: Distillation fetch failed', err);
        });
    }
  } catch (e) {
    console.error(e);
    showToast('⚠️ Error: ' + (e.message || 'intenta de nuevo'));
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

function getCategoryStyle(cat) {
  return catColors[cat] || { bg: '#f1f5f9', color: '#475569', icon: '✨' };
}

const platformIcons = {
  'TikTok': '🎵', 'Instagram': '📸', 'YouTube': '▶️',
  'Threads': '🧵', 'Facebook': '👤', 'X/Twitter': '🐦',
  'LinkedIn': '💼', 'Web': '🌐'
};

window.renderInspirations = renderInspirations;
function renderInspirations() {
  const list = $('inspiration-list'); if (!list) return;
  let items = window._inspirations || [];
  if (_insFilter !== 'all') items = items.filter(i => i.status === _insFilter);

  if (!items.length) {
    list.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.8rem;">
      📭 No hay inspiraciones aquí.
    </div>`;
    return;
  }

  list.innerHTML = items.map(i => {
    const statusLabel = { nuevo: '🆕 Nuevo', por_hacer: '📝 Por Hacer', en_progreso: '🔄 En Progreso', hecho: '✅ Hecho', archivado: '📦 Archivado' };
    const cat = getCategoryStyle(i.category);
    const platIcon = platformIcons[i.platform] || '🌐';

    return `<div class="polyglot-phrase-item" onclick="window.openInspirationDetail('${i.id}')" style="cursor:pointer;transition:transform 0.1s ease;">
      <div style="display:flex;align-items:flex-start;gap:0.7rem;width:100%;">
        <div style="font-size:1.4rem;">${platIcon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--text);margin-bottom:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(i.title || 'Sin título')}</div>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.4rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(i.summary || i.description || '')}</div>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
            <span style="font-size:0.6rem;padding:0.15rem 0.5rem;border-radius:4px;background:${cat.bg};color:${cat.color};font-weight:700;">${cat.icon} ${escHtml(i.category || 'Otro')}</span>
            <span style="font-size:0.6rem;padding:0.15rem 0.5rem;border-radius:4px;background:var(--surface-light);color:var(--text-dim);">${statusLabel[i.status] || '🆕 Nuevo'}</span>
          </div>
        </div>
        <div style="display:flex;gap:0.1rem;align-items:center;flex-shrink:0;">
          <button onclick="event.stopPropagation();window.openInspirationEdit('${i.id}')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--text-dim);padding:0.25rem;opacity:0.4;transition:opacity 0.15s;" title="Editar" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">✏️</button>
          <button onclick="event.stopPropagation();window.deleteInspiration('${i.id}')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--danger);padding:0.25rem;opacity:0.4;transition:opacity 0.15s;" title="Eliminar" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.openInspirationDetail = (id) => {
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;
  const tools = item.tools || [];
  const cat = getCategoryStyle(item.category);
  const platIcon = platformIcons[item.platform] || '🌐';
  const statusLabel = { nuevo: '🆕 Nuevo', por_hacer: '📝 Por Hacer', en_progreso: '🔄 En Progreso', hecho: '✅ Hecho', archivado: '📦 Archivado' };

  let subTags = [];
  let cleanDesc = item.description || '';
  if (cleanDesc.includes('📌 SUBCATEGORÍAS:')) {
    const parts = cleanDesc.split('📝 TRANSCRIPCIÓN:');
    const subPart = parts[0].replace('📌 SUBCATEGORÍAS:', '').trim();
    subTags = subPart.split(',').map(s => s.trim()).filter(Boolean);
    cleanDesc = parts[1] || subPart;
  }

  document.getElementById('inspiration-detail-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
      <span style="font-size:2rem;">${platIcon}</span>
      <div style="flex:1;">
        <h3 style="font-size:1.1rem;margin:0;line-height:1.2;font-weight:700;">${escHtml(item.title || 'Sin título')}</h3>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem;">
          <span style="font-size:0.65rem;color:var(--text-dim);">📅 ${new Date(item.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
          <span style="width:3px;height:3px;background:var(--border);border-radius:50%;"></span>
          <span style="font-size:0.65rem;color:var(--text-dim);">${escHtml(item.platform || 'Web')}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:1rem;">
      <span style="font-size:0.7rem;padding:0.25rem 0.75rem;border-radius:50px;background:${cat.bg};color:${cat.color};font-weight:700;">${cat.icon} ${escHtml(item.category || 'Otro')}</span>
      <span style="font-size:0.7rem;padding:0.25rem 0.75rem;border-radius:50px;background:var(--surface-light);color:var(--text-dim);font-weight:600;">${statusLabel[item.status] || '🆕 Nuevo'}</span>
    </div>

    ${item.summary ? `
      <div style="background:linear-gradient(135deg, var(--surface-light) 0%, var(--bg-card) 100%);padding:1rem;border-radius:12px;margin-bottom:1.25rem;border-left:5px solid var(--primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;font-size:0.8rem;margin-bottom:0.5rem;color:var(--primary);">💡 Resumen Ejecutivo</strong>
        <p style="font-size:0.9rem;margin:0;line-height:1.6;color:var(--text);">${escHtml(item.summary)}</p>
      </div>
    ` : ''}

    ${item.action ? `
      <div style="background:var(--bg-card);padding:1rem;border-radius:12px;margin-bottom:1.25rem;border:1px dashed var(--primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;font-size:0.8rem;margin-bottom:0.5rem;color:var(--primary);">🚀 Guía Paso a Paso / Acción</strong>
        <div style="font-size:0.85rem;margin:0;line-height:1.6;color:var(--text);white-space: pre-wrap;">${escHtml(item.action)}</div>
      </div>
    ` : ''}

    ${subTags.length ? `
      <div style="margin-bottom:1rem;">
        <strong style="font-size:0.75rem;display:block;margin-bottom:0.5rem;color:var(--text-dim);">📌 Enfoques / Subcategorías</strong>
        <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
          ${subTags.map(s => `<span style="font-size:0.65rem;padding:0.2rem 0.6rem;border-radius:6px;background:var(--bg-card);border:1px solid var(--border);">${escHtml(s)}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    ${tools.length ? `
      <div style="margin-bottom:1.25rem;">
        <strong style="font-size:0.75rem;display:block;margin-bottom:0.5rem;color:var(--text-dim);">🛠️ Herramientas y Conceptos</strong>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          ${tools.map(t => `<span style="font-size:0.7rem;padding:0.25rem 0.75rem;border-radius:8px;background:var(--primary-low);color:var(--primary);font-weight:700;">#${escHtml(t)}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    <div style="margin-bottom:1.5rem;">
      <strong style="font-size:0.75rem;display:block;margin-bottom:0.5rem;color:var(--text-dim);">📝 Transcripción Completa</strong>
      <div style="max-height: 200px; overflow-y: auto; padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;">
        <p style="font-size:0.75rem;color:var(--text);margin:0;line-height:1.6;white-space: pre-wrap;">${escHtml(cleanDesc.replace('📝 TRANSCRIPCIÓN:', '').trim())}</p>
      </div>
    </div>

    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;padding-top:1rem;border-top:1px solid var(--border);">
      <a href="${escHtml(item.url)}" target="_blank" class="btn-primary" style="text-decoration:none;padding:0.6rem 1.2rem;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;border-radius:10px;"><span>🔗</span> Abrir link</a>
      <button class="btn-secondary" style="padding:0.6rem 1rem;font-size:0.85rem;border-radius:10px;" onclick="window.openInspirationEdit('${item.id}')">✏️ Editar</button>
      <button class="btn-secondary" style="padding:0.6rem 1rem;font-size:0.85rem;border-radius:10px;color:var(--danger);" onclick="window.deleteInspiration('${item.id}')">🗑️</button>
    </div>
  `;
  document.getElementById('inspiration-modal').style.display = 'flex';
};

window.openInspirationEdit = (id) => {
  const modal = document.getElementById('inspiration-modal');
  if (modal) modal.style.display = 'flex';
  
  const item = window._inspirations?.find(i => i.id === id);
  if (!item) return;

  const catOptions = Object.keys(catColors).map(c =>
    `<option value="${escHtml(c)}"${item.category === c ? ' selected' : ''}>${catColors[c].icon} ${escHtml(c)}</option>`
  ).join('');

  const statusLabel = { nuevo: '🆕 Nuevo', por_hacer: '📝 Por Hacer', en_progreso: '🔄 En Progreso', hecho: '✅ Hecho', archivado: '📦 Archivado' };
  const statusOptions = Object.keys(statusLabel).map(s =>
    `<option value="${escHtml(s)}"${item.status === s ? ' selected' : ''}>${statusLabel[s]}</option>`
  ).join('');

  document.getElementById('inspiration-detail-content').innerHTML = `
    <div style="margin-bottom:0.75rem;">
      <label style="font-size:0.65rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;">Título</label>
      <input id="edit-insp-title" value="${escHtml(item.title || '')}" style="width:100%;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);outline:none;">
    </div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
      <div style="flex:1;">
        <label style="font-size:0.65rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;">Categoría</label>
        <select id="edit-insp-category" style="width:100%;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);">${catOptions}</select>
      </div>
      <div style="flex:1;">
        <label style="font-size:0.65rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;">Estado</label>
        <select id="edit-insp-status" style="width:100%;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);">${statusOptions}</select>
      </div>
    </div>
    <div style="margin-bottom:0.75rem;">
      <label style="font-size:0.65rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;">Resumen Ejecutivo</label>
      <textarea id="edit-insp-summary" rows="4" style="width:100%;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);resize:vertical;outline:none;">${escHtml(item.summary || '')}</textarea>
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
      <button class="btn-primary" style="padding:0.6rem 1.2rem;font-size:0.85rem;border-radius:10px;" onclick="window.saveInspirationEdit('${item.id}')">💾 Guardar Cambios</button>
      <button class="btn-secondary" style="padding:0.6rem 1.2rem;font-size:0.85rem;border-radius:10px;" onclick="window.openInspirationDetail('${item.id}')">↩️ Cancelar</button>
    </div>
  `;
};

window.saveInspirationEdit = async (id) => {
  const title = $('edit-insp-title')?.value?.trim();
  const summary = $('edit-insp-summary')?.value?.trim();
  const category = $('edit-insp-category')?.value;
  const status = $('edit-insp-status')?.value;
  
  try {
    const { error } = await supabase.from('inspirations').update({ 
      title, 
      summary,
      category,
      status
    }).eq('id', id);
    
    if (error) throw error;
    
    showToast('✅ Actualizado');
    window.openInspirationDetail(id);
    if (window.fetchDiscoverData) window.fetchDiscoverData();
  } catch (e) { 
    console.error(e);
    showToast('⚠️ Error al guardar'); 
  }
};
