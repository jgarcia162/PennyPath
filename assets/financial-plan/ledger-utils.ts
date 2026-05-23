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
