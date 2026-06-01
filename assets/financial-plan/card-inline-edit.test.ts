/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Debt } from '../../types/index.js';
import { PLAN } from './plan-data';
import { mergeDebtFromCardElement } from './debt-editor';
import { mergeSavingsFromCardElement } from './savings-editor';
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
