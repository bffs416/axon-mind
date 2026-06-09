import { supabase, FINANCE_ASSISTANT_URL, $, showToast, initIcons, capitalizeFirstLetter } from './config.js';

export function initVault(deps) {
  const { fetchTasks, renderRoutines, renderPlanner } = deps;
  // ==================== MODAL STEPS ====================
  window.renderModalSteps = () => {
      const list = $('modal-steps-list');
      if (!list) return;
      list.innerHTML = currentStepsInModal.map((s, i) => {
          const iconAssignee = s.assignee === 'Pipe' ? '👨' : (s.assignee === 'Tati' ? '👩' : '🤝');
          return `<div class="step-item" style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
              <span style="font-size: 0.75rem; opacity: 0.5; min-width: 20px; font-family: monospace;">${i + 1}.</span>
              <input type="text" value="${s.text}" onchange="window.updateModalStep(${i}, 'text', this.value)" style="flex:1; margin:0; padding:4px 8px; font-size:0.85rem;" placeholder="Paso a seguir...">
              <button class="btn-mini" onclick="window.cycleModalStepAssignee(${i})" title="Cambiar responsable">${iconAssignee}</button>
              <button class="btn-mini" onclick="window.removeModalStep(${i})" style="color:var(--danger)">✕</button>
          </div>`;
      }).join('') || '<p style="text-align:center; opacity:0.3; font-size:0.8rem;">No hay pasos definidos.</p>';
  };
  
  window.addModalStep = () => {
      currentStepsInModal.push({ text: '', done: false, assignee: 'Ambos' });
      window.renderModalSteps();
  };
  
  window.updateModalStep = (i, field, val) => { currentStepsInModal[i][field] = val; };
  
  window.cycleModalStepAssignee = (i) => {
      const s = currentStepsInModal[i];
      const sequence = ['Ambos', 'Pipe', 'Tati'];
      let idx = sequence.indexOf(s.assignee || 'Ambos');
      s.assignee = sequence[(idx + 1) % sequence.length];
      window.renderModalSteps();
  };
  
  window.removeModalStep = (i) => {
      currentStepsInModal.splice(i, 1);
      window.renderModalSteps();
  };
  
  // ==================== INBOX CONVERSION ====================
  window.convertInboxToTask = (docId) => {
      const doc = inboxDocs.find(d => String(d.id) === String(docId));
      if (!doc) return;
      inboxDocToConvert = docId;
      $('new-task-title').value = doc.content;
      $('new-task-desc').value = '';
      taskModal.style.display = 'flex';
      showToast("Pre-cargado desde el Inbox");
  };
  
  // ==================== NAVIGATION ====================
  window.openAddSelector = () => {
      $('add-selector-modal').style.display = 'flex';
  };
  
  window.openTaskModal = () => {
      selectedTaskId = null;
      $('new-task-title').value = '';
      $('new-task-desc').value = '';
      currentStepsInModal = [];
      window.renderModalSteps();
      $('task-modal').style.display = 'flex';
  };
  
  window.openQuickCapture = () => {
      const modal = $('quick-capture-modal');
      if (modal) {
          modal.style.display = 'block';
          const input = $('inbox-content');
          if (input) input.focus();
      }
  };
  
  window.closeQuickCapture = () => {
      const modal = $('quick-capture-modal');
      if (modal) modal.style.display = 'none';
      const input = $('inbox-content');
      if (input) input.value = '';
  };
  
  window.saveInbox = async () => {
      const input = $('inbox-content');
      if (!input) return;
      const text = capitalizeFirstLetter(input.value.trim());
      if (!text) return;
  
      try {
          const { error } = await supabase.from('inbox').insert([{ content: text }]);
          if (error) throw error;
          showToast("📥 Idea capturada en la Nube");
      } catch (e) {
          console.warn("Error Inbox Supabase:", e);
          inboxDocs.unshift({ id: Date.now(), content: text, created_at: new Date().toISOString() });
          localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
          showToast("📥 Idea capturada Localmente");
      }
  
      input.value = '';
      window.closeQuickCapture();
      fetchInbox();
  };
  
  async function fetchInbox() {
      try {
          const { data, error } = await supabase.from('inbox').select('*').order('created_at', { ascending: false });
          if (data && !error) {
              inboxDocs = data;
              localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
          }
      } catch (e) {
          const local = localStorage.getItem('axon_inbox_docs');
          if (local) inboxDocs = JSON.parse(local);
      }
      renderInbox();
  }
  window.fetchInbox = fetchInbox;
  
  function renderInbox() {
      const container = $('inbox-list');
      if (!container) return;
      
      container.innerHTML = inboxDocs.map(doc => `
          <div class="inbox-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border);">
              <div style="flex:1; margin-right:10px;">
                  <p style="margin:0; font-size:0.9rem; color:var(--text);">${doc.content}</p>
                  <small style="opacity:0.5; font-size:0.7rem; color:var(--text-dim);">${new Date(doc.created_at).toLocaleDateString()}</small>
              </div>
              <div style="display:flex; gap:8px;">
                  <button class="btn-mini" onclick="window.convertInboxToTask('${doc.id}')" title="Convertir a Tarea" style="background:var(--surface-light); border:1px solid var(--border); color:var(--text);">
                      <i data-lucide="layers" style="width:14px; height:14px;"></i>
                  </button>
                  <button class="btn-mini" onclick="window.convertInboxToFinance('${doc.id}')" title="Finanzas IA" style="background:var(--surface-light); border:1px solid var(--border); color:var(--success);">
                      <i data-lucide="dollar-sign" style="width:14px; height:14px;"></i>
                  </button>
                  <button class="btn-mini" onclick="window.deleteInboxItem('${doc.id}')" title="Eliminar" style="background:var(--surface-light); border:1px solid var(--border); color:var(--danger);">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                  </button>
              </div>
          </div>
      `).join('') || '<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:20px; color:var(--text-dim);">Tu bandeja está vacía.</p>';
      
      if (window.lucide) lucide.createIcons();
  }
  window.renderInbox = renderInbox;
  
  window.convertInboxToFinance = async (id) => {
      const doc = inboxDocs.find(d => String(d.id) === String(id));
      if (!doc) return;
      showToast("🤖 Analizando transacción con IA...");
      try {
          const categories = (window.financeState.categories || []).map(c => c.name).join(", ");
          const res = await fetch(FINANCE_ASSISTANT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  text: doc.content + " (Nota: Mantén el monto como un número entero en COP, sin puntos ni comas decimales. Ej: '103753' o '103.753' es 103753, NO 103.75)",
                  categories: categories 
              })
          });
          if (!res.ok) throw new Error("HTTP error " + res.status);
          let data = await res.json();
          
          // n8n Agent often nests result in .output
          if (data.output && typeof data.output === 'object') {
              data = data.output;
          } else if (Array.isArray(data) && data[0]?.output) {
              data = data[0].output;
          } else if (Array.isArray(data) && data[0]) {
              data = data[0];
          }
  
          const safeType = data.type?.toLowerCase() === 'income' ? 'income' : 'expense';
          const cats = window.financeState.categories || [];
          const typeMatch = cats.filter(c => (c.transaction_type || c.type) === safeType);
          let categoryId = typeMatch.length ? typeMatch[0].id : null;
          if (data.category && typeMatch.length) {
              const searchCat = data.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const exactMatch = typeMatch.find(c => {
                  const normName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return normName.includes(searchCat) || searchCat.includes(normName);
              });
              if (exactMatch) categoryId = exactMatch.id;
          }
  
          const record = {
              transaction_date: new Date().toISOString().slice(0,10),
              description: capitalizeFirstLetter(data.description || doc.content),
              amount: parseFloat(data.amount) || 0,
              type: safeType,
              category_id: categoryId,
              profile: 'Ambos',
              currency: 'COP'
          };
  
          if (record.amount <= 0) throw new Error("El monto debe ser mayor a 0 (IA extrajo: " + record.amount + ")");
  
          const { error } = await supabase.from('finance_transactions').insert([record]);
          if (error) throw new Error("DB Error: " + error.message);
          
          await supabase.from('inbox').delete().eq('id', id);
          showToast(`✅ ${safeType === 'income' ? 'Ingreso' : 'Gasto'} registrado: $${record.amount}`);
          fetchInbox();
          if (typeof fetchFinanceData === 'function') fetchFinanceData();
      } catch (e) {
          console.error("AI Finance Error:", e);
          showToast("⚠️ Error: " + e.message);
      }
  };
  
  window.processFinanceAI = async () => {
      const inputEl = $('finance-ai-input');
      if (!inputEl) return;
      const text = inputEl.value.trim();
      if (!text) return;
      
      showToast("🤖 Analizando transacción con IA...");
      try {
          const categories = (window.financeState.categories || []).map(c => c.name).join(", ");
          const res = await fetch(FINANCE_ASSISTANT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  text: text + " (Nota: Mantén el monto como un número entero en COP, sin puntos ni comas decimales. Ej: '103753' o '103.753' es 103753, NO 103.75)",
                  categories: categories
              })
          });
          if (!res.ok) throw new Error("HTTP error " + res.status);
          let data = await res.json();
  
          // n8n Agent often nests result in .output
          if (data.output && typeof data.output === 'object') {
              data = data.output;
          } else if (Array.isArray(data) && data[0]?.output) {
              data = data[0].output;
          } else if (Array.isArray(data) && data[0]) {
              data = data[0];
          }
          
          const safeType = data.type?.toLowerCase() === 'income' ? 'income' : 'expense';
          const cats = window.financeState.categories || [];
          const typeMatch = cats.filter(c => (c.transaction_type || c.type) === safeType);
          let categoryId = typeMatch.length ? typeMatch[0].id : null;
          if (data.category && typeMatch.length) {
              const searchCat = data.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const exactMatch = typeMatch.find(c => {
                  const normName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return normName.includes(searchCat) || searchCat.includes(normName);
              });
              if (exactMatch) categoryId = exactMatch.id;
          }
  
          const record = {
              transaction_date: new Date().toISOString().slice(0,10),
              description: capitalizeFirstLetter(data.description || text),
              amount: parseFloat(data.amount) || 0,
              type: safeType,
              category_id: categoryId,
              profile: 'Ambos',
              currency: 'COP'
          };
  
          if (record.amount <= 0) throw new Error("El monto debe ser mayor a 0 (IA extrajo: " + record.amount + ")");
  
          const { error } = await supabase.from('finance_transactions').insert([record]);
          if (error) throw new Error("DB Error: " + error.message);
          
          inputEl.value = '';
          showToast(`✅ ${safeType === 'income' ? 'Ingreso' : 'Gasto'} registrado: $${record.amount}`);
          if (typeof fetchFinanceData === 'function') fetchFinanceData();
      } catch (e) {
          console.error("AI Finance Error:", e);
          showToast("⚠️ Error: " + e.message);
      }
  };
  
  window.deleteInboxItem = async (id) => {
      if (!confirm("¿Eliminar esta idea del Inbox?")) return;
      try {
          const { error } = await supabase.from('inbox').delete().eq('id', id);
          if (error) throw error;
          showToast("🗑️ Eliminado del Inbox");
      } catch (e) {
          inboxDocs = inboxDocs.filter(d => String(d.id) !== String(id));
          localStorage.setItem('axon_inbox_docs', JSON.stringify(inboxDocs));
          showToast("🗑️ Eliminado Localmente");
      }
      fetchInbox();
  };

  return { fetchVaultDocs: window.fetchVaultDocs || (() => {}), fetchInbox: window.fetchInbox || (() => {}), renderVault: window.renderVault || (() => {}), renderInbox: window.renderInbox || (() => {}) };
}
