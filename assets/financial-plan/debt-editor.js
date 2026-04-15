/**
 * Debts editor DOM ↔ PLAN, snapshots, apply/remove payment helpers.
 */

import { PLAN, PLAN_DEFAULTS, DEFAULT_DEBT_APR_PCT } from './plan-data.js';
import { parseMoneyInput, numOr, roundMoney, formatMoneyInput } from './utils.js';
import { appendDebtsEditorEmptyState, buildDebtsEditorThead, buildDebtRowTR } from './render-sections.js';
import { normalizePaymentHistory, newPaymentId } from './persistence.js';

export function readDebtsEditorIntoPlan() {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  const rows = host.querySelectorAll('.debt-row');
  const next = [];
  const planDebts = Array.isArray(PLAN.debts) ? PLAN.debts : [];
  rows.forEach(function (row, rowIdx) {
    let id = row.getAttribute('data-debt-id');
    if (id == null || String(id).trim() === '') {
      id = planDebts[rowIdx] ? String(planDebts[rowIdx].id) : 'd_' + rowIdx;
    } else {
      id = String(id).trim();
    }
    const nameEl = row.querySelector('input[data-field="name"]');
    const curEl = row.querySelector('input[data-field="current"]');
    const aprEl = row.querySelector('input[data-field="aprPct"]');
    const defEl = row.querySelector('input[data-field="deferredAmount"]');
    const defDateEl = row.querySelector('input[data-field="deferredExpiresOn"]');
    const payEl = row.querySelector('input[data-field="payment"]');
    const name = nameEl ? String(nameEl.value || 'Debt').trim() : 'Debt';
    const rawCurrent = curEl ? parseMoneyInput(curEl.value) : null;
    const aprPct = aprEl ? parseMoneyInput(aprEl.value) : null;
    const deferredAmount = defEl ? parseMoneyInput(defEl.value) : null;
    const deferredExpiresOn = defDateEl ? String(defDateEl.value || '').trim() : '';
    const payment = payEl ? parseMoneyInput(payEl.value) : null;

    const prev = planDebts.find(function (d) {
      return String(d.id) === String(id);
    });
    const prevByIndex = !prev && planDebts[rowIdx] ? planDebts[rowIdx] : null;
    const prevPaidOff =
      prev && Number.isFinite(prev.paidOff)
        ? prev.paidOff
        : prevByIndex && Number.isFinite(prevByIndex.paidOff)
          ? prevByIndex.paidOff
          : 0;
    var currentBal;
    if (rawCurrent !== null) {
      currentBal = rawCurrent;
    } else if (prev && Number.isFinite(Number(prev.current))) {
      currentBal = Number(prev.current);
    } else if (prevByIndex && Number.isFinite(Number(prevByIndex.current))) {
      currentBal = Number(prevByIndex.current);
    } else {
      currentBal = 0;
    }

    var paidOffVal = prevPaidOff;
    var hist = normalizePaymentHistory(prev || prevByIndex);
    if (payment !== null && payment > 0) {
      if (currentBal > 0) {
        const applied = roundMoney(Math.min(payment, currentBal));
        currentBal = roundMoney(Math.max(0, currentBal - applied));
        paidOffVal = roundMoney(Math.max(0, prevPaidOff + applied));
        hist = hist.slice();
        hist.push({ id: newPaymentId(), amount: applied, at: new Date().toISOString() });
        if (curEl) curEl.value = formatMoneyInput(currentBal);
      }
      if (payEl) payEl.value = '';
    }

    next.push({
      id: String(id),
      name: name || 'Debt',
      current: roundMoney(currentBal),
      paidOff: roundMoney(paidOffVal),
      aprPct: roundMoney(aprPct == null ? DEFAULT_DEBT_APR_PCT : aprPct),
      deferredAmount: roundMoney(deferredAmount == null ? 0 : deferredAmount),
      deferredExpiresOn: deferredExpiresOn,
      deferredMonthsRemaining:
        prev && Number.isFinite(prev.deferredMonthsRemaining)
          ? prev.deferredMonthsRemaining
          : prevByIndex && Number.isFinite(prevByIndex.deferredMonthsRemaining)
            ? prevByIndex.deferredMonthsRemaining
            : 0,
      paymentHistory: hist,
    });
  });
  PLAN.debts = next;
}

export function cloneDebtsSnapshot() {
  return {
    debts: (Array.isArray(PLAN.debts) ? PLAN.debts : []).map(function (d) {
      return {
        id: String(d.id),
        name: String(d.name || 'Debt'),
        current: roundMoney(numOr(d.current, 0)),
        paidOff: roundMoney(numOr(d.paidOff, 0)),
        aprPct: roundMoney(numOr(d.aprPct, DEFAULT_DEBT_APR_PCT)),
        deferredAmount: roundMoney(numOr(d.deferredAmount, 0)),
        deferredExpiresOn: typeof d.deferredExpiresOn === 'string' ? d.deferredExpiresOn : '',
        deferredMonthsRemaining: Number.isFinite(d.deferredMonthsRemaining) ? Math.max(0, Math.floor(d.deferredMonthsRemaining)) : 0,
        paymentHistory: normalizePaymentHistory(d),
      };
    }),
  };
}

export function setDebtsDraftFromSnapshot(snap) {
  if (!snap) return;

  const host = document.getElementById('debts-editor-list');
  if (host) {
    host.innerHTML = '';
    if (!(snap.debts || []).length) {
      appendDebtsEditorEmptyState(host);
      return;
    }
    const table = document.createElement('table');
    table.className = 'editor-table editor-table--debts';
    table.setAttribute('role', 'grid');
    table.appendChild(buildDebtsEditorThead());
    const tbody = document.createElement('tbody');
    (snap.debts || []).forEach(function (d) {
      tbody.appendChild(buildDebtRowTR(d));
    });
    table.appendChild(tbody);
    host.appendChild(table);
  }
}

export function addDebtRowDraft(showUnsaved) {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  const empty = host.querySelector('.editor-empty-state');
  if (empty) empty.remove();
  const id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  let tbody = host.querySelector('table.editor-table--debts tbody');
  if (!tbody) {
    host.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'editor-table editor-table--debts';
    table.setAttribute('role', 'grid');
    table.appendChild(buildDebtsEditorThead());
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
    host.appendChild(table);
  }
  const row = buildDebtRowTR({
    id: id,
    name: '',
    current: 0,
    paidOff: 0,
    aprPct: DEFAULT_DEBT_APR_PCT,
    deferredAmount: 0,
    deferredExpiresOn: '',
    paymentHistory: [],
  });
  const nameEl = row.querySelector('input[data-field="name"]');
  if (nameEl) nameEl.placeholder = 'New debt';
  tbody.appendChild(row);
  showUnsaved();
}

export function removeDebtPayment(debtId, paymentId, onUnsaved, rerender) {
  const debt = (PLAN.debts || []).find(function (d) {
    return String(d.id) === String(debtId);
  });
  if (!debt || !Array.isArray(debt.paymentHistory)) return;
  const idx = debt.paymentHistory.findIndex(function (p) {
    return String(p.id) === String(paymentId);
  });
  if (idx === -1) return;
  const entry = debt.paymentHistory[idx];
  const amt = Number(entry.amount);
  if (!Number.isFinite(amt) || amt <= 0) return;
  debt.paymentHistory.splice(idx, 1);
  debt.current = roundMoney(numOr(debt.current, 0) + amt);
  debt.paidOff = roundMoney(Math.max(0, numOr(debt.paidOff, 0) - amt));
  onUnsaved();
  rerender();
}
