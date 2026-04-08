/**
 * Savings editor DOM ↔ PLAN, snapshots, remove deposit helpers.
 */

import { PLAN, PLAN_DEFAULTS, DEFAULT_SAVINGS_APY_PCT } from './plan-data.js';
import { parseMoneyInput, numOr, roundMoney, formatMoneyInput } from './utils.js';
import { appendSavingsEditorEmptyState } from './render-sections.js';
import { normalizeDepositHistory, newDepositId } from './persistence.js';

export function readSavingsEditorIntoPlan() {
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  const rows = host.querySelectorAll('.savings-row');
  const next = [];
  const planAcc = Array.isArray(PLAN.savingsAccounts) ? PLAN.savingsAccounts : [];
  rows.forEach(function (row, rowIdx) {
    let id = row.getAttribute('data-savings-id');
    if (id == null || String(id).trim() === '') {
      id = planAcc[rowIdx] ? String(planAcc[rowIdx].id) : 's_' + rowIdx;
    } else {
      id = String(id).trim();
    }
    const nameEl = row.querySelector('input[data-field="name"]');
    const curEl = row.querySelector('input[data-field="current"]');
    const apyEl = row.querySelector('input[data-field="apyPct"]');
    const depEl = row.querySelector('input[data-field="deposit"]');
    const name = nameEl ? String(nameEl.value || 'Account').trim() : 'Account';
    const rawCurrent = curEl ? parseMoneyInput(curEl.value) : null;
    const rawApy = apyEl ? parseMoneyInput(apyEl.value) : null;
    const deposit = depEl ? parseMoneyInput(depEl.value) : null;

    const prev = planAcc.find(function (a) {
      return String(a.id) === String(id);
    });
    const prevByIndex = !prev && planAcc[rowIdx] ? planAcc[rowIdx] : null;
    const base = prev || prevByIndex;
    var currentBal;
    if (rawCurrent !== null) {
      currentBal = rawCurrent;
    } else if (base && Number.isFinite(Number(base.current))) {
      currentBal = Number(base.current);
    } else {
      currentBal = 0;
    }

    var apyPctVal;
    if (rawApy !== null) {
      apyPctVal = rawApy;
    } else if (base && Number.isFinite(Number(base.apyPct))) {
      apyPctVal = Number(base.apyPct);
    } else {
      apyPctVal = DEFAULT_SAVINGS_APY_PCT;
    }

    var hist = normalizeDepositHistory(base);
    if (deposit !== null && deposit > 0) {
      const dep = roundMoney(deposit);
      currentBal = roundMoney(currentBal + dep);
      hist = hist.slice();
      hist.push({ id: newDepositId(), amount: dep, at: new Date().toISOString() });
      if (curEl) curEl.value = formatMoneyInput(currentBal);
      if (depEl) depEl.value = '';
    }

    next.push({
      id: String(id),
      name: name || 'Account',
      current: roundMoney(currentBal),
      apyPct: roundMoney(apyPctVal),
      depositHistory: hist,
    });
  });
  PLAN.savingsAccounts = next;
}

export function cloneSavingsSnapshot() {
  return {
    savingsAccounts: (Array.isArray(PLAN.savingsAccounts) ? PLAN.savingsAccounts : []).map(function (a) {
      return {
        id: String(a.id),
        name: String(a.name || 'Account'),
        current: roundMoney(numOr(a.current, 0)),
        apyPct: roundMoney(numOr(a.apyPct, DEFAULT_SAVINGS_APY_PCT)),
        depositHistory: normalizeDepositHistory(a),
      };
    }),
  };
}

export function setSavingsDraftFromSnapshot(snap) {
  if (!snap || !Array.isArray(snap.savingsAccounts)) return;
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  host.innerHTML = '';
  snap.savingsAccounts.forEach(function (a) {
    const row = document.createElement('div');
    row.className = 'savings-row';
    row.setAttribute('data-savings-id', String(a.id));
    row.innerHTML =
      '<div class="balance-field"><label>Account name</label><input type="text" data-field="name" autocomplete="off" value=""></div>' +
      '<div class="balance-field"><label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" value=""></div>' +
      '<div class="balance-field"><label>APY %</label><input type="text" data-field="apyPct" inputmode="decimal" autocomplete="off" placeholder="0" value=""></div>' +
      '<div class="balance-field"><label>Deposit to log</label><input type="text" data-field="deposit" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>' +
      '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
      '<button type="button" class="btn-remove-savings" data-action="remove">Remove</button>' +
      '</div>';
    const nameEl = row.querySelector('input[data-field="name"]');
    const curEl = row.querySelector('input[data-field="current"]');
    const apyEl = row.querySelector('input[data-field="apyPct"]');
    if (nameEl) nameEl.value = String(a.name || '');
    if (curEl) curEl.value = formatMoneyInput(numOr(a.current, 0));
    if (apyEl) apyEl.value = formatMoneyInput(numOr(a.apyPct, DEFAULT_SAVINGS_APY_PCT));
    host.appendChild(row);
  });
  if (snap.savingsAccounts.length === 0) {
    appendSavingsEditorEmptyState(host);
  }
}

export function addSavingsRowDraft(showUnsaved) {
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  const empty = host.querySelector('.editor-empty-state');
  if (empty) empty.remove();
  const id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const row = document.createElement('div');
  row.className = 'savings-row';
  row.setAttribute('data-savings-id', id);
  row.innerHTML =
    '<div class="balance-field"><label>Account name</label><input type="text" data-field="name" autocomplete="off" placeholder="New account"></div>' +
    '<div class="balance-field"><label>Current balance</label><input type="text" data-field="current" inputmode="decimal" autocomplete="off" placeholder="0"></div>' +
    '<div class="balance-field"><label>APY %</label><input type="text" data-field="apyPct" inputmode="decimal" autocomplete="off" placeholder="0" value=""></div>' +
    '<div class="balance-field"><label>Deposit to log</label><input type="text" data-field="deposit" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>' +
    '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
    '<button type="button" class="btn-remove-savings" data-action="remove">Remove</button>' +
    '</div>';
  host.appendChild(row);
  showUnsaved();
}

export function removeSavingsDeposit(accountId, depositId, onUnsaved, rerender) {
  const acc = (PLAN.savingsAccounts || []).find(function (a) {
    return String(a.id) === String(accountId);
  });
  if (!acc || !Array.isArray(acc.depositHistory)) return;
  const idx = acc.depositHistory.findIndex(function (p) {
    return String(p.id) === String(depositId);
  });
  if (idx === -1) return;
  const entry = acc.depositHistory[idx];
  const amt = Number(entry.amount);
  if (!Number.isFinite(amt) || amt <= 0) return;
  acc.depositHistory.splice(idx, 1);
  acc.current = roundMoney(Math.max(0, numOr(acc.current, 0) - amt));
  onUnsaved();
  rerender();
}
