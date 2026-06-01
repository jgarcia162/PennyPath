/**
 * Savings editor DOM ↔ PLAN, snapshots, remove deposit/withdrawal helpers.
 */

import type { DepositHistoryItem, FinancialPlan, SavingsAccount, SavingsGoal } from '../../types/index.js';
import { PLAN, PLAN_DEFAULTS, DEFAULT_SAVINGS_APY_PCT } from './plan-data';
import { parseMoneyInput, numOr, roundMoney, formatCurrencyInput, formatMoneyInput } from './utils';
import { appendSavingsEditorEmptyState, buildSavingsEditorThead, buildSavingsRowTR } from './render-sections';
import { normalizeDepositHistory, newDepositId, newWithdrawalId } from './persistence';
import { ID_GOAL_HYSA, ensureSavingsGoals, getAccountGoalIds } from './savings-goals';
import { defaultLogAtIsoForEdits } from './default-log-at';
import { concatSavingsLedgerOrder, partitionSavingsByLedger } from './savings-ledger';
import { isSavingsDepositEntry, normalizeLedgerMemo, savingsLedgerKind } from './ledger-utils';
import { syncLegacySavingsFromAccounts } from './savings-accounts';

function parseSavingsRowFromDOM(
  row: Element,
  rowIdx: number,
  planAcc: SavingsAccount[],
  applyPendingLedger: boolean
): SavingsAccount {
  let id = row.getAttribute('data-savings-id');
  if (id == null || String(id).trim() === '') {
    id = planAcc[rowIdx] ? String(planAcc[rowIdx].id) : 's_' + rowIdx;
  } else {
    id = String(id).trim();
  }
  const nameEl = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  const curEl = row.querySelector('input[data-field="current"]') as HTMLInputElement | null;
  const apyEl = row.querySelector('input[data-field="apyPct"]') as HTMLInputElement | null;
  const depEl = row.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const withdrawEl = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const withdrawMemoEl = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement | null;
  const name = nameEl ? String(nameEl.value || 'Account').trim() : 'Account';
  const rawCurrent = curEl ? parseMoneyInput(curEl.value) : null;
  const rawApy = apyEl ? parseMoneyInput(apyEl.value) : null;
  const deposit = depEl ? parseMoneyInput(depEl.value) : null;
  const withdrawal = withdrawEl ? parseMoneyInput(withdrawEl.value) : null;

  const prev = planAcc.find(function (a: SavingsAccount) {
    return String(a.id) === String(id);
  });
  const prevByIndex = !prev && planAcc[rowIdx] ? planAcc[rowIdx] : null;
  const base = prev || prevByIndex;
  let currentBal: number;
  if (rawCurrent !== null) {
    currentBal = rawCurrent;
  } else if (base && Number.isFinite(Number(base.current))) {
    currentBal = Number(base.current);
  } else {
    currentBal = 0;
  }

  let apyPctVal: number;
  if (rawApy !== null) {
    apyPctVal = rawApy;
  } else if (base && Number.isFinite(Number(base.apyPct))) {
    apyPctVal = Number(base.apyPct);
  } else {
    apyPctVal = DEFAULT_SAVINGS_APY_PCT;
  }

  const hasNewDeposit = applyPendingLedger && deposit !== null && deposit > 0;
  const hasNewWithdrawal = applyPendingLedger && withdrawal !== null && withdrawal > 0;
  let hist: DepositHistoryItem[] = normalizeDepositHistory(base);

  function applyDeposit(): void {
    if (!hasNewDeposit) return;
    const dep = roundMoney(deposit!);
    currentBal = roundMoney(currentBal + dep);
    hist = hist.slice();
    hist.push({
      id: newDepositId(),
      amount: dep,
      at: defaultLogAtIsoForEdits(),
      kind: 'deposit',
    });
    if (curEl) curEl.value = currentBal > 0 ? formatCurrencyInput(currentBal) : '';
    if (depEl) depEl.value = '';
  }

  function applyWithdrawal(): void {
    if (!hasNewWithdrawal) return;
    const wd = roundMoney(withdrawal!);
    const applied = roundMoney(Math.min(wd, currentBal));
    currentBal = roundMoney(Math.max(0, currentBal - wd));
    hist = hist.slice();
    hist.push({
      id: newWithdrawalId(),
      amount: applied,
      at: defaultLogAtIsoForEdits(),
      kind: 'withdrawal',
      memo: withdrawMemoEl ? normalizeLedgerMemo(withdrawMemoEl.value) : '',
    });
    if (curEl) curEl.value = currentBal > 0 ? formatCurrencyInput(currentBal) : '';
    if (withdrawEl) withdrawEl.value = '';
    if (withdrawMemoEl) withdrawMemoEl.value = '';
  }

  if (hasNewWithdrawal && hasNewDeposit) {
    /* both filled — do not apply (Add/Save should be disabled) */
  } else if (hasNewWithdrawal) {
    applyWithdrawal();
  } else if (hasNewDeposit) {
    applyDeposit();
  }

  const goalIds: string[] = [];
  row.querySelectorAll('input[data-field="goalId"]:checked').forEach(function (cb: Element) {
    const gid = cb.getAttribute('data-goal-id');
    if (gid) goalIds.push(String(gid));
  });
  const countTowardsGoal = goalIds.indexOf(ID_GOAL_HYSA) >= 0;

  return {
    id: String(id),
    name: name || 'Account',
    current: roundMoney(currentBal),
    apyPct: roundMoney(apyPctVal),
    goalIds: goalIds,
    countTowardsGoal: countTowardsGoal,
    depositHistory: hist,
  };
}

