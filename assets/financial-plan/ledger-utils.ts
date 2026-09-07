/**
 * Shared helpers for debt payment/charge and savings deposit/withdrawal ledger rows.
 */

import type {
  DebtLedgerEntryKind,
  DepositHistoryItem,
  PaymentHistoryItem,
  SavingsLedgerEntryKind,
} from '../../types/index.js';

export const LEDGER_MEMO_MAX = 120;

export function normalizeLedgerMemo(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, LEDGER_MEMO_MAX);
}

export function debtLedgerKind(raw: unknown): DebtLedgerEntryKind {
  return raw === 'charge' ? 'charge' : 'payment';
}

export function savingsLedgerKind(raw: unknown): SavingsLedgerEntryKind {
  return raw === 'withdrawal' ? 'withdrawal' : 'deposit';
}

export function isDebtPaymentEntry(p: PaymentHistoryItem): boolean {
  return debtLedgerKind(p.kind) === 'payment';
}

export function isDebtChargeEntry(p: PaymentHistoryItem): boolean {
  return debtLedgerKind(p.kind) === 'charge';
}

export function isSavingsDepositEntry(p: DepositHistoryItem): boolean {
  return savingsLedgerKind(p.kind) === 'deposit';
}

export function isSavingsWithdrawalEntry(p: DepositHistoryItem): boolean {
  return savingsLedgerKind(p.kind) === 'withdrawal';
}

export function debtHasPaymentEntries(history: PaymentHistoryItem[]): boolean {
  return history.some(isDebtPaymentEntry);
}

export function formatDebtLedgerSummary(p: PaymentHistoryItem, moneyExact: (n: number) => string): string {
  const kind = debtLedgerKind(p.kind);
  const label = kind === 'charge' ? 'Charge' : 'Payment';
  const memo = normalizeLedgerMemo(p.memo);
  return memo ? label + ' ' + moneyExact(Number(p.amount)) + ' · ' + memo : label + ' ' + moneyExact(Number(p.amount));
}

export function formatSavingsLedgerSummary(p: DepositHistoryItem, moneyExact: (n: number) => string): string {
  const kind = savingsLedgerKind(p.kind);
  const label = kind === 'withdrawal' ? 'Withdrawal' : 'Deposit';
  const memo = normalizeLedgerMemo(p.memo);
  return memo ? label + ' ' + moneyExact(Number(p.amount)) + ' · ' + memo : label + ' ' + moneyExact(Number(p.amount));
}

/** Ledger amount/memo inputs that must not commit on blur or draft sync. */
export function isLedgerPendingEditorField(el: Element | null): boolean {
  if (!el || typeof (el as HTMLElement).matches !== 'function') return false;
  const node = el as HTMLElement;
  if (!node.matches('input, textarea, select')) return false;
  return node.matches(
    'input[data-field="payment"], input[data-field="charge"], input[data-field="deposit"], input[data-field="withdrawal"], input[data-field="charge-memo"], input[data-field="withdrawal-memo"]'
  );
}

/** Enter on a quick-edit card should Add (not Save) from activity fields or the Add button. */
export function isInlineCardLedgerAddTarget(el: Element | null): boolean {
  if (!el) return false;
  if (isLedgerPendingEditorField(el)) return true;
  const node = el as HTMLElement;
  if (typeof node.closest !== 'function') return false;
  return !!node.closest(
    '[data-action="quick-ledger-entry"], [data-action="quick-savings-ledger-entry"], .btn-quick-ledger-entry, .btn-quick-savings-ledger-entry'
  );
}
