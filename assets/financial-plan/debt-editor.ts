/**
 * Debts editor DOM ↔ PLAN, snapshots, apply/remove payment helpers.
 */

import type { Debt, DebtLedgerStatus, PaymentHistoryItem } from '../../types/index.js';
import { PLAN, PLAN_DEFAULTS, DEFAULT_DEBT_APR_PCT } from './plan-data';
import { parseMoneyInput, numOr, roundMoney, formatCurrencyInput, formatMoneyInput } from './utils';
import { appendDebtsEditorEmptyState, buildDebtsEditorThead, buildDebtRowTR } from './render-sections';
import { normalizePaymentHistory, newChargeId, newPaymentId } from './persistence';
import { defaultLogAtIsoForEdits } from './default-log-at';
import {
  debtLedgerKind,
  isDebtChargeEntry,
  isDebtPaymentEntry,
  normalizeLedgerMemo,
} from './ledger-utils';
import {
  concatDebtsLedgerOrder,
  normalizeDebtsEditorSegment,
  normalizeLedgerStatus,
  partitionDebtsByLedger,
  type DebtsEditorSegment,
} from './debt-ledger';

function stripOptionalLedger(d: Debt): Debt {
  if (!d.ledgerStatus || d.ledgerStatus === 'active') {
    const { ledgerStatus: _x, ...rest } = d;
    return rest as Debt;
  }
  return d;
}

/** Balance before recorded payments (current + sum of payment history). */
function balanceBeforePayments(debt: Debt | null | undefined): number | null {
  if (!debt) return null;
  const hist = normalizePaymentHistory(debt);
  if (!hist.length) return null;
  const prevCur = numOr(debt.current, 0);
  let paidFromHist = 0;
  let chargedFromHist = 0;
  hist.forEach(function (p) {
    const amt = numOr(p.amount, 0);
    if (isDebtPaymentEntry(p)) paidFromHist += amt;
    else if (isDebtChargeEntry(p)) chargedFromHist += amt;
  });
  return roundMoney(prevCur + paidFromHist - chargedFromHist);
}

/** True when the balance input is below PLAN after charges were logged. */
function domCurrentLooksStaleAfterCharges(rawCurrent: number | null, prev: Debt | null | undefined): boolean {
  if (rawCurrent === null || !prev) return false;
  const hist = normalizePaymentHistory(prev);
  if (!hist.some(isDebtChargeEntry)) return false;
  const prevCur = numOr(prev.current, 0);
  return rawCurrent < prevCur - 0.01;
}

/** True when the balance input still shows the pre-payment amount while PLAN already has payments. */
function domCurrentLooksLikeStalePrePayment(rawCurrent: number | null, prev: Debt | null | undefined): boolean {
  if (rawCurrent === null || !prev) return false;
  const before = balanceBeforePayments(prev);
  if (before === null) return false;
  return Math.abs(rawCurrent - before) < 0.01;
}

