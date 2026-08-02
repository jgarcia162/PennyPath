/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Debt } from '../../types/index.js';
import { PLAN } from './plan-data';
import { defaultLogAtIsoForDashboardCardEdits } from './default-log-at';
import { mergeDebtFromCardElement, removeDebtLedgerEntry } from './debt-editor';
import { mergeSavingsFromCardElement } from './savings-editor';
import { yyyyMmFromDate } from './monthly-activity';
import { RECENT_CARD_ACTIVITY_LIMIT, recentCardActivityEntries } from './render-sections';
import { buildDebtLedgerUnifiedCellHtml } from './debt-ledger-editor-cells';
import { buildSavingsLedgerUnifiedCellHtml } from './savings-ledger-editor-cells';
import { debtLedgerKind, savingsLedgerKind } from './ledger-utils';

const TEST_DEBT: Debt = {
  id: 'card-debt-1',
  name: 'Test Card',
  current: 500,
  paidOff: 100,
  aprPct: 19.99,
  deferredAmount: 0,
  deferredExpiresOn: '',
  deferredMonthsRemaining: 0,
  paymentHistory: [],
};

function mountDebtInlineCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'goal2-debt goal2-debt--editing';
  card.setAttribute('data-debt-id', TEST_DEBT.id);
  card.innerHTML =
    '<input data-field="name" value="Test Card">' +
    '<input data-field="current" value="$500.00">' +
    '<div class="card-inline-edit-ledger">' +
    buildDebtLedgerUnifiedCellHtml() +
    '</div>';
  document.body.appendChild(card);
  return card;
}

function mountSavingsInlineCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'goal3-savings-account goal3-savings-account--editing';
  card.setAttribute('data-savings-id', 'card-sav-1');
  card.innerHTML =
    '<input data-field="name" value="Rainy Day">' +
    '<input data-field="current" value="$1,000.00">' +
    '<input data-field="apyPct" value="4.5">' +
    '<div class="card-inline-edit-ledger">' +
    buildSavingsLedgerUnifiedCellHtml() +
    '</div>';
  document.body.appendChild(card);
  return card;
}

describe('defaultLogAtIsoForDashboardCardEdits', () => {
  it('uses the current calendar day', () => {
    const at = defaultLogAtIsoForDashboardCardEdits();
    const todayYm = yyyyMmFromDate(new Date());
    expect(yyyyMmFromDate(new Date(at))).toBe(todayYm);
  });
});

describe('mergeDebtFromCardElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (PLAN as any).debts = [{ ...TEST_DEBT }];
    (PLAN as any).debtsPaidOffLifetimeCount = 0;
  });

  it('applies payment from card Activity fields and reduces balance', () => {
    const card = mountDebtInlineCard();
    const pay = card.querySelector('input[data-field="payment"]') as HTMLInputElement;
    pay.value = '200';

    expect(mergeDebtFromCardElement(card, { applyPendingLedger: true })).toBe(true);

    const debt = ((PLAN as any).debts as Debt[]).find((d) => d.id === TEST_DEBT.id);
    expect(debt).toBeDefined();
    expect(debt!.current).toBe(300);
    expect(debt!.paidOff).toBe(300);
    expect(debt!.paymentHistory).toHaveLength(1);
    expect(debtLedgerKind(debt!.paymentHistory![0].kind)).toBe('payment');
    expect(pay.value).toBe('');
  });

  it('returns false when debt id is not in active ledger', () => {
    (PLAN as any).debts = [{ ...TEST_DEBT, ledgerStatus: 'completed' }];
    const card = mountDebtInlineCard();
    expect(mergeDebtFromCardElement(card, { applyPendingLedger: true })).toBe(false);
  });

  it('removes a ledger entry and adjusts balance', () => {
    (PLAN as any).debts = [
      {
        ...TEST_DEBT,
        current: 300,
        paidOff: 200,
        paymentHistory: [
          { id: 'ph_keep', amount: 100, at: '2026-01-01T12:00:00Z', kind: 'payment' },
          { id: 'ph_remove', amount: 50, at: '2026-01-02T12:00:00Z', kind: 'payment' },
        ],
      },
    ];
    let rendered = 0;
    const ok = removeDebtLedgerEntry('card-debt-1', 'ph_remove', function () {}, function () {
      rendered += 1;
    });
    expect(ok).toBe(true);
    expect(rendered).toBe(1);
    const debt = ((PLAN as any).debts as Debt[])[0];
    expect(debt.paymentHistory.map((p) => p.id)).toEqual(['ph_keep']);
    expect(debt.current).toBe(350);
    expect(debt.paidOff).toBe(150);
  });

  it('keeps an intentional lower balance even when the debt has charge history', () => {
    // Regression: any balance below PLAN.current used to be treated as "stale after
    // charges" and discarded — Apple (and any debt with charges) could not be edited.
    (PLAN as any).debts = [
      {
        ...TEST_DEBT,
        current: 80415.85,
        paidOff: 106548.4,
        paymentHistory: [
          { id: 'ph1', amount: 100, at: '2026-01-01T12:00:00Z', kind: 'payment' },
          { id: 'ch1', amount: 50, at: '2026-01-02T12:00:00Z', kind: 'charge', memo: 'store' },
        ],
      },
    ];
    const card = mountDebtInlineCard();
    const cur = card.querySelector('input[data-field="current"]') as HTMLInputElement;
    cur.value = '$585.55';

    expect(mergeDebtFromCardElement(card, { applyPendingLedger: true })).toBe(true);

    const debt = ((PLAN as any).debts as Debt[]).find((d) => d.id === TEST_DEBT.id);
    expect(debt!.current).toBe(585.55);
  });
});

describe('recentCardActivityEntries', () => {
  it('returns newest items first and caps at RECENT_CARD_ACTIVITY_LIMIT', () => {
    const items = Array.from({ length: 12 }, function (_, i) {
      return { at: '2026-01-' + String(i + 1).padStart(2, '0') + 'T12:00:00Z', id: String(i) };
    });
    const recent = recentCardActivityEntries(items);
    expect(recent).toHaveLength(RECENT_CARD_ACTIVITY_LIMIT);
    expect(recent[0].id).toBe('11');
    expect(recent[9].id).toBe('2');
  });
});

describe('mergeSavingsFromCardElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (PLAN as any).savingsAccounts = [
      {
        id: 'card-sav-1',
        name: 'Rainy Day',
        current: 1000,
        apyPct: 4.5,
        goalIds: [],
        countTowardsGoal: false,
        depositHistory: [],
      },
    ];
  });

  it('applies deposit from card Activity fields and increases balance', () => {
    const card = mountSavingsInlineCard();
    const dep = card.querySelector('input[data-field="deposit"]') as HTMLInputElement;
    dep.value = '250';

    expect(mergeSavingsFromCardElement(card, { applyPendingLedger: true })).toBe(true);

    const acc = (PLAN as any).savingsAccounts[0];
    expect(acc.current).toBe(1250);
    expect(acc.depositHistory).toHaveLength(1);
    expect(savingsLedgerKind(acc.depositHistory[0].kind)).toBe('deposit');
    expect(dep.value).toBe('');
  });
});
