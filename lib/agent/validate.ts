import type { Debt, DebtLedgerStatus, SavingsAccount } from '../../types/index';

export function parseOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseOptionalString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

const DEBT_LEDGER: DebtLedgerStatus[] = ['active', 'completed', 'deleted'];

export function parseDebtLedgerStatus(v: unknown): DebtLedgerStatus | undefined {
  if (typeof v !== 'string') return undefined;
  return DEBT_LEDGER.includes(v as DebtLedgerStatus) ? (v as DebtLedgerStatus) : undefined;
}

export function mergeDebtPatch(existing: Debt, patch: Record<string, unknown>): Debt | string {
  const name = parseOptionalString(patch.name) ?? existing.name;
  const current = parseOptionalNumber(patch.current);
  const aprPct = parseOptionalNumber(patch.aprPct);
  const paidOff = parseOptionalNumber(patch.paidOff);
  const deferredAmount = parseOptionalNumber(patch.deferredAmount);
  const deferredMonthsRemaining = parseOptionalNumber(patch.deferredMonthsRemaining);
  const ledgerStatus = parseDebtLedgerStatus(patch.ledgerStatus) ?? existing.ledgerStatus;
  const deferredExpiresOn =
    patch.deferredExpiresOn !== undefined
      ? (parseOptionalString(patch.deferredExpiresOn) ?? '')
      : existing.deferredExpiresOn;

  if (current !== undefined && current < 0) return 'current must be >= 0';
  if (aprPct !== undefined && aprPct < 0) return 'aprPct must be >= 0';
  if (paidOff !== undefined && paidOff < 0) return 'paidOff must be >= 0';
  if (deferredAmount !== undefined && deferredAmount < 0) return 'deferredAmount must be >= 0';
  if (deferredMonthsRemaining !== undefined && deferredMonthsRemaining < 0) {
    return 'deferredMonthsRemaining must be >= 0';
  }

  return {
    ...existing,
    name,
    current: current ?? existing.current,
    aprPct: aprPct ?? existing.aprPct,
    paidOff: paidOff ?? existing.paidOff,
    deferredAmount: deferredAmount ?? existing.deferredAmount,
    deferredExpiresOn: deferredExpiresOn as Debt['deferredExpiresOn'],
    deferredMonthsRemaining:
      deferredMonthsRemaining !== undefined
        ? Math.floor(deferredMonthsRemaining)
        : existing.deferredMonthsRemaining,
    ...(ledgerStatus ? { ledgerStatus } : {}),
  };
}

export function mergeSavingsPatch(
  existing: SavingsAccount,
  patch: Record<string, unknown>
): SavingsAccount | string {
  const name = parseOptionalString(patch.name) ?? existing.name;
  const current = parseOptionalNumber(patch.current);
  const apyPct = parseOptionalNumber(patch.apyPct);
  const countTowardsGoal =
    patch.countTowardsGoal !== undefined ? Boolean(patch.countTowardsGoal) : existing.countTowardsGoal;
  const ledgerStatus =
    patch.ledgerStatus === 'deleted' || patch.ledgerStatus === 'active'
      ? patch.ledgerStatus
      : existing.ledgerStatus;

  if (current !== undefined && !Number.isFinite(current)) return 'current must be a number';
  if (apyPct !== undefined && apyPct < 0) return 'apyPct must be >= 0';

  return {
    ...existing,
    name,
    current: current ?? existing.current,
    apyPct: apyPct ?? existing.apyPct,
    countTowardsGoal,
    ...(ledgerStatus ? { ledgerStatus } : {}),
  };
}

export function newPaymentId(): string {
  return `ph_agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newDepositId(): string {
  return `dep_agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
