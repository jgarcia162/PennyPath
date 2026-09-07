/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PLAN } from './plan-data';
import type { PaymentHistoryItem } from '../../types/index.js';
import {
  ensureLedgerActivityDialog,
  openLedgerActivityDialog,
  renderLedgerActivityDialogList,
  setLedgerActivityDialogQuery,
} from './ledger-activity-dialog';
import { ledgerActivityQueryForAccount, queryLedgerActivity } from './ledger-activity-query';
import { RECENT_CARD_ACTIVITY_LIMIT, refreshInlineDebtCardAfterLedgerAdd } from './render-sections';
import { createMoneyFormatters } from './utils';

const TEST_DEBT = {
  id: 'visa-1',
  name: 'Travel Visa',
  current: 500,
  paidOff: 0,
  aprPct: 19.99,
  deferredAmount: 0,
  deferredExpiresOn: '' as const,
  deferredMonthsRemaining: 0,
  paymentHistory: [] as PaymentHistoryItem[],
};

function historyCount(n: number): PaymentHistoryItem[] {
  const out: PaymentHistoryItem[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'tx-' + i,
      amount: i + 1,
      at: '2026-0' + (i < 9 ? '1' : '2') + '-' + String((i % 28) + 1).padStart(2, '0') + 'T12:00:00Z',
      kind: i % 2 === 0 ? 'payment' : 'charge',
    });
  }
  return out;
}

describe('ledger activity dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (PLAN as any).debts = [{ ...TEST_DEBT, paymentHistory: historyCount(12) }];
  });

  it('creates a hidden toolbar host for later sort/filter controls', () => {
    const dlg = ensureLedgerActivityDialog();
    expect(dlg).toBeTruthy();
    const toolbar = document.getElementById('ledger-activity-dialog-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar?.hasAttribute('hidden')).toBe(true);
  });

  it('lists every transaction for a debt, not the card cap', () => {
    openLedgerActivityDialog({ accountKind: 'debt', accountId: 'visa-1' });
    const rows = document.querySelectorAll('.ledger-activity-row');
    expect(rows.length).toBe(12);
    expect(rows.length).toBeGreaterThan(RECENT_CARD_ACTIVITY_LIMIT);
    const subtitle = document.getElementById('ledger-activity-dialog-subtitle');
    expect(subtitle?.textContent).toMatch(/Travel Visa/);
    expect(subtitle?.textContent).toMatch(/12 transactions/);
    const section = document.querySelector('.ledger-activity-section') as HTMLElement | null;
    expect(section?.getAttribute('data-section-key')).toBe('all');
    expect(section?.querySelector('.ledger-activity-section__label')).toBeNull();
  });

  it('can regroup by month through the query API without changing list markup shape', () => {
    openLedgerActivityDialog({ accountKind: 'debt', accountId: 'visa-1' });
    setLedgerActivityDialogQuery({ groupBy: 'month' });
    const labels = document.querySelectorAll('.ledger-activity-section__label');
    expect(labels.length).toBeGreaterThan(1);
    expect(document.querySelectorAll('.ledger-activity-row').length).toBe(12);
  });
});

describe('renderLedgerActivityDialogList', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ledger-activity-dialog-body"></div>';
    (PLAN as any).debts = [{ ...TEST_DEBT, paymentHistory: historyCount(3) }];
  });

  it('renders kind, amount, and date on each row', () => {
    const sections = queryLedgerActivity(PLAN, ledgerActivityQueryForAccount('debt', 'visa-1'));
    renderLedgerActivityDialogList(sections);
    const row = document.querySelector('.ledger-activity-row') as HTMLElement | null;
    expect(row?.getAttribute('data-kind')).toMatch(/payment|charge/);
    expect(row?.querySelector('.ledger-activity-row__amount')?.textContent).toMatch(/\$/);
    expect(row?.querySelector('.ledger-activity-row__date')?.textContent).not.toBe('');
  });
});

describe('refreshInlineDebtCardAfterLedgerAdd see-all', () => {
  it('adds a See all button that does not force Recent activity open', () => {
    const { moneyExact } = createMoneyFormatters();
    document.body.innerHTML = '';
    (PLAN as any).debts = [{ ...TEST_DEBT, paymentHistory: historyCount(1) }];
    const card = document.createElement('div');
    card.className = 'goal2-debt goal2-debt--editing';
    card.setAttribute('data-debt-id', TEST_DEBT.id);
    const details = document.createElement('details');
    details.className = 'goal2-debt-payments';
    card.appendChild(details);
    document.body.appendChild(card);

    refreshInlineDebtCardAfterLedgerAdd(card, PLAN as any, moneyExact);

    const next = card.querySelector('.goal2-debt-payments') as HTMLDetailsElement;
    expect(next.open).toBe(false);
    const seeAll = card.querySelector('[data-action="see-all-ledger"]') as HTMLButtonElement | null;
    expect(seeAll).toBeTruthy();
    expect(seeAll?.getAttribute('data-account-kind')).toBe('debt');
    expect(seeAll?.getAttribute('data-account-id')).toBe(TEST_DEBT.id);
  });
});