export type ReadSavingsEditorOptions = {
  applyPendingLedger?: boolean;
};

export type MergeSavingsFromCardOptions = {
  applyPendingLedger?: boolean;
};

/** Merge inline Goal 3 card fields (+ optional Activity) into PLAN. */
export function mergeSavingsFromCardElement(card: Element, opts?: MergeSavingsFromCardOptions): boolean {
  const savingsId = card.getAttribute('data-savings-id');
  if (savingsId == null || String(savingsId).trim() === '') return false;
  const applyPendingLedger = opts?.applyPendingLedger === true;
  const planAcc: SavingsAccount[] = Array.isArray((PLAN as any).savingsAccounts)
    ? ((PLAN as any).savingsAccounts as SavingsAccount[])
    : [];
  const rowIdx = planAcc.findIndex(function (a: SavingsAccount) {
    return String(a.id) === String(savingsId);
  });
  if (rowIdx < 0) return false;
  const parsed = parseSavingsRowFromDOM(card, rowIdx, planAcc, applyPendingLedger);
  const next = planAcc.slice();
  next[rowIdx] = parsed;
  (PLAN as any).savingsAccounts = next;
  syncLegacySavingsFromAccounts(PLAN);
  return true;
}

export function readSavingsEditorIntoPlan(opts?: ReadSavingsEditorOptions): void {
  const applyPendingLedger = opts?.applyPendingLedger === true;
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  const planAcc: SavingsAccount[] = Array.isArray((PLAN as any).savingsAccounts)
    ? ((PLAN as any).savingsAccounts as SavingsAccount[])
    : [];
  const parts = partitionSavingsByLedger(planAcc);
  const rows = host.querySelectorAll('.savings-row');
  const parsed: SavingsAccount[] = [];
  rows.forEach(function (row: Element, rowIdx: number) {
    parsed.push(parseSavingsRowFromDOM(row, rowIdx, planAcc, applyPendingLedger));
  });
  PLAN.savingsAccounts = concatSavingsLedgerOrder({
    active: parsed,
    deleted: parts.deleted,
  });
}

export function hardRemoveSavingsById(id: string): void {
  const accs: SavingsAccount[] = Array.isArray((PLAN as any).savingsAccounts)
    ? ((PLAN as any).savingsAccounts as SavingsAccount[])
    : [];
  (PLAN as any).savingsAccounts = accs.filter(function (a: SavingsAccount) {
    return String(a.id) !== String(id);
  });
}

