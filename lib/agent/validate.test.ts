import { describe, it, expect } from 'vitest';
import type { Debt, SavingsAccount } from '../../types/index';
import {
  parseOptionalNumber,
  parseOptionalString,
  parseDebtLedgerStatus,
  mergeDebtPatch,
  mergeSavingsPatch,
  newPaymentId,
  newDepositId,
} from './validate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseDebt: Debt = {
  id: 'd1',
  name: 'Credit Card',
  current: 1000,
  paidOff: 200,
  aprPct: 19.99,
  deferredAmount: 0,
  deferredExpiresOn: '',
  deferredMonthsRemaining: 0,
  paymentHistory: [],
  ledgerStatus: 'active',
};

const baseSavings: SavingsAccount = {
  id: 'a1',
  name: 'Emergency Fund',
  current: 5000,
  apyPct: 4.5,
  goalIds: [],
  countTowardsGoal: true,
  depositHistory: [],
  ledgerStatus: 'active',
};

// ---------------------------------------------------------------------------
// parseOptionalNumber
// ---------------------------------------------------------------------------

describe('parseOptionalNumber', () => {
  it('returns undefined for undefined', () => {
    expect(parseOptionalNumber(undefined)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(parseOptionalNumber(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseOptionalNumber('')).toBeUndefined();
  });

  it('returns undefined for NaN-producing string', () => {
    expect(parseOptionalNumber('abc')).toBeUndefined();
  });

  it('returns undefined for Infinity', () => {
    expect(parseOptionalNumber(Infinity)).toBeUndefined();
  });

  it('parses a valid integer string', () => {
    expect(parseOptionalNumber('42')).toBe(42);
  });

  it('parses a valid float string', () => {
    expect(parseOptionalNumber('3.14')).toBe(3.14);
  });

  it('passes through a number', () => {
    expect(parseOptionalNumber(100)).toBe(100);
  });

  it('parses zero', () => {
    expect(parseOptionalNumber(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseOptionalString
// ---------------------------------------------------------------------------

describe('parseOptionalString', () => {
  it('returns undefined for undefined', () => {
    expect(parseOptionalString(undefined)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(parseOptionalString(null)).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(parseOptionalString('   ')).toBeUndefined();
  });

  it('trims whitespace and returns non-empty string', () => {
    expect(parseOptionalString('  hello  ')).toBe('hello');
  });

  it('returns a plain string', () => {
    expect(parseOptionalString('debt name')).toBe('debt name');
  });
});

// ---------------------------------------------------------------------------
// parseDebtLedgerStatus
// ---------------------------------------------------------------------------

describe('parseDebtLedgerStatus', () => {
  it('returns active', () => expect(parseDebtLedgerStatus('active')).toBe('active'));
  it('returns completed', () => expect(parseDebtLedgerStatus('completed')).toBe('completed'));
  it('returns deleted', () => expect(parseDebtLedgerStatus('deleted')).toBe('deleted'));
  it('returns undefined for unknown string', () => expect(parseDebtLedgerStatus('pending')).toBeUndefined());
  it('returns undefined for non-string', () => expect(parseDebtLedgerStatus(42)).toBeUndefined());
});

// ---------------------------------------------------------------------------
// mergeDebtPatch
// ---------------------------------------------------------------------------

describe('mergeDebtPatch', () => {
  it('returns existing debt unchanged when patch is empty', () => {
    const result = mergeDebtPatch(baseDebt, {});
    expect(result).toMatchObject({ id: 'd1', name: 'Credit Card', current: 1000 });
  });

  it('updates name', () => {
    const result = mergeDebtPatch(baseDebt, { name: 'New Name' });
    expect(typeof result !== 'string' && result.name).toBe('New Name');
  });

  it('updates current balance', () => {
    const result = mergeDebtPatch(baseDebt, { current: 750 });
    expect(typeof result !== 'string' && result.current).toBe(750);
  });

  it('updates aprPct', () => {
    const result = mergeDebtPatch(baseDebt, { aprPct: 24.99 });
    expect(typeof result !== 'string' && result.aprPct).toBe(24.99);
  });

  it('updates ledgerStatus to completed', () => {
    const result = mergeDebtPatch(baseDebt, { ledgerStatus: 'completed' });
    expect(typeof result !== 'string' && result.ledgerStatus).toBe('completed');
  });

  it('rejects current < 0', () => {
    expect(mergeDebtPatch(baseDebt, { current: -1 })).toBe('current must be >= 0');
  });

  it('rejects aprPct < 0', () => {
    expect(mergeDebtPatch(baseDebt, { aprPct: -5 })).toBe('aprPct must be >= 0');
  });

  it('rejects paidOff < 0', () => {
    expect(mergeDebtPatch(baseDebt, { paidOff: -10 })).toBe('paidOff must be >= 0');
  });

  it('rejects deferredAmount < 0', () => {
    expect(mergeDebtPatch(baseDebt, { deferredAmount: -1 })).toBe('deferredAmount must be >= 0');
  });

  it('rejects deferredMonthsRemaining < 0', () => {
    expect(mergeDebtPatch(baseDebt, { deferredMonthsRemaining: -1 })).toBe(
      'deferredMonthsRemaining must be >= 0'
    );
  });

  it('floors deferredMonthsRemaining to integer', () => {
    const result = mergeDebtPatch(baseDebt, { deferredMonthsRemaining: 3.9 });
    expect(typeof result !== 'string' && result.deferredMonthsRemaining).toBe(3);
  });

  it('preserves paymentHistory from existing debt', () => {
    const debtWithHistory: Debt = {
      ...baseDebt,
      paymentHistory: [{ id: 'ph1', amount: 100, at: '2026-01-01T00:00:00Z' }],
    };
    const result = mergeDebtPatch(debtWithHistory, { current: 900 });
    expect(typeof result !== 'string' && result.paymentHistory).toHaveLength(1);
  });

  it('accepts current = 0', () => {
    const result = mergeDebtPatch(baseDebt, { current: 0 });
    expect(typeof result !== 'string' && result.current).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mergeSavingsPatch
// ---------------------------------------------------------------------------

describe('mergeSavingsPatch', () => {
  it('returns existing account unchanged when patch is empty', () => {
    const result = mergeSavingsPatch(baseSavings, {});
    expect(result).toMatchObject({ id: 'a1', name: 'Emergency Fund', current: 5000 });
  });

  it('updates current balance', () => {
    const result = mergeSavingsPatch(baseSavings, { current: 6000 });
    expect(typeof result !== 'string' && result.current).toBe(6000);
  });

  it('updates apyPct', () => {
    const result = mergeSavingsPatch(baseSavings, { apyPct: 5.0 });
    expect(typeof result !== 'string' && result.apyPct).toBe(5.0);
  });

  it('coerces countTowardsGoal to boolean', () => {
    const result = mergeSavingsPatch(baseSavings, { countTowardsGoal: 0 });
    expect(typeof result !== 'string' && result.countTowardsGoal).toBe(false);
  });

  it('rejects apyPct < 0', () => {
    expect(mergeSavingsPatch(baseSavings, { apyPct: -1 })).toBe('apyPct must be >= 0');
  });

  it('accepts apyPct = 0', () => {
    const result = mergeSavingsPatch(baseSavings, { apyPct: 0 });
    expect(typeof result !== 'string' && result.apyPct).toBe(0);
  });

  it('updates ledgerStatus to deleted', () => {
    const result = mergeSavingsPatch(baseSavings, { ledgerStatus: 'deleted' });
    expect(typeof result !== 'string' && result.ledgerStatus).toBe('deleted');
  });
});

// ---------------------------------------------------------------------------
// newPaymentId / newDepositId
// ---------------------------------------------------------------------------

describe('newPaymentId', () => {
  it('starts with ph_agent_', () => {
    expect(newPaymentId()).toMatch(/^ph_agent_/);
  });

  it('generates unique ids', () => {
    expect(newPaymentId()).not.toBe(newPaymentId());
  });
});

describe('newDepositId', () => {
  it('starts with dep_agent_', () => {
    expect(newDepositId()).toMatch(/^dep_agent_/);
  });

  it('generates unique ids', () => {
    expect(newDepositId()).not.toBe(newDepositId());
  });
});
