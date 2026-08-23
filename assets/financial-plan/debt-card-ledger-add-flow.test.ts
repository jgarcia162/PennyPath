/**
 * Regression: dashboard card Add must drop that debt's Activity draft so the
 * editor cannot re-apply it when adding a payment on a different debt.
 *
 * Mirrors goal-editors-wire applyDebtCardLedgerQuickAdd + finishGoal2Persist,
 * then debts-editor quick-ledger-entry.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Debt } from '../../types/index.js';
import { PLAN } from './plan-data';
import { renderDebtsEditor } from './render-sections';
import { mergeDebtFromCardElement, readDebtsEditorIntoPlan } from './debt-editor';
import {
  clearDebtLedgerActivityInputs,
  clearDebtLedgerDraftForId,
  clearDebtLedgerDraftStore,
  listDebtLedgerDrafts,
  syncDebtLedgerDraftFromRow,
} from './ledger-editor-draft';
import { buildDebtLedgerUnifiedCellHtml } from './debt-ledger-editor-cells';
import { debtLedgerKind } from './ledger-utils';

function makeDebt(id: string, name: string, current: number): Debt {
  return {
    id,
    name,
    current,
    paidOff: 0,
    aprPct: 19.99,
    deferredAmount: 0,
    deferredExpiresOn: '',
    deferredMonthsRemaining: 0,
    paymentHistory: [],
  };
}

function mountShell(): void {
  document.body.innerHTML =
    '<div id="debts-editor-list"></div>' +
    '<button id="btn-save-goal2-debts" type="button" data-needs-save="0"></button>' +
    '<div id="goal2-debts"></div>';
}

function mountDebtCard(debt: Debt): HTMLElement {
  const card = document.createElement('div');
  card.className = 'goal2-debt goal2-debt--editing';
  card.setAttribute('data-debt-id', debt.id);
  card.innerHTML =
    '<input data-field="name" value="' +
    debt.name +
    '">' +
    '<input data-field="current" value="' +
    String(debt.current) +
    '">' +
    '<div class="card-inline-edit-ledger">' +
    buildDebtLedgerUnifiedCellHtml() +
    '</div>';
  document.getElementById('goal2-debts')!.appendChild(card);
  return card;
}

function renderEditor(opts?: { preserveLedgerActivityDrafts?: boolean }): void {
  renderDebtsEditor(PLAN, opts);
}

function editorRow(debtId: string): Element {
  const row = document.querySelector(
    '#debts-editor-list .debt-row[data-debt-id="' + debtId + '"]'
  );
  if (!row) throw new Error('Expected editor row for ' + debtId);
  return row;
}

function editorPayInput(debtId: string): HTMLInputElement {
  const el = editorRow(debtId).querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  if (!el) throw new Error('Missing payment input for ' + debtId);
  return el;
}

function planDebt(id: string): Debt {
  const debt = ((PLAN as { debts: Debt[] }).debts || []).find(function (d) {
    return d.id === id;
  });
  if (!debt) throw new Error('Missing plan debt ' + id);
  return debt;
}

/** Same sequence as applyDebtCardLedgerQuickAdd after merge. */
function discardCardLedgerDraft(card: HTMLElement): void {
  clearDebtLedgerActivityInputs(card);
  const debtId = card.getAttribute('data-debt-id');
  if (debtId) clearDebtLedgerDraftForId(String(debtId));
}

describe('debt card Add then editor Add on a different debt', () => {
  beforeEach(() => {
    clearDebtLedgerDraftStore();
    (PLAN as { debts: Debt[]; debtsEditorLedgerSegment?: string }).debtsEditorLedgerSegment = 'active';
    (PLAN as { debts: Debt[] }).debts = [makeDebt('d1', 'Card One', 1000), makeDebt('d2', 'Card Two', 800)];
    mountShell();
  });

  it('does not re-apply the card payment when the editor Adds on another debt', () => {
    const card = mountDebtCard(planDebt('d1'));
    const pay = card.querySelector('input[data-field="payment"]') as HTMLInputElement;
    pay.value = '100';
    syncDebtLedgerDraftFromRow(card);

    expect(mergeDebtFromCardElement(card, { applyPendingLedger: true })).toBe(true);
    discardCardLedgerDraft(card);

    expect(planDebt('d1').current).toBe(900);
    expect(planDebt('d1').paymentHistory).toHaveLength(1);
    expect(debtLedgerKind(planDebt('d1').paymentHistory[0].kind)).toBe('payment');
    expect(listDebtLedgerDrafts()).toEqual([]);

    renderEditor({ preserveLedgerActivityDrafts: true });
    expect(editorPayInput('d1').value).toBe('');

    editorPayInput('d2').value = '50';
    readDebtsEditorIntoPlan({ applyPendingLedger: true });

    expect(planDebt('d1').paymentHistory).toHaveLength(1);
    expect(planDebt('d1').current).toBe(900);
    expect(planDebt('d2').paymentHistory).toHaveLength(1);
    expect(planDebt('d2').current).toBe(750);
    expect(debtLedgerKind(planDebt('d2').paymentHistory[0].kind)).toBe('payment');
  });

  it('reproduces the bug when the card draft is left in the store', () => {
    const card = mountDebtCard(planDebt('d1'));
    const pay = card.querySelector('input[data-field="payment"]') as HTMLInputElement;
    pay.value = '100';
    syncDebtLedgerDraftFromRow(card);

    expect(mergeDebtFromCardElement(card, { applyPendingLedger: true })).toBe(true);
    clearDebtLedgerActivityInputs(card);
    // Intentionally skip clearDebtLedgerDraftForId — leftover draft is restored into the editor.

    renderEditor({ preserveLedgerActivityDrafts: true });
    expect(editorPayInput('d1').value).toBe('100');

    editorPayInput('d2').value = '50';
    readDebtsEditorIntoPlan({ applyPendingLedger: true });

    expect(planDebt('d1').paymentHistory).toHaveLength(2);
    expect(planDebt('d1').current).toBe(800);
    expect(planDebt('d2').paymentHistory).toHaveLength(1);
    expect(planDebt('d2').current).toBe(750);
  });

  it('clears Activity inputs when the card itself is the clear host', () => {
    const card = mountDebtCard(planDebt('d1'));
    const pay = card.querySelector('input[data-field="payment"]') as HTMLInputElement;
    const charge = card.querySelector('input[data-field="charge"]') as HTMLInputElement;
    pay.value = '25';
    charge.value = '10';
    clearDebtLedgerActivityInputs(card);
    expect(pay.value).toBe('');
    expect(charge.value).toBe('');
  });
});
