/**
 * Debt ledger: active vs paid-off vs soft-deleted rows.
 */

import type { Debt, DebtLedgerStatus, FinancialPlan } from '../../types/index.js';

/** Which bucket the debts editor dialog shows (deleted rows live on the dashboard only). */
export type DebtsEditorSegment = 'active' | 'completed';

const VALID: Record<string, DebtLedgerStatus> = {
  active: 'active',
  completed: 'completed',
  deleted: 'deleted',
};

export function normalizeLedgerStatus(raw: unknown): DebtLedgerStatus {
  if (typeof raw === 'string' && VALID[raw]) return VALID[raw];
  return 'active';
}

export function normalizeDebtsEditorSegment(raw: unknown): DebtsEditorSegment {
  const s = normalizeLedgerStatus(raw);
  if (s === 'completed') return 'completed';
  return 'active';
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
  // Defensive: prevent duplicate ids from showing twice in archives after refresh/navigation.
  // Prefer the earliest ledger bucket in display order: active → completed → deleted.
  const out: Debt[] = [];
  const seen = new Set<string>();
  [...parts.active, ...parts.completed, ...parts.deleted].forEach(function (d) {
    const id = String(d && (d as any).id != null ? (d as any).id : '');
    if (!id) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(d);
  });
  return out;
}

export function getDebtsEditorSegment(plan: FinancialPlan): DebtsEditorSegment {
  return normalizeDebtsEditorSegment((plan as any).debtsEditorLedgerSegment);
}