function parseDebtRowFromDOM(
  row: Element,
  rowIdx: number,
  segmentDebts: Debt[],
  allDebts: Debt[],
  applyPendingLedger: boolean
): Debt {
  let id = row.getAttribute('data-debt-id');
  if (id == null || String(id).trim() === '') {
    id = segmentDebts[rowIdx] ? String(segmentDebts[rowIdx].id) : 'd_' + rowIdx;
  } else {
    id = String(id).trim();
  }
  const nameEl = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  const curEl = row.querySelector('input[data-field="current"]') as HTMLInputElement | null;
  const aprEl = row.querySelector('input[data-field="aprPct"]') as HTMLInputElement | null;
  const defEl = row.querySelector('input[data-field="deferredAmount"]') as HTMLInputElement | null;
  const defDateEl = row.querySelector('input[data-field="deferredExpiresOn"]') as HTMLInputElement | null;
  const payEl = row.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const chargeEl = row.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const chargeMemoEl = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement | null;
  const name = nameEl ? String(nameEl.value || 'Debt').trim() : 'Debt';
  const rawCurrent = curEl ? parseMoneyInput(curEl.value) : null;
  const aprPct = aprEl ? parseMoneyInput(aprEl.value) : null;
  const deferredAmount = defEl ? parseMoneyInput(defEl.value) : null;
  const deferredExpiresOn = defDateEl ? String(defDateEl.value || '').trim() : '';
  const payment = payEl ? parseMoneyInput(payEl.value) : null;
  const charge = chargeEl ? parseMoneyInput(chargeEl.value) : null;

  const prev = allDebts.find(function (d: Debt) {
    return String(d.id) === String(id);
  });
  // Only fall back by index within the current visible ledger segment.
  // The full plan array includes completed/deleted rows, so using it here can cause a brand-new draft row
  // to "inherit" paidOff/paymentHistory from a hidden row and get promoted to completed immediately.
  const prevByIndex = !prev && segmentDebts[rowIdx] ? segmentDebts[rowIdx] : null;
  const prevSource = prev || prevByIndex;
  const prevPaidOff =
    prev && Number.isFinite(prev.paidOff)
      ? prev.paidOff
      : prevByIndex && Number.isFinite(prevByIndex.paidOff)
        ? prevByIndex.paidOff
        : 0;
  const hasNewPayment = applyPendingLedger && payment !== null && payment > 0;
  const hasNewCharge = applyPendingLedger && charge !== null && charge > 0;
  let currentBal: number;
  if (rawCurrent !== null) {
    if (
      !hasNewPayment &&
      !hasNewCharge &&
      domCurrentLooksLikeStalePrePayment(rawCurrent, prevSource)
    ) {
      currentBal = numOr(prevSource && prevSource.current, rawCurrent);
    } else if (
      !hasNewPayment &&
      !hasNewCharge &&
      domCurrentLooksStaleAfterCharges(rawCurrent, prevSource)
    ) {
      currentBal = numOr(prevSource && prevSource.current, rawCurrent);
    } else {
      currentBal = rawCurrent;
    }
  } else if (prev && Number.isFinite(Number(prev.current))) {
    currentBal = Number(prev.current);
  } else if (prevByIndex && Number.isFinite(Number(prevByIndex.current))) {
    currentBal = Number(prevByIndex.current);
  } else {
    currentBal = 0;
  }

  let paidOffVal = prevPaidOff;
  let hist: PaymentHistoryItem[] = normalizePaymentHistory(prevSource);
  if (hasNewPayment) {
    if (currentBal > 0) {
      const applied = roundMoney(Math.min(payment!, currentBal));
      currentBal = roundMoney(Math.max(0, currentBal - applied));
      paidOffVal = roundMoney(Math.max(0, prevPaidOff + applied));
      hist = hist.slice();
      hist.push({
        id: newPaymentId(),
        amount: applied,
        at: defaultLogAtIsoForEdits(),
        kind: 'payment',
      });
      if (curEl) curEl.value = currentBal > 0 ? formatCurrencyInput(currentBal) : '';
    }
    if (payEl) payEl.value = '';
  }
  if (hasNewCharge) {
    const applied = roundMoney(charge!);
    currentBal = roundMoney(currentBal + applied);
    hist = hist.slice();
    hist.push({
      id: newChargeId(),
      amount: applied,
      at: defaultLogAtIsoForEdits(),
      kind: 'charge',
      memo: chargeMemoEl ? normalizeLedgerMemo(chargeMemoEl.value) : '',
    });
    if (curEl) curEl.value = currentBal > 0 ? formatCurrencyInput(currentBal) : '';
    if (chargeEl) chargeEl.value = '';
    if (chargeMemoEl) chargeMemoEl.value = '';
  }

  return {
    id: String(id),
    name: name || 'Debt',
    current: roundMoney(currentBal),
    paidOff: roundMoney(paidOffVal),
    aprPct: roundMoney(aprPct == null ? DEFAULT_DEBT_APR_PCT : aprPct),
    deferredAmount: roundMoney(deferredAmount == null ? 0 : deferredAmount),
    deferredExpiresOn: deferredExpiresOn as any,
    deferredMonthsRemaining:
      prev && Number.isFinite(prev.deferredMonthsRemaining)
        ? prev.deferredMonthsRemaining
        : prevByIndex && Number.isFinite(prevByIndex.deferredMonthsRemaining)
          ? prevByIndex.deferredMonthsRemaining
          : 0,
    paymentHistory: hist,
  };
}

