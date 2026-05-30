/**
 * Integration tests for Goal 3 Add → withdrawal + note → memo clears after commit/re-render.
 * Mirrors goal-editors-wire quick-savings-ledger-entry + finishGoal3Persist.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SavingsAccount } from '../../types/index.js';
import { PLAN } from './plan-data';
import { derived } from './plan-derived';
import { renderSavingsEditor } from './render-sections';
import { readSavingsEditorIntoPlan } from './savings-editor';
import {
  clearSavingsLedgerActivityInputs,
  clearSavingsLedgerDraftStore,
  listSavingsLedgerDrafts,
  syncSavingsLedgerDraftFromRow,
} from './ledger-editor-draft';
import { savingsLedgerKind } from './ledger-utils';

const TEST_ACCOUNT: SavingsAccount = {
  id: 'test-acct',
  name: 'Test HYSA',
  current: 1000,
  apyPct: 3.25,
  goalIds: [],
  countTowardsGoal: false,
  depositHistory: [],
};

function mountSavingsEditorShell(): HTMLElement {
  document.body.innerHTML =
    '<div id="savings-editor-list"></div>' +
    '<button id="btn-save-goal3-savings" type="button" data-needs-save="0"></button>';
  return document.getElementById('savings-editor-list') as HTMLElement;
}

function renderEditor(opts?: { preserveLedgerActivityDrafts?: boolean }): void {
  renderSavingsEditor(derived(PLAN), opts);
}

function firstSavingsRow(): Element {
  const row = document.querySelector('#savings-editor-list .savings-row');
  if (!row) throw new Error('Expected a savings editor row');
  return row;
}

function ledgerInput(field: 'deposit' | 'withdrawal' | 'withdrawal-memo'): HTMLInputElement {
  const el = firstSavingsRow().querySelector('input[data-field="' + field + '"]') as HTMLInputElement | null;
  if (!el) throw new Error('Missing ledger input: ' + field);
  return el;
}

function fillPendingWithdrawal(amount: string, memo: string): void {
  ledgerInput('withdrawal').value = amount;
  ledgerInput('withdrawal-memo').value = memo;
  syncSavingsLedgerDraftFromRow(firstSavingsRow());
}

function memoValue(): string {
  return ledgerInput('withdrawal-memo').value;
}

/** Same sequence as goal-editors-wire quick-savings-ledger-entry + finishGoal3Persist. */
async function runSavingsAddCommitFlow(opts?: {
  pendingMemo?: string;
  simulateAsyncStoreRepublish?: boolean;
  preserveLedgerActivityDrafts?: boolean;
}): Promise<void> {
  const host = document.getElementById('savings-editor-list') as HTMLElement;
  const pendingMemo = opts?.pendingMemo ?? ledgerInput('withdrawal-memo').value;
  readSavingsEditorIntoPlan({ applyPendingLedger: true });
  clearSavingsLedgerDraftStore();
  clearSavingsLedgerActivityInputs(host);

  if (opts?.simulateAsyncStoreRepublish && pendingMemo) {
    // Late input/blur during await savePlanOverrides can repopulate the draft store.
    ledgerInput('withdrawal-memo').value = pendingMemo;
    syncSavingsLedgerDraftFromRow(firstSavingsRow());
    expect(listSavingsLedgerDrafts()[0]?.withdrawalMemo).toBe(pendingMemo);
  }

  renderEditor({ preserveLedgerActivityDrafts: opts?.preserveLedgerActivityDrafts });
}

describe('savings Add flow — withdrawal + note', () => {
  beforeEach(() => {
    clearSavingsLedgerDraftStore();
    (PLAN as any).savingsAccounts = [{ ...TEST_ACCOUNT, depositHistory: [] }];
    mountSavingsEditorShell();
    renderEditor();
  });

  it('commits withdrawal with memo into PLAN and clears pending DOM fields on apply', () => {
    fillPendingWithdrawal('50', 'ATM withdrawal');

    readSavingsEditorIntoPlan({ applyPendingLedger: true });

    const acc = ((PLAN as any).savingsAccounts as SavingsAccount[])[0];
    expect(acc.current).toBe(950);
    expect(acc.depositHistory).toHaveLength(1);
    expect(savingsLedgerKind(acc.depositHistory![0].kind)).toBe('withdrawal');
    expect(acc.depositHistory![0].memo).toBe('ATM withdrawal');

    expect(ledgerInput('withdrawal').value).toBe('');
    expect(memoValue()).toBe('');
  });

  it('clears note after Add commit + re-render (preserveLedgerActivityDrafts: false)', async () => {
    fillPendingWithdrawal('25', 'ATM withdrawal');

    await runSavingsAddCommitFlow({
      simulateAsyncStoreRepublish: true,
      preserveLedgerActivityDrafts: false,
    });

    expect(memoValue()).toBe('');
    expect(ledgerInput('withdrawal').value).toBe('');
    expect(listSavingsLedgerDrafts()).toEqual([]);
  });

  it('documents pre-fix bug: default preserve restores note from draft store after async gap', async () => {
    fillPendingWithdrawal('25', 'ATM withdrawal');

    await runSavingsAddCommitFlow({
      pendingMemo: 'ATM withdrawal',
      simulateAsyncStoreRepublish: true,
      preserveLedgerActivityDrafts: true,
    });

    expect(memoValue()).toBe('ATM withdrawal');
  });
});

describe('render-page forwards preserveLedgerActivityDrafts to savings editor', () => {
  beforeEach(() => {
    clearSavingsLedgerDraftStore();
    (PLAN as any).savingsAccounts = [
      {
        ...TEST_ACCOUNT,
        current: 990,
        depositHistory: [
          {
            id: 'w_existing',
            amount: 10,
            at: '2026-05-01T12:00:00.000Z',
            kind: 'withdrawal',
            memo: 'Already saved',
          },
        ],
      },
    ];
    mountSavingsEditorShell();
    renderEditor();
  });

  it('clears activity note when render uses preserveLedgerActivityDrafts: false', async () => {
    const { render } = await import('./render-page.js');

    fillPendingWithdrawal('5', 'Should clear');
    await runSavingsAddCommitFlow({
      pendingMemo: 'Should clear',
      simulateAsyncStoreRepublish: true,
      preserveLedgerActivityDrafts: undefined,
    });
    expect(memoValue()).toBe('Should clear');

    render({ refreshBalanceEditors: true, preserveLedgerActivityDrafts: false });
    expect(memoValue()).toBe('');
    expect(listSavingsLedgerDrafts()).toEqual([]);
  });
});
