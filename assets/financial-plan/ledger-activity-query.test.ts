import { describe, it, expect } from 'vitest';
import type { Debt, FinancialPlan, PaymentHistoryItem, SavingsAccount } from '../../types/index.js';
import { createBlankFinancialPlan } from './plan-data';
import {
  collectLedgerActivityItems,
  filterLedgerActivityItems,
  groupLedgerActivityItems,
  ledgerActivityItemCount,
  ledgerActivityQueryForAccount,
  queryLedgerActivity,
  sortLedgerActivityItems,
  type LedgerActivityItem,
} from './ledger-activity-query';

function item(
  partial: Partial<LedgerActivityItem> & Pick<LedgerActivityItem, 'id' | 'at' | 'amount'>
): LedgerActivityItem {
  return {
    accountId: 'd1',
    accountName: 'Card',
    accountKind: 'debt',
    kind: 'payment',
    memo: '',
    ...partial,
  };
}

function payment(id: string, amount: number, at: string, kind: PaymentHistoryItem['kind'] = 'payment'): PaymentHistoryItem {
  return { id, amount, at, kind };
}

function planWithDebt(history: PaymentHistoryItem[], extra?: Partial<Debt>): FinancialPlan {
  const plan = createBlankFinancialPlan();
  plan.debts = [
    {
      id: 'd1',
      name: 'Visa',
      current: 100,
      paidOff: 0,
      aprPct: 20,
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: history,
      ...extra,
    },
  ];
  return plan;
}

describe('ledgerActivityQueryForAccount', () => {
  it('scopes to one account, newest first, ungrouped', () => {
    const q = ledgerActivityQueryForAccount('debt', 'd1');
    expect(q.sort).toBe('date-desc');
    expect(q.groupBy).toBe('none');
    expect(q.accountIds).toEqual(['d1']);
    expect(q.accountKinds).toEqual(['debt']);
    expect(q.kinds).toBeUndefined();
  });
});

describe('collectLedgerActivityItems', () => {
  it('maps debt payments and charges', () => {
    const plan = planWithDebt([
      payment('p1', 10, '2026-01-01T00:00:00Z', 'payment'),
      payment('c1', 5, '2026-02-01T00:00:00Z', 'charge'),
    ]);
    const items = collectLedgerActivityItems(plan);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kind).sort()).toEqual(['charge', 'payment']);
    expect(items[0].accountName).toBe('Visa');
  });

  it('maps savings deposits and withdrawals', () => {
    const plan = createBlankFinancialPlan();
    plan.savingsAccounts = [
      {
        id: 's1',
        name: 'HYSA',
        current: 50,
        apyPct: 4,
        goalIds: [],
        countTowardsGoal: false,
        depositHistory: [
          { id: 'dep1', amount: 20, at: '2026-03-01T00:00:00Z', kind: 'deposit' },
          { id: 'w1', amount: 8, at: '2026-03-02T00:00:00Z', kind: 'withdrawal' },
        ],
      } satisfies SavingsAccount,
    ];
    const items = collectLedgerActivityItems(plan);
    expect(items.map((i) => i.kind).sort()).toEqual(['deposit', 'withdrawal']);
  });
});

describe('filterLedgerActivityItems', () => {
  const items = [
    item({ id: '1', amount: 1, at: '2026-01-01T00:00:00Z', kind: 'payment', accountId: 'd1' }),
    item({ id: '2', amount: 2, at: '2026-01-02T00:00:00Z', kind: 'charge', accountId: 'd1' }),
    item({
      id: '3',
      amount: 3,
      at: '2026-01-03T00:00:00Z',
      kind: 'deposit',
      accountId: 's1',
      accountKind: 'savings',
    }),
  ];

  it('filters by kind (future account-type / payment-vs-charge filters)', () => {
    const onlyCharges = filterLedgerActivityItems(items, { kinds: ['charge'] });
    expect(onlyCharges.map((i) => i.id)).toEqual(['2']);
  });

  it('filters by account id', () => {
    const one = filterLedgerActivityItems(items, { accountIds: ['s1'] });
    expect(one.map((i) => i.id)).toEqual(['3']);
  });
});

describe('sortLedgerActivityItems', () => {
  const items = [
    item({ id: 'a', amount: 10, at: '2026-01-01T00:00:00Z' }),
    item({ id: 'b', amount: 30, at: '2026-03-01T00:00:00Z' }),
    item({ id: 'c', amount: 20, at: '2026-02-01T00:00:00Z' }),
  ];

  it('sorts by date descending (default)', () => {
    expect(sortLedgerActivityItems(items, 'date-desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by date ascending', () => {
    expect(sortLedgerActivityItems(items, 'date-asc').map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by amount descending', () => {
    expect(sortLedgerActivityItems(items, 'amount-desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by amount ascending', () => {
    expect(sortLedgerActivityItems(items, 'amount-asc').map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('groupLedgerActivityItems', () => {
  it('returns a single unlabeled section when ungrouped', () => {
    const items = [item({ id: 'a', amount: 1, at: '2026-01-15T00:00:00Z' })];
    const sections = groupLedgerActivityItems(items, 'none', 'date-desc');
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('all');
    expect(sections[0].label).toBe('');
    expect(sections[0].items).toHaveLength(1);
  });

  it('sections by calendar month for the next-phase chronological view', () => {
    const items = [
      item({ id: 'apr', amount: 1, at: '2026-04-10T12:00:00Z' }),
      item({ id: 'jan', amount: 1, at: '2026-01-10T12:00:00Z' }),
      item({ id: 'apr2', amount: 2, at: '2026-04-20T12:00:00Z' }),
    ];
    const sections = groupLedgerActivityItems(items, 'month', 'date-desc');
    expect(sections.map((s) => s.key)).toEqual(['2026-04', '2026-01']);
    expect(sections[0].label).toMatch(/April/);
    expect(sections[0].items.map((i) => i.id)).toEqual(['apr', 'apr2']);
  });
});

describe('queryLedgerActivity', () => {
  it('returns every row for one debt, not a recent-activity cap', () => {
    const history: PaymentHistoryItem[] = [];
    for (let i = 0; i < 15; i++) {
      history.push(payment('e' + i, i + 1, '2026-01-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z'));
    }
    const plan = planWithDebt(history);
    const sections = queryLedgerActivity(plan, ledgerActivityQueryForAccount('debt', 'd1'));
    expect(ledgerActivityItemCount(sections)).toBe(15);
    expect(sections[0].items[0].id).toBe('e14');
  });
});