export type ReadDebtsEditorOptions = {
  applyPendingLedger?: boolean;
};

export function readDebtsEditorIntoPlan(opts?: ReadDebtsEditorOptions): void {
  const applyPendingLedger = opts?.applyPendingLedger === true;
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  const segment = normalizeDebtsEditorSegment(host.dataset.debtsSegment || 'active');
  (PLAN as any).debtsEditorLedgerSegment = segment;

  const allDebts: Debt[] = Array.isArray((PLAN as any).debts) ? ((PLAN as any).debts as Debt[]) : [];
  const parts = partitionDebtsByLedger(allDebts);
  const segmentDebts: Debt[] = segment === 'completed' ? parts.completed : parts.active;
  const rows = host.querySelectorAll('.debt-row');
  const parsed: Debt[] = [];
  rows.forEach(function (row: Element, rowIdx: number) {
    parsed.push(parseDebtRowFromDOM(row, rowIdx, segmentDebts, allDebts, applyPendingLedger));
  });

  if (segment === 'active') {
    const nextActive: Debt[] = [];
    const promoted: Debt[] = [];
    let lifetimeBump = 0;
    parsed.forEach(function (d: Debt) {
      const prev = allDebts.find(function (x: Debt) {
        return String(x.id) === String(d.id);
      });
      const prevSt = normalizeLedgerStatus(prev && prev.ledgerStatus);
      const cur = numOr(d.current, 0);
      const paid = numOr(d.paidOff, 0);
      if (cur <= 0 && paid > 0) {
        promoted.push({ ...d, ledgerStatus: 'completed' });
        if (prevSt === 'active') lifetimeBump += 1;
      } else {
        nextActive.push(stripOptionalLedger(d));
      }
    });
    const prevLife = numOr((PLAN as any).debtsPaidOffLifetimeCount, 0);
    (PLAN as any).debtsPaidOffLifetimeCount = prevLife + lifetimeBump;
    const mergedCompleted = dedupeDebtIdsLastWins([...parts.completed, ...promoted]);
    PLAN.debts = concatDebtsLedgerOrder({
      active: nextActive,
      completed: mergedCompleted,
      deleted: parts.deleted,
    });
    return;
  }

  if (segment === 'completed') {
    const nextCompleted = parsed.map(function (d: Debt) {
      return { ...d, ledgerStatus: 'completed' as const };
    });
    PLAN.debts = concatDebtsLedgerOrder({
      active: parts.active,
      completed: dedupeDebtIdsLastWins(nextCompleted),
      deleted: parts.deleted,
    });
    return;
  }
}

function dedupeDebtIdsLastWins(list: Debt[]): Debt[] {
  const byId = new Map<string, Debt>();
  list.forEach(function (d: Debt) {
    byId.set(String(d.id), d);
  });
  return Array.from(byId.values());
}

export function hardRemoveDebtById(id: string): void {
  const debts: Debt[] = Array.isArray((PLAN as any).debts) ? ((PLAN as any).debts as Debt[]) : [];
  (PLAN as any).debts = debts.filter(function (d: Debt) {
    return String(d.id) !== String(id);
  });
}

export function setDebtLedgerStatusById(id: string, status: DebtLedgerStatus): void {
  const debts: Debt[] = Array.isArray((PLAN as any).debts) ? ([...((PLAN as any).debts as Debt[])] as Debt[]) : [];
  const idx = debts.findIndex(function (d: Debt) {
    return String(d.id) === String(id);
  });
  if (idx === -1) return;
  const d = debts[idx];
  const prev = normalizeLedgerStatus(d.ledgerStatus);
  let nextD: Debt;
  if (status === 'active') {
    nextD = stripOptionalLedger({ ...d, ledgerStatus: 'active' });
  } else {
    nextD = { ...d, ledgerStatus: status };
  }
  debts[idx] = nextD;
  if (status === 'completed' && prev === 'active') {
    const prevLife = numOr((PLAN as any).debtsPaidOffLifetimeCount, 0);
    (PLAN as any).debtsPaidOffLifetimeCount = prevLife + 1;
  }
  PLAN.debts = concatDebtsLedgerOrder(partitionDebtsByLedger(debts));
}