export function setSavingsLedgerStatusById(id: string, status: 'active' | 'deleted'): void {
  const accs: SavingsAccount[] = Array.isArray((PLAN as any).savingsAccounts)
    ? ([...((PLAN as any).savingsAccounts as SavingsAccount[])] as SavingsAccount[])
    : [];
  const idx = accs.findIndex(function (a: SavingsAccount) {
    return String(a.id) === String(id);
  });
  if (idx === -1) return;
  const a = accs[idx];
  if (status === 'active') {
    const { ledgerStatus: _x, ...rest } = { ...a, ledgerStatus: undefined };
    accs[idx] = rest as SavingsAccount;
  } else {
    accs[idx] = { ...a, ledgerStatus: 'deleted' };
  }
  PLAN.savingsAccounts = concatSavingsLedgerOrder(partitionSavingsByLedger(accs));
}

export function cloneSavingsSnapshot(): { savingsAccounts: SavingsAccount[] } {
  return {
    savingsAccounts: (Array.isArray((PLAN as any).savingsAccounts) ? ((PLAN as any).savingsAccounts as SavingsAccount[]) : []).map(function (
      a: SavingsAccount
    ) {
      const row: SavingsAccount = {
        id: String(a.id),
        name: String(a.name || 'Account'),
        current: roundMoney(numOr(a.current, 0)),
        apyPct: roundMoney(numOr(a.apyPct, DEFAULT_SAVINGS_APY_PCT)),
        goalIds: getAccountGoalIds(a),
        countTowardsGoal: getAccountGoalIds(a).indexOf(ID_GOAL_HYSA) >= 0,
        depositHistory: normalizeDepositHistory(a),
      };
      if (a.ledgerStatus === 'deleted') {
        row.ledgerStatus = 'deleted';
      }
      return row;
    }),
  };
}

export function setSavingsDraftFromSnapshot(snap: { savingsAccounts: SavingsAccount[] } | null | undefined): void {
  if (!snap || !Array.isArray(snap.savingsAccounts)) return;
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  host.innerHTML = '';
  const active = partitionSavingsByLedger(snap.savingsAccounts || []).active;
  if (!active.length) {
    appendSavingsEditorEmptyState(host);
    return;
  }
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--savings';
  table.setAttribute('role', 'grid');
  table.appendChild(buildSavingsEditorThead());
  const tbody = document.createElement('tbody');
  ensureSavingsGoals(PLAN);
  const sg: SavingsGoal[] = (PLAN as any).savingsGoals || [];
  active.forEach(function (a: SavingsAccount) {
    tbody.appendChild(buildSavingsRowTR(a, sg));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

export function addSavingsRowDraft(showUnsaved: () => void): void {
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
    ((PLAN as any).savingsGoals || []) as SavingsGoal[]
  );
  const nameEl = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  if (nameEl) nameEl.placeholder = 'New account';
  tbody.appendChild(row);
  showUnsaved();
}

export function removeSavingsLedgerEntry(
  accountId: string,
  entryId: string,
  onUnsaved: () => void,
  rerender: () => void
): void {
  const acc = (((PLAN as any).savingsAccounts || []) as SavingsAccount[]).find(function (a: SavingsAccount) {
    return String(a.id) === String(accountId);
  });
  if (!acc || !Array.isArray(acc.depositHistory)) return;
  const idx = acc.depositHistory.findIndex(function (p: DepositHistoryItem) {
    return String(p.id) === String(entryId);
  });
  if (idx === -1) return;
  const entry = acc.depositHistory[idx];
  const amt = Number(entry.amount);
  if (!Number.isFinite(amt) || amt <= 0) return;
  const kind = savingsLedgerKind(entry.kind);
  acc.depositHistory.splice(idx, 1);
  if (kind === 'withdrawal') {
    acc.current = roundMoney(numOr(acc.current, 0) + amt);
  } else {
    acc.current = roundMoney(Math.max(0, numOr(acc.current, 0) - amt));
  }
  onUnsaved();
  rerender();
}

/** @deprecated Use removeSavingsLedgerEntry */
export function removeSavingsDeposit(
  accountId: string,
  depositId: string,
  onUnsaved: () => void,
  rerender: () => void
): void {
  removeSavingsLedgerEntry(accountId, depositId, onUnsaved, rerender);
}
