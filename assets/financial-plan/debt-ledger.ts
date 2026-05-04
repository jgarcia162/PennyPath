/**
 * Debt ledger: active vs paid-off vs soft-deleted rows.
 */

import type { Debt, DebtLedgerStatus, FinancialPlan } from '../../types/index.js';

export type DebtLedgerSegment = DebtLedgerStatus;

const VALID: Record<string, DebtLedgerStatus> = {
  active: 'active',
  completed: 'completed',
  deleted: 'deleted',
};

export function normalizeLedgerStatus(raw: unknown): DebtLedgerStatus {
  if (typeof raw === 'string' && VALID[raw]) return VALID[raw];
  return 'active';
}

export function normalizeDebtsEditorSegment(raw: unknown): DebtLedgerSegment {
  return normalizeLedgerStatus(raw) === 'deleted'
    ? 'deleted'
    : normalizeLedgerStatus(raw) === 'completed'
      ? 'completed'
      : 'active';
}

export function isDebtLedgerActive(d: Debt | null | undefined): boolean {
  const s = d && d.ledgerStatus;
  return !s || s === 'active';
}

export function isDebtLedgerCompleted(d: Debt | null | undefined): boolean {
  return d?.ledgerStatus === 'completed';
}

export function isDebtLedgerDeleted(d: Debt | null | undefined): boolean {
  return d?.ledgerStatus === 'deleted';
}

export function partitionDebtsByLedger(debts: Debt[]): {
  active: Debt[];
  completed: Debt[];
  deleted: Debt[];
} {
  const active: Debt[] = [];
  const completed: Debt[] = [];
  const deleted: Debt[] = [];
  (Array.isArray(debts) ? debts : []).forEach(function (d) {
    const s = normalizeLedgerStatus(d && d.ledgerStatus);
    if (s === 'completed') completed.push(d);
    else if (s === 'deleted') deleted.push(d);
    else active.push(d);
  });
  return { active, completed, deleted };
}

/** Debts that participate in payoff projections and “total owed”. */
export function activeDebtsOnly(debts: Debt[]): Debt[] {
  return partitionDebtsByLedger(debts).active;
}

export function concatDebtsLedgerOrder(parts: {
  active: Debt[];
  completed: Debt[];
  deleted: Debt[];
}): Debt[] {
  return [...parts.active, ...parts.completed, ...parts.deleted];
}

export function getDebtsEditorSegment(plan: FinancialPlan): DebtLedgerSegment {
  return normalizeDebtsEditorSegment((plan as any).debtsEditorLedgerSegment);
}
