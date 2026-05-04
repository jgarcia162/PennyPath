/**
 * Savings accounts: active vs soft-deleted (archived off active lists).
 */

import type { SavingsAccount, SavingsLedgerStatus } from '../../types/index.js';

export function normalizeSavingsLedgerStatus(raw: unknown): SavingsLedgerStatus {
  return raw === 'deleted' ? 'deleted' : 'active';
}

export function isSavingsLedgerActive(a: SavingsAccount | null | undefined): boolean {
  const s = a && (a as SavingsAccount & { ledgerStatus?: string }).ledgerStatus;
  return !s || s === 'active';
}

export function partitionSavingsByLedger(accs: SavingsAccount[]): {
  active: SavingsAccount[];
  deleted: SavingsAccount[];
} {
  const active: SavingsAccount[] = [];
  const deleted: SavingsAccount[] = [];
  (Array.isArray(accs) ? accs : []).forEach(function (a) {
    if (normalizeSavingsLedgerStatus((a as SavingsAccount & { ledgerStatus?: string }).ledgerStatus) === 'deleted') {
      deleted.push(a);
    } else {
      active.push(a);
    }
  });
  return { active, deleted };
}

export function concatSavingsLedgerOrder(parts: {
  active: SavingsAccount[];
  deleted: SavingsAccount[];
}): SavingsAccount[] {
  return [...parts.active, ...parts.deleted];
}
