import { supabase, $, showToast } from './config.js';

export function initFinance() {
  // ==================== FINANCE MODULE v2 ====================
  window.financeState = {
    transactions: [],
    categories: [],
    budgets: [],
    goals: [],
    filterType: 'all',
    filterCategory: 'all',
    filterProfile: 'all'
  };
  
  function formatCurrency(amount) {
    return '$' + Number(amount).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  
  function formatCurrencyUSD(amount) {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  function fmtMoney(amount, currency) {
    if (currency === 'USD') return formatCurrencyUSD(amount);
    return formatCurrency(amount);
  }
  
  // ===== SUB-TAB SWITCHING =====
  window.switchFinanceTab = (tab, btn) => {
    document.querySelectorAll('.finance-subtab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.finance-tab-content').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const content = $('finance-tab-' + tab);
    if (content) content.classList.add('active');
  
    if (tab === 'budgets') renderBudgets();
    if (tab === 'goals') renderGoals();
    if (tab === 'transactions') renderFinanceDashboard();
  };
  
  // ===== MAIN FETCH =====
  async function fetchFinanceData() {
    const [transRes, catRes, budRes, goalRes] = await Promise.all([
      supabase.from('finance_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('finance_categories').select('*').order('sort_order'),
      supabase.from('finance_budgets').select('*'),
      supabase.from('finance_savings_goals').select('*').order('created_at', { ascending: false })
    ]);
    if (transRes.data) window.financeState.transactions = transRes.data;
    if (catRes.data) window.financeState.categories = catRes.data;
    if (budRes.data) window.financeState.budgets = budRes.data;
    if (goalRes.data) window.financeState.goals = goalRes.data;
  
    // Set month filter to current month
    const monthInput = $('finance-month-filter');
    if (monthInput && !monthInput.value) {
      const now = new Date();
      monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    // Set budget month to current month
    const budMonth = $('budget-month');
    if (budMonth && !budMonth.value) {
      const now = new Date();
      budMonth.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
  
    renderFinanceCategories();
    renderFinanceDashboard();
    // If a non-transactions tab is active, render it
    const activeTab = document.querySelector('.finance-subtab.active');
    if (activeTab) {
      const tab = activeTab.dataset.ftab;
      if (tab === 'budgets') renderBudgets();
      if (tab === 'goals') renderGoals();
    }
  }
  
  function renderFinanceCategories() {
    const catFilter = $('finance-category-filter');
    if (catFilter) {
      const currentVal = catFilter.value;
      catFilter.innerHTML = '<option value="all">Todas categorías</option>';
      window.financeState.categories.forEach(c => {
        if (c.transaction_type === 'expense' || c.transaction_type === 'both') {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.icon || '📦'} ${c.name}`;
          catFilter.appendChild(opt);
        }
      });
      catFilter.value = currentVal;
    }
  
    // Category select in modal
    const catSelect = $('finance-category');
    if (catSelect) {
      catSelect.innerHTML = '';
      window.financeState.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon || '📦'} ${c.name}`;
        catSelect.appendChild(opt);
      });
    }
  
    // Budget category select
    const budCat = $('budget-category');
    if (budCat) {
      budCat.innerHTML = '';
      window.financeState.categories.forEach(c => {
        if (c.transaction_type === 'expense' || c.transaction_type === 'both') {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.icon || '📦'} ${c.name}`;
          budCat.appendChild(opt);
        }
      });
    }
  }
  
  // ===== INCOME BASE AVERAGE (rolling 3 months) =====
  function calcIncomeBase() {
    const txs = window.financeState.transactions;
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  
    // Group income by month for last 3 complete months
    const monthlyIncome = {};
    txs.forEach(t => {
      if (t.type !== 'income') return;
      const d = new Date(t.transaction_date + 'T00:00:00');
      if (d < threeMonthsAgo) return;
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthlyIncome[key] = (monthlyIncome[key] || 0) + Number(t.amount);
    });
  
    const values = Object.values(monthlyIncome);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  function renderBaseIncome() {
    const el = $('finance-base-income');
    if (!el) return;
    const avg = calcIncomeBase();
    const avgEl = $('finance-base-amount');
    if (avgEl) avgEl.textContent = formatCurrency(Math.round(avg));
  }
  
  // ===== TRANSACTIONS DASHBOARD =====
  function renderFinanceDashboard() {
    // Only render if transactions tab is active
    const tabContent = $('finance-tab-transactions');
    if (!tabContent || !tabContent.classList.contains('active')) return;
  
    const list = $('finance-transactions-list');
    if (!list) return;
  
    const monthVal = $('finance-month-filter')?.value;
    let filtered = [...window.financeState.transactions];
  
    if (monthVal) {
      filtered = filtered.filter(t => t.transaction_date && t.transaction_date.startsWith(monthVal));
    }
    if (window.financeState.filterType !== 'all') {
      filtered = filtered.filter(t => t.type === window.financeState.filterType);
    }
    if (window.financeState.filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category_id === window.financeState.filterCategory);
    }
    if (window.financeState.filterProfile !== 'all') {
      filtered = filtered.filter(t => (t.profile || 'Ambos') === window.financeState.filterProfile);
    }
  
    const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = totalIncome - totalExpense;
  
    const incomeEl = $('finance-total-income');
    const expenseEl = $('finance-total-expense');
    const balanceEl = $('finance-total-balance');
    if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
    if (expenseEl) expenseEl.textContent = formatCurrency(totalExpense);
    if (balanceEl) {
      balanceEl.textContent = formatCurrency(Math.abs(balance));
      balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
      const card = balanceEl.closest('.finance-card');
      if (card) card.style.borderLeftColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  
    // Base income
    renderBaseIncome();
  
    if (filtered.length === 0) {
      list.innerHTML = '<div class="finance-empty">🎯 No hay transacciones este mes. ¡Agrega tu primera!</div>';
      return;
    }
  
    list.innerHTML = filtered.map(t => {
      const cat = window.financeState.categories.find(c => c.id === t.category_id);
      const catName = cat ? `${cat.icon || '📦'} ${cat.name}` : 'Sin categoría';
      const dateStr = t.transaction_date
        ? new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        : '';
      const isIncome = t.type === 'income';
      const profile = t.profile || 'Ambos';
      const currency = t.currency || 'COP';
      const currLabel = currency === 'USD' ? '🇺🇸' : '🇨🇴';
      return `
        <div class="finance-tx-item" data-id="${t.id}">
          <div class="finance-tx-left">
            <div class="finance-tx-category-icon">${cat?.icon || '📦'}</div>
            <div class="finance-tx-info">
              <div class="finance-tx-desc">
                ${escHtml(t.description)}
                <span style="font-size:0.6rem;margin-left:0.3rem;opacity:0.6;">${currLabel}</span>
              </div>
              <div class="finance-tx-meta">
                <span class="finance-tx-category">${escHtml(catName)}</span>
                ${t.establishment ? `<span class="finance-tx-establishment">📍 ${escHtml(t.establishment)}</span>` : ''}
                <span class="finance-tx-profile">${profile === 'Pipe' ? '👨' : profile === 'Tati' ? '👩' : '👫'} ${profile}</span>
                <span class="finance-tx-date">${dateStr}</span>
              </div>
            </div>
          </div>
          <div class="finance-tx-right">
            <div class="finance-tx-amount ${isIncome ? 'tx-income' : 'tx-expense'}">
              ${isIncome ? '+' : '-'}${fmtMoney(t.amount, currency)}
            </div>
            <div class="finance-tx-actions">
              ${t.invoice_url ? `<a href="${escHtml(t.invoice_url)}" target="_blank" class="finance-tx-action" title="Ver factura">🧾</a>` : ''}
              <button class="finance-tx-action" onclick="window.editFinanceTransaction('${t.id}')" title="Editar">✏️</button>
              <button class="finance-tx-action" onclick="window.deleteFinanceTransaction('${t.id}')" title="Eliminar">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  // ===== FILTERS =====
  window.setFinanceTypeFilter = (type, btn) => {
    window.financeState.filterType = type;
    document.querySelectorAll('.finance-type-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFinanceDashboard();
  };
  
  document.addEventListener('change', (e) => {
    if (e.target.id === 'finance-month-filter') renderFinanceDashboard();
    if (e.target.id === 'finance-category-filter') {
      window.financeState.filterCategory = e.target.value;
      renderFinanceDashboard();
    }
    if (e.target.id === 'finance-profile-filter') {
      window.financeState.filterProfile = e.target.value;
      renderFinanceDashboard();
    }
    if (e.target.id === 'budget-month') renderBudgets();
  });
  
  // ===== TRANSACTION MODAL =====
  window.openFinanceModal = () => {
    const modal = $('finance-modal');
    if (!modal) return;
    $('finance-modal-title').textContent = '💰 Nueva Transacción';
    $('edit-finance-id').value = '';
    $('finance-date').value = new Date().toISOString().slice(0, 10);
    $('finance-description').value = '';
    $('finance-establishment').value = '';
    $('finance-amount').value = '';
    $('finance-invoice').value = '';
    $('finance-notes').value = '';
    $('finance-profile').value = 'Ambos';
    $('finance-currency').value = 'COP';
    $('finance-rate').value = '';
    document.getElementById('finance-rate-container').style.display = 'none';
  
    document.querySelectorAll('.finance-type-toggle-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
  
    renderFinanceCategories();
    modal.style.display = 'flex';
  };
  
  window.selectFinanceType = (type, btn) => {
    document.querySelectorAll('.finance-type-toggle-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  };
  
  window.toggleFinanceRateField = () => {
    const curr = $('finance-currency')?.value;
    const container = document.getElementById('finance-rate-container');
    if (container) container.style.display = curr === 'USD' ? 'flex' : 'none';
  };
  
  window.saveFinanceTransaction = async () => {
    const id = $('edit-finance-id').value;
    const date = $('finance-date').value;
    const description = $('finance-description').value.trim();
    const category_id = $('finance-category').value;
    const establishment = $('finance-establishment').value.trim();
    const amount = parseFloat($('finance-amount').value);
    const typeBtn = document.querySelector('.finance-type-toggle-btn.active');
    const type = typeBtn ? typeBtn.dataset.financeType : 'expense';
    const invoiceUrl = $('finance-invoice').value.trim();
    const notes = $('finance-notes').value.trim();
    const profile = $('finance-profile')?.value || 'Ambos';
    const currency = $('finance-currency')?.value || 'COP';
    const exchangeRate = currency === 'USD' ? parseFloat($('finance-rate')?.value) || null : null;
  
    if (!description) { showToast('⚠️ Describe la transacción'); return; }
    if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }
    if (!category_id) { showToast('⚠️ Selecciona una categoría'); return; }
  
    const record = { transaction_date: date, description, category_id, establishment, amount, type, invoice_url: invoiceUrl, notes, profile, currency, exchange_rate: exchangeRate };
  
    if (id) {
      const { error } = await supabase.from('finance_transactions').update(record).eq('id', id);
      if (error) { showToast('⚠️ Error al actualizar'); console.error(error); return; }
      showToast('✅ Transacción actualizada');
    } else {
      const { error } = await supabase.from('finance_transactions').insert([record]);
      if (error) { showToast('⚠️ Error al guardar'); console.error(error); return; }
      showToast('✅ Transacción guardada');
    }
  
    window.closeModal('finance-modal');
    fetchFinanceData();
  };
  
  window.editFinanceTransaction = async (id) => {
    const t = window.financeState.transactions.find(t => t.id === id);
    if (!t) return;
    const modal = $('finance-modal');
    $('finance-modal-title').textContent = '✏️ Editar Transacción';
    $('edit-finance-id').value = id;
    $('finance-date').value = t.transaction_date || '';
    $('finance-description').value = t.description || '';
    $('finance-establishment').value = t.establishment || '';
    $('finance-amount').value = t.amount;
    $('finance-invoice').value = t.invoice_url || '';
    $('finance-notes').value = t.notes || '';
    $('finance-profile').value = t.profile || 'Ambos';
    $('finance-currency').value = t.currency || 'COP';
    if (t.currency === 'USD' && t.exchange_rate) {
      $('finance-rate').value = t.exchange_rate;
      document.getElementById('finance-rate-container').style.display = 'flex';
    } else {
      $('finance-rate').value = '';
      document.getElementById('finance-rate-container').style.display = 'none';
    }
  
    document.querySelectorAll('.finance-type-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.financeType === t.type);
    });
  
    renderFinanceCategories();
    if ($('finance-category')) $('finance-category').value = t.category_id || '';
    modal.style.display = 'flex';
  };
  
  window.deleteFinanceTransaction = async (id) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
    if (error) { showToast('⚠️ Error al eliminar'); return; }
    showToast('🗑️ Transacción eliminada');
    fetchFinanceData();
  };
  
  // ==================== CATEGORY MANAGEMENT ====================
  window.openFinanceCategoryModal = async () => {
    const modal = $('finance-category-modal');
    if (!modal) return;
    await renderCategoryList();
    modal.style.display = 'flex';
  };
  
  async function renderCategoryList() {
    const list = $('finance-category-list');
    if (!list) return;
    const { data } = await supabase.from('finance_categories').select('*').order('sort_order');
    if (!data || data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:1rem;">Sin categorías aún</p>';
      return;
    }
    list.innerHTML = data.map(c => `
      <div class="finance-cat-item">
        <span class="finance-cat-icon">${c.icon || '📦'}</span>
        <div class="finance-cat-info">
          <span class="finance-cat-name">${escHtml(c.name)}</span>
          <span class="finance-cat-type">${c.transaction_type === 'income' ? '📈 Ingreso' : c.transaction_type === 'expense' ? '📉 Gasto' : 'Ambos'}</span>
        </div>
        <button class="finance-tx-action" onclick="window.deleteFinanceCategory('${c.id}')" title="Eliminar">🗑️</button>
      </div>
    `).join('');
  }
  
  window.addFinanceCategory = async () => {
    const name = $('new-category-name').value.trim();
    if (!name) { showToast('⚠️ Escribe un nombre'); return; }
    const defaultType = window.financeState.filterType !== 'all' ? window.financeState.filterType : 'expense';
    const { error } = await supabase.from('finance_categories').insert([{ name, transaction_type: defaultType }]);
    if (error) { showToast('⚠️ Error al crear categoría'); return; }
    $('new-category-name').value = '';
    showToast('✅ Categoría creada');
    await renderCategoryList();
    fetchFinanceData();
  };
  
  window.deleteFinanceCategory = async (id) => {
    if (!confirm('¿Eliminar esta categoría? Las transacciones asociadas quedarán sin categoría.')) return;
    const { error } = await supabase.from('finance_categories').delete().eq('id', id);
    if (error) { showToast('⚠️ Error al eliminar'); return; }
    showToast('🗑️ Categoría eliminada');
    await renderCategoryList();
    fetchFinanceData();
  };
  
  // ==================== BUDGETS ====================
  function renderBudgets() {
    const list = $('budgets-list');
    if (!list) return;
  
    const monthVal = $('budget-month')?.value;
    if (!monthVal) return;
  
    const categories = window.financeState.categories;
    const expenseCats = categories.filter(c => c.transaction_type === 'expense' || c.transaction_type === 'both');
  
    // Calculate spending per category this month
    const spending = {};
    window.financeState.transactions.forEach(t => {
      if (t.type !== 'expense') return;
      if (!t.transaction_date || !t.transaction_date.startsWith(monthVal)) return;
      const catId = t.category_id;
      spending[catId] = (spending[catId] || 0) + Number(t.amount);
    });
  
    // Get budgets for this month
    const budgets = window.financeState.budgets.filter(b => b.month === monthVal);
    const budgetMap = {};
    budgets.forEach(b => { budgetMap[b.category_id] = Number(b.amount); });
  
    // Summary
    let totalBudgeted = 0, totalSpent = 0;
    expenseCats.forEach(c => {
      if (budgetMap[c.id]) totalBudgeted += budgetMap[c.id];
      if (spending[c.id]) totalSpent += spending[c.id];
    });
  
    const summaryBudgetEl = $('budget-total-budgeted');
    const summarySpentEl = $('budget-total-spent');
    const summaryFill = $('budget-summary-fill');
    const summaryRemain = $('budget-total-remaining');
    if (summaryBudgetEl) summaryBudgetEl.textContent = formatCurrency(totalBudgeted);
    if (summarySpentEl) summarySpentEl.textContent = formatCurrency(totalSpent);
    if (summaryFill) {
      const pct = totalBudgeted > 0 ? Math.min(100, (totalSpent / totalBudgeted) * 100) : 0;
      summaryFill.style.width = pct + '%';
    }
    if (summaryRemain) {
      const remaining = totalBudgeted - totalSpent;
      summaryRemain.textContent = remaining >= 0 ? `Restan ${formatCurrency(remaining)}` : `Excedido por ${formatCurrency(Math.abs(remaining))}`;
      summaryRemain.style.color = remaining >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  
    // Render each category
    list.innerHTML = expenseCats.map(c => {
      const spent = spending[c.id] || 0;
      const budgeted = budgetMap[c.id] || 0;
      const pct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
      const barClass = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : 'safe';
      const hasBudget = budgeted > 0;
  
      return `
        <div class="budget-item">
          <div class="budget-item-icon">${c.icon || '📦'}</div>
          <div class="budget-item-info">
            <div class="budget-item-name">${escHtml(c.name)}</div>
            ${hasBudget ? `
              <div class="budget-item-bar">
                <div class="budget-item-fill ${barClass}" style="width:${pct}%"></div>
              </div>
              <div class="budget-item-stats">
                <span>${formatCurrency(spent)} de ${formatCurrency(budgeted)}</span>
                <span>(${Math.round(pct)}%)</span>
              </div>
            ` : `
              <div class="budget-item-stats" style="color:var(--text-muted);">
                ${formatCurrency(spent)} gastado — sin presupuesto
              </div>
            `}
          </div>
          <div class="budget-item-right">
            <div class="budget-item-spent ${pct >= 100 ? 'tx-expense' : ''}">${formatCurrency(spent)}</div>
            <div class="budget-item-limit">${hasBudget ? 'Meta: ' + formatCurrency(budgeted) : '—'}</div>
          </div>
          <div class="budget-item-actions">
            <button class="finance-tx-action" onclick="window.openBudgetModal('${c.id}')" title="Presupuestar">📝</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  window.openBudgetModal = (categoryId) => {
    const modal = $('budget-modal');
    if (!modal) return;
    $('edit-budget-id').value = '';
    renderFinanceCategories();
    if ($('budget-category')) $('budget-category').value = categoryId || '';
  
    // Pre-fill existing budget
    const monthVal = $('budget-month')?.value;
    if (monthVal) {
      const existing = window.financeState.budgets.find(b => b.category_id === categoryId && b.month === monthVal);
      if (existing) {
        $('edit-budget-id').value = existing.id;
        $('budget-amount').value = existing.amount;
      } else {
        $('budget-amount').value = '';
      }
    }
    modal.style.display = 'flex';
  };
  
  window.saveBudget = async () => {
    const id = $('edit-budget-id').value;
    const category_id = $('budget-category').value;
    const month = $('budget-month')?.value;
    const amount = parseFloat($('budget-amount').value);
  
    if (!category_id) { showToast('⚠️ Selecciona una categoría'); return; }
    if (!month) { showToast('⚠️ Selecciona un mes'); return; }
    if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido'); return; }
  
    const record = { category_id, month, amount };
  
    if (id) {
      const { error } = await supabase.from('finance_budgets').update(record).eq('id', id);
      if (error) { showToast('⚠️ Error al actualizar'); return; }
      showToast('✅ Presupuesto actualizado');
    } else {
      const { error } = await supabase.from('finance_budgets').insert([record]);
      if (error) { showToast('⚠️ Error al guardar'); return; }
      showToast('✅ Presupuesto creado');
    }
  
    window.closeModal('budget-modal');
    fetchFinanceData();
  };
  
  // ==================== SAVINGS GOALS ====================
  function renderGoals() {
    const list = $('goals-list');
    if (!list) return;
  
    const goals = window.financeState.goals.filter(g => !g.is_archived);
    const archived = window.financeState.goals.filter(g => g.is_archived);
  
    if (goals.length === 0 && archived.length === 0) {
      list.innerHTML = '<div class="finance-empty">🎯 No hay metas aún. ¡Crea tu primera meta de ahorro!</div>';
      return;
    }
  
    list.innerHTML = [
      ...goals.map(g => renderGoalCard(g)),
      ...(archived.length > 0 ? [`<div style="grid-column:1/-1;margin-top:0.5rem;"><details style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.5rem;"><summary style="cursor:pointer;font-size:0.75rem;color:var(--text-dim);font-weight:600;">📦 Metas archivadas (${archived.length})</summary><div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem;">${archived.map(g => renderGoalCard(g, true)).join('')}</div></details></div>`] : '')
    ].join('');
  }
  
  function renderGoalCard(goal, isArchived = false) {
    const pct = goal.target_amount > 0 ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100) : 0;
    const remaining = Number(goal.target_amount) - Number(goal.current_amount);
    const deadlineStr = goal.deadline ? new Date(goal.deadline + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    const currency = goal.currency || 'COP';
  
    return `
      <div class="goal-card ${isArchived ? 'goal-archived' : ''}" style="--goal-color: ${goal.color || '#8b5cf6'};">
        <div class="goal-card-header">
          <span class="goal-card-icon">${goal.icon || '🎯'}</span>
          <span class="goal-card-name">${escHtml(goal.name)}</span>
          <span class="goal-card-currency">${currency === 'USD' ? '🇺🇸 USD' : '🇨🇴 COP'}</span>
        </div>
        <div class="goal-card-progress">
          <div class="goal-card-bar">
            <div class="goal-card-fill" style="width:${pct}%;background:${goal.color || '#8b5cf6'};"></div>
          </div>
          <div class="goal-card-amounts">
            <span><strong>${fmtMoney(goal.current_amount, currency)}</strong> / ${fmtMoney(goal.target_amount, currency)}</span>
            <span class="goal-card-pct">${Math.round(pct)}%</span>
          </div>
        </div>
        <div class="goal-card-footer">
          <div>
            ${deadlineStr ? `<span class="goal-card-deadline">📅 ${deadlineStr}</span>` : '<span class="goal-card-deadline" style="opacity:0;">Sin fecha</span>'}
            ${pct >= 100 ? '<span style="font-size:0.65rem;color:var(--success);font-weight:700;">✅ Completada</span>' : `<span style="font-size:0.65rem;color:var(--text-dim);">Restan ${fmtMoney(remaining, currency)}</span>`}
          </div>
          <div class="goal-card-actions">
            ${pct < 100 ? `<button onclick="window.openGoalDepositModal('${goal.id}')" title="Depositar">💰</button>` : ''}
            <button onclick="window.editFinanceGoal('${goal.id}')" title="Editar">✏️</button>
            <button onclick="window.toggleArchiveGoal('${goal.id}')" title="${isArchived ? 'Restaurar' : 'Archivar'}">${isArchived ? '📦' : '🗂️'}</button>
            <button onclick="window.deleteFinanceGoal('${goal.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }
  
  // Open goal modal
  window.openFinanceGoalModal = () => {
    const modal = $('goal-modal');
    if (!modal) return;
    $('goal-modal-title').textContent = '🎯 Nueva Meta';
    $('edit-goal-id').value = '';
    $('goal-name').value = '';
    $('goal-target').value = '';
    $('goal-currency').value = 'COP';
    $('goal-deadline').value = '';
    $('goal-notes').value = '';
    $('goal-icon').value = '🎯';
    modal.style.display = 'flex';
  };
  
  window.saveFinanceGoal = async () => {
    const id = $('edit-goal-id').value;
    const name = $('goal-name').value.trim();
    const targetAmount = parseFloat($('goal-target').value);
    const currency = $('goal-currency').value;
    const icon = $('goal-icon').value;
    const deadline = $('goal-deadline').value || null;
    const notes = $('goal-notes').value.trim();
  
    if (!name) { showToast('⚠️ Dale un nombre a la meta'); return; }
    if (!targetAmount || targetAmount <= 0) { showToast('⚠️ Ingresa una meta válida'); return; }
  
    const record = { name, target_amount: targetAmount, currency, icon, deadline, notes };
  
    if (id) {
      const { error } = await supabase.from('finance_savings_goals').update(record).eq('id', id);
      if (error) { showToast('⚠️ Error al actualizar'); return; }
      showToast('✅ Meta actualizada');
    } else {
      const { error } = await supabase.from('finance_savings_goals').insert([{ ...record, current_amount: 0 }]);
      if (error) { showToast('⚠️ Error al crear'); return; }
      showToast('✅ Meta creada');
    }
  
    window.closeModal('goal-modal');
    fetchFinanceData();
  };
  
  window.editFinanceGoal = async (id) => {
    const g = window.financeState.goals.find(g => g.id === id);
    if (!g) return;
    const modal = $('goal-modal');
    $('goal-modal-title').textContent = '✏️ Editar Meta';
    $('edit-goal-id').value = id;
    $('goal-name').value = g.name || '';
    $('goal-target').value = g.target_amount;
    $('goal-currency').value = g.currency || 'COP';
    $('goal-deadline').value = g.deadline || '';
    $('goal-notes').value = g.notes || '';
    $('goal-icon').value = g.icon || '🎯';
    modal.style.display = 'flex';
  };
  
  // Deposit to goal
  window.openGoalDepositModal = (goalId) => {
    const g = window.financeState.goals.find(g => g.id === goalId);
    if (!g) return;
    const modal = $('goal-deposit-modal');
    $('deposit-goal-id').value = goalId;
    $('deposit-goal-name').textContent = `Depositar a: ${g.icon || '🎯'} ${escHtml(g.name)}`;
    $('deposit-amount').value = '';
    $('deposit-notes').value = '';
    modal.style.display = 'flex';
  };
  
  window.confirmGoalDeposit = async () => {
    const goalId = $('deposit-goal-id').value;
    const amount = parseFloat($('deposit-amount').value);
    const notes = $('deposit-notes').value.trim();
  
    if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto'); return; }
  
    const g = window.financeState.goals.find(g => g.id === goalId);
    if (!g) return;
  
    // Update goal current_amount
    const newAmount = Number(g.current_amount) + amount;
    const { error: updateErr } = await supabase.from('finance_savings_goals').update({ current_amount: newAmount }).eq('id', goalId);
    if (updateErr) { showToast('⚠️ Error al depositar'); return; }
  
    // Record movement
    await supabase.from('finance_savings_movements').insert([{
      goal_id: goalId, amount, type: 'deposit', notes
    }]);
  
    showToast(`💰 ${fmtMoney(amount, g.currency)} depositados a ${g.name}`);
    window.closeModal('goal-deposit-modal');
    fetchFinanceData();
  };
  
  window.toggleArchiveGoal = async (id) => {
    const g = window.financeState.goals.find(g => g.id === id);
    if (!g) return;
    const { error } = await supabase.from('finance_savings_goals').update({ is_archived: !g.is_archived }).eq('id', id);
    if (error) { showToast('⚠️ Error'); return; }
    showToast(g.is_archived ? '📦 Meta restaurada' : '📦 Meta archivada');
    fetchFinanceData();
  };
  
  window.deleteFinanceGoal = async (id) => {
    if (!confirm('¿Eliminar esta meta definitivamente? Se borrarán también sus movimientos.')) return;
    const { error } = await supabase.from('finance_savings_goals').delete().eq('id', id);
    if (error) { showToast('⚠️ Error al eliminar'); return; }
    showToast('🗑️ Meta eliminada');
    fetchFinanceData();
  };
  
  // ===== CLOSE MODALS =====
  document.addEventListener('click', (e) => {
    ['finance-modal', 'finance-category-modal', 'budget-modal', 'goal-modal', 'goal-deposit-modal'].forEach(id => {
      const el = $(id);
      if (el && e.target === el) el.style.display = 'none';
    });
  });

  // Retornar API publica
  return { fetchFinanceData };
}