export function cloneDebtsSnapshot(): { debts: Debt[] } {
  return {
    debts: (Array.isArray((PLAN as any).debts) ? ((PLAN as any).debts as Debt[]) : []).map(function (d: Debt) {
      const row: Debt = {
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
      if (d.ledgerStatus === 'completed' || d.ledgerStatus === 'deleted') {
        row.ledgerStatus = d.ledgerStatus;
      }
      return row;
    }),
  };
}

export function setDebtsDraftFromSnapshot(snap: { debts: Debt[] } | null | undefined): void {
  if (!snap) return;

  const host = document.getElementById('debts-editor-list');
  if (host) {
    host.innerHTML = '';
    const segment: DebtsEditorSegment = normalizeDebtsEditorSegment(
      (PLAN as any).debtsEditorLedgerSegment || host.dataset.debtsSegment || 'active'
    );
    host.dataset.debtsSegment = segment;
    const partsSnap = partitionDebtsByLedger(snap.debts || []);
    const show = segment === 'completed' ? partsSnap.completed : partsSnap.active;
    if (!show.length) {
      appendDebtsEditorEmptyState(host, segment);
      return;
    }
    const table = document.createElement('table');
    table.className = 'editor-table editor-table--debts';
    table.setAttribute('role', 'grid');
    table.appendChild(buildDebtsEditorThead());
    const tbody = document.createElement('tbody');
    show.forEach(function (d: Debt) {
      tbody.appendChild(buildDebtRowTR(d, segment));
    });
    table.appendChild(tbody);
    host.appendChild(table);
  }
}

export function addDebtRowDraft(showUnsaved: () => void): void {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  // New rows are active-ledger drafts; on the "Paid off" segment readDebtsEditorIntoPlan forces
  // ledgerStatus 'completed' for every row — never add while that tab is selected (+ Add is disabled, this is a guard).
  if (normalizeDebtsEditorSegment(host.dataset.debtsSegment || 'active') === 'completed') {
    return;
  }
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
  const row = buildDebtRowTR(
    {
      id: id,
      name: '',
      current: 0,
      paidOff: 0,
      aprPct: DEFAULT_DEBT_APR_PCT,
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: [],
    },
    'active'
  );
  const nameEl = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  if (nameEl) nameEl.placeholder = 'New debt';
  tbody.appendChild(row);
  showUnsaved();
}

export function removeDebtLedgerEntry(
  debtId: string,
  entryId: string,
  onUnsaved: () => void,
  rerender: () => void
): void {
  const debt = (((PLAN as any).debts || []) as Debt[]).find(function (d: Debt) {
    return String(d.id) === String(debtId);
  });
  if (!debt || !Array.isArray(debt.paymentHistory)) return;
  const idx = debt.paymentHistory.findIndex(function (p: PaymentHistoryItem) {
    return String(p.id) === String(entryId);
  });
  if (idx === -1) return;
  const entry = debt.paymentHistory[idx];
  const amt = Number(entry.amount);
  if (!Number.isFinite(amt) || amt <= 0) return;
  const kind = debtLedgerKind(entry.kind);
  debt.paymentHistory.splice(idx, 1);
  if (kind === 'charge') {
    debt.current = roundMoney(Math.max(0, numOr(debt.current, 0) - amt));
  } else {
    debt.current = roundMoney(numOr(debt.current, 0) + amt);
    debt.paidOff = roundMoney(Math.max(0, numOr(debt.paidOff, 0) - amt));
  }
  onUnsaved();
  rerender();
}

/** @deprecated Use removeDebtLedgerEntry */
export function removeDebtPayment(
  debtId: string,
  paymentId: string,
  onUnsaved: () => void,
  rerender: () => void
): void {
  removeDebtLedgerEntry(debtId, paymentId, onUnsaved, rerender);
}
