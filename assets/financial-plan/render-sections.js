/**
 * Goal 2 per-debt UI + debts list inside the balance editor (DOM builders).
 */

import { DEFAULT_DEBT_APR_PCT, DEFAULT_SAVINGS_APY_PCT } from './plan-data.js';
import { numOr, formatMoneyInput } from './utils.js';

/** Normalize legacy sort keys for UI + sorting. */
export function normalizeDebtsEditorSort(mode) {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return m;
}

export function normalizeDebtsProgressSort(mode) {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return m;
}

function sortDebtListByMode(list, mode) {
  if (mode === 'saved') return list;
  if (mode === 'balance-desc' || mode === 'balance-asc') {
    const dir = mode === 'balance-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.current, 0) - numOr(b.current, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'apr-desc' || mode === 'apr-asc') {
    const dir = mode === 'apr-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff =
        (numOr(a.aprPct, DEFAULT_DEBT_APR_PCT) - numOr(b.aprPct, DEFAULT_DEBT_APR_PCT)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'paid-desc' || mode === 'paid-asc') {
    const dir = mode === 'paid-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.paidOff, 0) - numOr(b.paidOff, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  return list;
}

/**
 * Debts in Goal 2 editor row order (saved array order, or balance / APR).
 * @param {{ debts?: unknown[], debtsEditorSort?: string }} plan
 */
export function getDebtsInEditorOrder(plan) {
  const list = Array.isArray(plan.debts) ? plan.debts.slice() : [];
  const mode = normalizeDebtsEditorSort(plan.debtsEditorSort);
  return sortDebtListByMode(list, mode);
}

/**
 * Order for Goal 2 per-debt progress cards (`#goal2-debts`).
 * @param {{ debts?: unknown[], debtsProgressSort?: string }} plan
 */
export function getDebtsInProgressOrder(plan) {
  const list = Array.isArray(plan.debts) ? plan.debts.slice() : [];
  const mode = normalizeDebtsProgressSort(plan.debtsProgressSort);
  return sortDebtListByMode(list, mode);
}

export function renderGoal2Debts(plan, moneyExact) {
  const host = document.getElementById('goal2-debts');
  if (!host) return;
  host.innerHTML = '';
  const debts = getDebtsInProgressOrder(plan);
  debts.forEach(function (debt) {
    const current = Number.isFinite(debt.current) ? debt.current : 0;
    const paid = Number.isFinite(debt.paidOff) ? debt.paidOff : 0;
    const start = Math.max(0, current + paid);
    const pct = start > 0 ? Math.min(100, (Math.max(0, paid) / start) * 100) : 0;

    const wrap = document.createElement('div');
    wrap.className = 'goal2-debt';

    const head = document.createElement('div');
    head.className = 'goal2-debt-head';
    const name = document.createElement('div');
    name.className = 'goal2-debt-name';
    name.textContent = debt.name || 'Debt';
    const meta = document.createElement('div');
    meta.className = 'goal2-debt-meta';
    meta.textContent = moneyExact(current) + ' remaining';
    head.appendChild(name);
    head.appendChild(meta);

    const labels = document.createElement('div');
    labels.className = 'progress-label-row debt';
    labels.innerHTML = '<span>' + moneyExact(paid) + ' paid</span><span><strong>' + pct.toFixed(1) + '%</strong></span>';

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill-debt';
    fill.style.width = pct.toFixed(2) + '%';
    track.appendChild(fill);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const history = Array.isArray(debt.paymentHistory) ? debt.paymentHistory : [];
    const recent = history.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal2-debt-payments';
    const summary = document.createElement('summary');
    summary.className = 'goal2-debt-payments-summary';
    summary.textContent = 'Recent payments (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal2-debt-payments-empty';
      empty.textContent = 'No payments recorded in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal2-debt-payments-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        li.className = 'goal2-debt-payment-row';
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal2-debt-payment-meta';
        metaSpan.textContent = moneyExact(Number(p.amount)) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal2-remove-payment no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-debt-id', String(debt.id));
        rm.setAttribute('data-payment-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    wrap.appendChild(head);
    wrap.appendChild(labels);
    wrap.appendChild(track);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}

export function appendDebtsEditorEmptyState(host) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">📊</div>' +
    '<h3 class="editor-empty-state__title">No debts yet</h3>' +
    '<p class="editor-empty-state__text">Add credit cards or loans to track balances, APR, promos, and payments. Use <strong>+ Add debt</strong> below to get started.</p>';
  host.appendChild(wrap);
}

export function renderDebtsEditor(plan) {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  host.innerHTML = '';
  const debts = getDebtsInEditorOrder(plan);
  if (debts.length === 0) {
    appendDebtsEditorEmptyState(host);
    return;
  }
  debts.forEach(function (debt) {
    const row = document.createElement('div');
    row.className = 'debt-row';
    row.setAttribute('data-debt-id', debt.id);

    const nameField = document.createElement('div');
    nameField.className = 'balance-field';
    nameField.innerHTML = '<label>Debt name</label><input type="text" data-field="name" autocomplete="off" value="">';
    const nameInput = nameField.querySelector('input');
    nameInput.value = debt.name || '';

    const curField = document.createElement('div');
    curField.className = 'balance-field';
    curField.innerHTML =
      '<label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" value="">';
    const curInput = curField.querySelector('input');
    curInput.value = formatMoneyInput(numOr(debt.current, 0));

    const aprField = document.createElement('div');
    aprField.className = 'balance-field';
    aprField.innerHTML =
      '<label>APR %</label><input type="text" data-field="aprPct" inputmode="decimal" autocomplete="off" placeholder="0" value="">';
    const aprInput = aprField.querySelector('input');
    aprInput.value = formatMoneyInput(numOr(debt.aprPct, DEFAULT_DEBT_APR_PCT));

    const defField = document.createElement('div');
    defField.className = 'balance-field';
    defField.innerHTML =
      '<label>Deferred $ (0% promo)</label><input type="text" data-field="deferredAmount" inputmode="decimal" autocomplete="off" value="">';
    const defInput = defField.querySelector('input');
    defInput.value = formatMoneyInput(numOr(debt.deferredAmount, 0));

    const defDateField = document.createElement('div');
    defDateField.className = 'balance-field';
    defDateField.innerHTML =
      '<label>Deferred expires</label><input type="date" data-field="deferredExpiresOn" autocomplete="off" value="">';
    const defDateInput = defDateField.querySelector('input');
    defDateInput.value = typeof debt.deferredExpiresOn === 'string' ? debt.deferredExpiresOn : '';

    const payField = document.createElement('div');
    payField.className = 'balance-field';
    payField.innerHTML =
      '<label>Payment</label><input type="text" data-field="payment" inputmode="decimal" autocomplete="off" placeholder="0.00">';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn-remove-debt';
    rm.setAttribute('data-action', 'remove');
    rm.textContent = 'Remove';

    row.appendChild(nameField);
    row.appendChild(curField);
    row.appendChild(aprField);
    row.appendChild(defField);
    row.appendChild(defDateField);
    row.appendChild(payField);
    actions.appendChild(rm);
    row.appendChild(actions);
    host.appendChild(row);
  });
}

export function syncDebtsEditorSortSelect(plan) {
  const sortSel = document.getElementById('debts-editor-sort');
  if (!sortSel) return;
  sortSel.value = normalizeDebtsEditorSort(plan.debtsEditorSort);
}

export function syncDebtsProgressSortSelect(plan) {
  const sortSel = document.getElementById('debts-progress-sort');
  if (!sortSel) return;
  sortSel.value = normalizeDebtsProgressSort(plan.debtsProgressSort);
}

export function appendSavingsEditorEmptyState(host) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state editor-empty-state--savings';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">🏦</div>' +
    '<h3 class="editor-empty-state__title">No savings accounts</h3>' +
    '<p class="editor-empty-state__text">Add joint or personal accounts to track balances, APY, and deposits toward your emergency fund. Use <strong>+ Add account</strong> below.</p>';
  host.appendChild(wrap);
}

export function renderSavingsEditor(d) {
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  host.innerHTML = '';
  const accs = d.savingsAccounts || [];
  if (accs.length === 0) {
    appendSavingsEditorEmptyState(host);
    return;
  }
  accs.forEach(function (acc) {
    const row = document.createElement('div');
    row.className = 'savings-row';
    row.setAttribute('data-savings-id', acc.id);

    const nameField = document.createElement('div');
    nameField.className = 'balance-field';
    nameField.innerHTML = '<label>Account name</label><input type="text" data-field="name" autocomplete="off" value="">';
    const nameInput = nameField.querySelector('input');
    nameInput.value = acc.name || '';

    const curField = document.createElement('div');
    curField.className = 'balance-field';
    curField.innerHTML =
      '<label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" value="">';
    const curInput = curField.querySelector('input');
    curInput.value = formatMoneyInput(numOr(acc.current, 0));

    const apyField = document.createElement('div');
    apyField.className = 'balance-field';
    apyField.innerHTML =
      '<label>APY %</label><input type="text" data-field="apyPct" inputmode="decimal" autocomplete="off" placeholder="0" value="">';
    const apyInput = apyField.querySelector('input');
    apyInput.value = formatMoneyInput(numOr(acc.apyPct, DEFAULT_SAVINGS_APY_PCT));

    const depField = document.createElement('div');
    depField.className = 'balance-field';
    depField.innerHTML =
      '<label>Deposit to log</label><input type="text" data-field="deposit" inputmode="decimal" autocomplete="off" placeholder="0.00">';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn-remove-savings';
    rm.setAttribute('data-action', 'remove');
    rm.textContent = 'Remove';

    row.appendChild(nameField);
    row.appendChild(curField);
    row.appendChild(apyField);
    row.appendChild(depField);
    actions.appendChild(rm);
    row.appendChild(actions);
    host.appendChild(row);
  });
}

export function renderGoal3SavingsAccounts(d, moneyExact) {
  const host = document.getElementById('goal3-savings');
  if (!host) return;
  host.innerHTML = '';
  const accs = d.savingsAccounts || [];
  accs.forEach(function (acc) {
    const current = numOr(acc.current, 0);
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    const lifetimeDep = hist.reduce(function (s, p) {
      return s + numOr(p.amount, 0);
    }, 0);

    const wrap = document.createElement('div');
    wrap.className = 'goal3-savings-account';

    const head = document.createElement('div');
    head.className = 'goal3-savings-head';
    const name = document.createElement('div');
    name.className = 'goal3-savings-name';
    name.textContent = acc.name || 'Account';
    const meta = document.createElement('div');
    meta.className = 'goal3-savings-meta';
    const apy = numOr(acc.apyPct, 0);
    meta.textContent =
      moneyExact(current) +
      ' · ' +
      apy.toFixed(2) +
      '% APY · ' +
      moneyExact(lifetimeDep) +
      ' logged deposits (lifetime)';
    head.appendChild(name);
    head.appendChild(meta);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = hist.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal3-savings-deposits';
    const summary = document.createElement('summary');
    summary.className = 'goal3-savings-deposits-summary';
    summary.textContent = 'Recent deposits (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal3-savings-deposits-empty';
      empty.textContent = 'No deposits logged in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal3-savings-deposits-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        li.className = 'goal3-savings-deposit-row';
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal3-savings-deposit-meta';
        metaSpan.textContent = moneyExact(Number(p.amount)) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal3-remove-deposit no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-savings-id', String(acc.id));
        rm.setAttribute('data-deposit-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    wrap.appendChild(head);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}
