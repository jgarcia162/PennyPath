import { describe, it, expect } from 'vitest';
import type { DepositHistoryItem, PaymentHistoryItem } from '../../types/index.js';
import {
  LEDGER_MEMO_MAX,
  debtLedgerKind,
  debtHasPaymentEntries,
  formatDebtLedgerSummary,
  formatSavingsLedgerSummary,
  isDebtChargeEntry,
  isDebtPaymentEntry,
  isSavingsDepositEntry,
  isSavingsWithdrawalEntry,
  normalizeLedgerMemo,
  savingsLedgerKind,
} from './ledger-utils.js';

const moneyExact = (n: number) => `$${n.toFixed(2)}`;

describe('normalizeLedgerMemo', () => {
  it('trims whitespace', () => {
    expect(normalizeLedgerMemo('  hello  ')).toBe('hello');
  });

  it('truncates to LEDGER_MEMO_MAX characters', () => {
    const long = 'a'.repeat(150);
    expect(normalizeLedgerMemo(long)).toHaveLength(LEDGER_MEMO_MAX);
  });

  it('returns empty string for non-string input', () => {
    expect(normalizeLedgerMemo(null)).toBe('');
    expect(normalizeLedgerMemo(42)).toBe('');
    expect(normalizeLedgerMemo(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(normalizeLedgerMemo('')).toBe('');
  });

  it('preserves strings shorter than max', () => {
    expect(normalizeLedgerMemo('Monthly auto-pay')).toBe('Monthly auto-pay');
  });
});

describe('debtLedgerKind', () => {
  it('returns "charge" when raw is "charge"', () => {
    expect(debtLedgerKind('charge')).toBe('charge');
  });

  it('defaults to "payment" for "payment"', () => {
    expect(debtLedgerKind('payment')).toBe('payment');
  });

  it('defaults to "payment" for undefined', () => {
    expect(debtLedgerKind(undefined)).toBe('payment');
  });

  it('defaults to "payment" for unknown strings', () => {
    expect(debtLedgerKind('bogus')).toBe('payment');
  });
});

describe('savingsLedgerKind', () => {
  it('returns "withdrawal" when raw is "withdrawal"', () => {
    expect(savingsLedgerKind('withdrawal')).toBe('withdrawal');
  });

  it('defaults to "deposit" for "deposit"', () => {
    expect(savingsLedgerKind('deposit')).toBe('deposit');
  });

  it('defaults to "deposit" for undefined', () => {
    expect(savingsLedgerKind(undefined)).toBe('deposit');
  });
});

describe('type guards', () => {
  const payment: PaymentHistoryItem = { id: 'ph_1', amount: 100, at: '2026-01-01T00:00:00Z', kind: 'payment' };
  const charge: PaymentHistoryItem = { id: 'ph_2', amount: 50, at: '2026-01-02T00:00:00Z', kind: 'charge' };
  const noKind: PaymentHistoryItem = { id: 'ph_3', amount: 75, at: '2026-01-03T00:00:00Z' };
  const deposit: DepositHistoryItem = { id: 'dep_1', amount: 200, at: '2026-01-01T00:00:00Z', kind: 'deposit' };
  const withdrawal: DepositHistoryItem = { id: 'dep_2', amount: 30, at: '2026-01-03T00:00:00Z', kind: 'withdrawal' };

  it('isDebtPaymentEntry identifies payments', () => {
    expect(isDebtPaymentEntry(payment)).toBe(true);
    expect(isDebtPaymentEntry(charge)).toBe(false);
  });

  it('isDebtPaymentEntry defaults to true when kind is omitted', () => {
    expect(isDebtPaymentEntry(noKind)).toBe(true);
  });

  it('isDebtChargeEntry identifies charges', () => {
    expect(isDebtChargeEntry(charge)).toBe(true);
    expect(isDebtChargeEntry(payment)).toBe(false);
  });

  it('isSavingsDepositEntry identifies deposits', () => {
    expect(isSavingsDepositEntry(deposit)).toBe(true);
    expect(isSavingsDepositEntry(withdrawal)).toBe(false);
  });

  it('isSavingsWithdrawalEntry identifies withdrawals', () => {
    expect(isSavingsWithdrawalEntry(withdrawal)).toBe(true);
    expect(isSavingsWithdrawalEntry(deposit)).toBe(false);
  });
});

describe('debtHasPaymentEntries', () => {
  it('returns true when at least one payment exists', () => {
    const history: PaymentHistoryItem[] = [
      { id: 'ph_1', amount: 100, at: '2026-01-01T00:00:00Z', kind: 'charge' },
      { id: 'ph_2', amount: 200, at: '2026-01-02T00:00:00Z', kind: 'payment' },
    ];
    expect(debtHasPaymentEntries(history)).toBe(true);
  });

  it('returns false when only charges exist', () => {
    const history: PaymentHistoryItem[] = [
      { id: 'ph_1', amount: 50, at: '2026-01-01T00:00:00Z', kind: 'charge' },
    ];
    expect(debtHasPaymentEntries(history)).toBe(false);
  });

  it('returns false for empty history', () => {
    expect(debtHasPaymentEntries([])).toBe(false);
  });
});

describe('formatDebtLedgerSummary', () => {
  it('renders payment without memo', () => {
    const row: PaymentHistoryItem = { id: 'ph_1', amount: 250, at: '2026-01-01T00:00:00Z' };
    expect(formatDebtLedgerSummary(row, moneyExact)).toBe('Payment $250.00');
  });

  it('includes memo separated by ·', () => {
    const row: PaymentHistoryItem = { id: 'ph_2', amount: 75, at: '2026-01-01T00:00:00Z', memo: 'Monthly auto-pay' };
    expect(formatDebtLedgerSummary(row, moneyExact)).toBe('Payment $75.00 · Monthly auto-pay');
  });

  it('renders charge label for charge kind', () => {
    const row: PaymentHistoryItem = { id: 'ph_3', amount: 45, at: '2026-01-01T00:00:00Z', kind: 'charge' };
    expect(formatDebtLedgerSummary(row, moneyExact)).toBe('Charge $45.00');
  });
});

describe('formatSavingsLedgerSummary', () => {
  it('renders deposit without memo', () => {
    const row: DepositHistoryItem = { id: 'dep_1', amount: 500, at: '2026-01-01T00:00:00Z' };
    expect(formatSavingsLedgerSummary(row, moneyExact)).toBe('Deposit $500.00');
  });

  it('renders withdrawal with memo', () => {
    const row: DepositHistoryItem = { id: 'dep_2', amount: 100, at: '2026-01-01T00:00:00Z', kind: 'withdrawal', memo: 'Emergency' };
    expect(formatSavingsLedgerSummary(row, moneyExact)).toBe('Withdrawal $100.00 · Emergency');
  });
});
