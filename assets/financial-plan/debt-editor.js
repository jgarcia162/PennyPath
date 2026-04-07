/**
 * Debts editor DOM ↔ PLAN, snapshots, apply/remove payment helpers.
 */

import { PLAN, PLAN_DEFAULTS, DEFAULT_DEBT_APR_PCT } from './plan-data.js';
import { parseMoneyInput, numOr } from './utils.js';
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
        const applied = Math.min(payment, currentBal);
        currentBal = Math.max(0, currentBal - applied);
        paidOffVal = Math.max(0, prevPaidOff + applied);
        hist = hist.slice();
        hist.push({ id: newPaymentId(), amount: applied, at: new Date().toISOString() });
        if (curEl) curEl.value = String(currentBal);
      }
      if (payEl) payEl.value = '';
    }

    next.push({
      id: String(id),
      name: name || 'Debt',
      current: currentBal,
      paidOff: paidOffVal,
      aprPct: aprPct == null ? DEFAULT_DEBT_APR_PCT : aprPct,
      deferredAmount: deferredAmount == null ? 0 : deferredAmount,
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
        current: numOr(d.current, 0),
        paidOff: numOr(d.paidOff, 0),
        aprPct: numOr(d.aprPct, DEFAULT_DEBT_APR_PCT),
        deferredAmount: numOr(d.deferredAmount, 0),
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
    (snap.debts || []).forEach(function (d) {
      const row = document.createElement('div');
      row.className = 'debt-row';
      row.setAttribute('data-debt-id', String(d.id));
      row.innerHTML =
        '<div class="balance-field"><label>Debt name</label><input type="text" data-field="name" autocomplete="off" value=""></div>' +
        '<div class="balance-field"><label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" value=""></div>' +
        '<div class="balance-field"><label>APR %</label><input type="text" data-field="aprPct" inputmode="decimal" autocomplete="off" placeholder="0" value=""></div>' +
        '<div class="balance-field"><label>Deferred $ (0% promo)</label><input type="text" data-field="deferredAmount" inputmode="decimal" autocomplete="off" value=""></div>' +
        '<div class="balance-field"><label>Deferred expires</label><input type="date" data-field="deferredExpiresOn" autocomplete="off" value=""></div>' +
        '<div class="balance-field"><label>Payment</label><input type="text" data-field="payment" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>' +
        '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
        '<button type="button" class="btn-remove-debt" data-action="remove">Remove</button>' +
        '</div>';

      const nameEl = row.querySelector('input[data-field="name"]');
      const curEl = row.querySelector('input[data-field="current"]');
      const aprEl = row.querySelector('input[data-field="aprPct"]');
      const defEl = row.querySelector('input[data-field="deferredAmount"]');
      const defDateEl = row.querySelector('input[data-field="deferredExpiresOn"]');
      if (nameEl) nameEl.value = String(d.name || '');
      if (curEl) curEl.value = String(numOr(d.current, 0));
      if (aprEl) aprEl.value = String(numOr(d.aprPct, DEFAULT_DEBT_APR_PCT));
      if (defEl) defEl.value = String(numOr(d.deferredAmount, 0));
      if (defDateEl) defDateEl.value = typeof d.deferredExpiresOn === 'string' ? d.deferredExpiresOn : '';

      host.appendChild(row);
    });
  }
}

export function addDebtRowDraft(showUnsaved) {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  const id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const row = document.createElement('div');
  row.className = 'debt-row';
  row.setAttribute('data-debt-id', id);
  row.innerHTML =
    '<div class="balance-field"><label>Debt name</label><input type="text" data-field="name" autocomplete="off" placeholder="New debt"></div>' +
    '<div class="balance-field"><label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" placeholder="0"></div>' +
    '<div class="balance-field"><label>APR %</label><input type="text" data-field="aprPct" inputmode="decimal" autocomplete="off" placeholder="0"></div>' +
    '<div class="balance-field"><label>Deferred $ (0% promo)</label><input type="text" data-field="deferredAmount" inputmode="decimal" autocomplete="off" placeholder="0"></div>' +
    '<div class="balance-field"><label>Deferred expires</label><input type="date" data-field="deferredExpiresOn" autocomplete="off"></div>' +
    '<div class="balance-field"><label>Payment</label><input type="text" data-field="payment" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>' +
    '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
    '<button type="button" class="btn-remove-debt" data-action="remove">Remove</button>' +
    '</div>';
  host.appendChild(row);
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
  debt.current = numOr(debt.current, 0) + amt;
  debt.paidOff = Math.max(0, numOr(debt.paidOff, 0) - amt);
  onUnsaved();
  rerender();
}
