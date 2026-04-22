/**
 * Savings editor DOM ↔ PLAN, snapshots, remove deposit helpers.
 */

import { PLAN, PLAN_DEFAULTS, DEFAULT_SAVINGS_APY_PCT } from './plan-data';
import { parseMoneyInput, numOr, roundMoney, formatMoneyInput } from './utils';
import { appendSavingsEditorEmptyState, buildSavingsEditorThead, buildSavingsRowTR } from './render-sections.js';
import { normalizeDepositHistory, newDepositId } from './persistence';
import { ID_GOAL_HYSA, ensureSavingsGoals, getAccountGoalIds } from './savings-goals.js';
import { defaultLogAtIsoForEdits } from './default-log-at';

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
      hist.push({ id: newDepositId(), amount: dep, at: defaultLogAtIsoForEdits() });
      if (curEl) curEl.value = formatMoneyInput(currentBal);
      if (depEl) depEl.value = '';
    }

    const goalIds = [];
    row.querySelectorAll('input[data-field="goalId"]:checked').forEach(function (cb) {
      const gid = cb.getAttribute('data-goal-id');
      if (gid) goalIds.push(String(gid));
    });
    const countTowardsGoal = goalIds.indexOf(ID_GOAL_HYSA) >= 0;

    next.push({
      id: String(id),
      name: name || 'Account',
      current: roundMoney(currentBal),
      apyPct: roundMoney(apyPctVal),
      goalIds: goalIds,
      countTowardsGoal: countTowardsGoal,
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
        goalIds: getAccountGoalIds(a),
        countTowardsGoal: getAccountGoalIds(a).indexOf(ID_GOAL_HYSA) >= 0,
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
  if (!snap.savingsAccounts.length) {
    appendSavingsEditorEmptyState(host);
    return;
  }
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--savings';
  table.setAttribute('role', 'grid');
  table.appendChild(buildSavingsEditorThead());
  const tbody = document.createElement('tbody');
  ensureSavingsGoals(PLAN);
  const sg = PLAN.savingsGoals || [];
  snap.savingsAccounts.forEach(function (a) {
    tbody.appendChild(buildSavingsRowTR(a, sg));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

export function addSavingsRowDraft(showUnsaved) {
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  const empty = host.querySelector('.editor-empty-state');
  if (empty) empty.remove();
  const id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  let tbody = host.querySelector('table.editor-table--savings tbody');
  if (!tbody) {
    host.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'editor-table editor-table--savings';
    table.setAttribute('role', 'grid');
    table.appendChild(buildSavingsEditorThead());
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
    host.appendChild(table);
  }
  ensureSavingsGoals(PLAN);
  const row = buildSavingsRowTR(
    {
      id: id,
      name: '',
      current: 0,
      apyPct: DEFAULT_SAVINGS_APY_PCT,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
    PLAN.savingsGoals || []
  );
  const nameEl = row.querySelector('input[data-field="name"]');
  if (nameEl) nameEl.placeholder = 'New account';
  tbody.appendChild(row);
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
