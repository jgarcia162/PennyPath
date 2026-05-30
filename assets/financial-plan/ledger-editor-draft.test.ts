import { describe, it, expect, beforeEach } from 'vitest';
import {
  syncSavingsLedgerDraftFromRow,
  listSavingsLedgerDrafts,
  clearSavingsLedgerDraftStore,
  clearSavingsLedgerActivityInputs,
  restoreSavingsLedgerDrafts,
  syncDebtLedgerDraftFromRow,
  listDebtLedgerDrafts,
  clearDebtLedgerDraftStore,
  clearDebtLedgerActivityInputs,
  restoreDebtLedgerDrafts,
} from './ledger-editor-draft.js';

function mockInput(value = ''): HTMLInputElement {
  return { value } as HTMLInputElement;
}

function mockSavingsRow(id: string, fields: { deposit?: string; withdrawal?: string; withdrawalMemo?: string }) {
  const inputs: Record<string, HTMLInputElement> = {
    deposit: mockInput(fields.deposit ?? ''),
    withdrawal: mockInput(fields.withdrawal ?? ''),
    'withdrawal-memo': mockInput(fields.withdrawalMemo ?? ''),
  };
  return {
    getAttribute(name: string) {
      return name === 'data-savings-id' ? id : null;
    },
    querySelector(sel: string) {
      const m = sel.match(/data-field="([^"]+)"/);
      return m ? inputs[m[1]] ?? null : null;
    },
  } as unknown as Element;
}

function mockSavingsHost(rows: Array<{ id: string; fields: { deposit?: string; withdrawal?: string; withdrawalMemo?: string } }>) {
  const elements = rows.map(function (r) {
    const row = mockSavingsRow(r.id, r.fields);
    (row as any).className = 'savings-row';
    return row;
  });
  return {
    querySelectorAll(sel: string) {
      return sel === '.savings-row' ? elements : [];
    },
  } as unknown as HTMLElement;
}

function mockDebtRow(id: string, fields: { payment?: string; charge?: string; chargeMemo?: string }) {
  const inputs: Record<string, HTMLInputElement> = {
    payment: mockInput(fields.payment ?? ''),
    charge: mockInput(fields.charge ?? ''),
    'charge-memo': mockInput(fields.chargeMemo ?? ''),
  };
  return {
    getAttribute(name: string) {
      return name === 'data-debt-id' ? id : null;
    },
    querySelector(sel: string) {
      const m = sel.match(/data-field="([^"]+)"/);
      return m ? inputs[m[1]] ?? null : null;
    },
  } as unknown as Element;
}

function mockDebtHost(rows: Array<{ id: string; fields: { payment?: string; charge?: string; chargeMemo?: string } }>) {
  const elements = rows.map(function (r) {
    const row = mockDebtRow(r.id, r.fields);
    (row as any).className = 'debt-row';
    return row;
  });
  return {
    querySelectorAll(sel: string) {
      return sel === '.debt-row' ? elements : [];
    },
  } as unknown as HTMLElement;
}

describe('ledger-editor-draft savings', () => {
  beforeEach(() => {
    clearSavingsLedgerDraftStore();
  });

  it('syncs withdrawal memo into the draft store', () => {
    syncSavingsLedgerDraftFromRow(mockSavingsRow('s1', { withdrawal: '25.00', withdrawalMemo: 'ATM' }));
    expect(listSavingsLedgerDrafts()).toEqual([
      { savingsId: 's1', deposit: '', withdrawal: '25.00', withdrawalMemo: 'ATM' },
    ]);
  });

  it('clearSavingsLedgerDraftStore drops stored drafts', () => {
    syncSavingsLedgerDraftFromRow(mockSavingsRow('s1', { withdrawalMemo: 'Rent' }));
    clearSavingsLedgerDraftStore();
    expect(listSavingsLedgerDrafts()).toEqual([]);
  });

  it('clearSavingsLedgerActivityInputs clears DOM fields', () => {
    const host = mockSavingsHost([{ id: 's1', fields: { withdrawal: '40.00', withdrawalMemo: 'Transfer' } }]);
    clearSavingsLedgerActivityInputs(host);
    const row = host.querySelectorAll('.savings-row')[0] as Element;
    const memo = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement;
    const wd = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement;
    expect(memo.value).toBe('');
    expect(wd.value).toBe('');
  });

  it('does not restore memo after store clear (Add commit path)', () => {
    syncSavingsLedgerDraftFromRow(mockSavingsRow('s1', { withdrawalMemo: 'Should not return' }));
    clearSavingsLedgerDraftStore();

    const host = mockSavingsHost([{ id: 's1', fields: {} }]);
    restoreSavingsLedgerDrafts(host, listSavingsLedgerDrafts());
    const row = host.querySelectorAll('.savings-row')[0] as Element;
    const memo = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement;
    expect(memo.value).toBe('');
  });
});

describe('ledger-editor-draft debts', () => {
  beforeEach(() => {
    clearDebtLedgerDraftStore();
  });

  it('clearDebtLedgerActivityInputs clears charge memo', () => {
    const host = mockDebtHost([{ id: 'd1', fields: { charge: '15.00', chargeMemo: 'Fee' } }]);
    clearDebtLedgerActivityInputs(host);
    const row = host.querySelectorAll('.debt-row')[0] as Element;
    const memo = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement;
    expect(memo.value).toBe('');
  });

  it('does not restore charge memo after store clear', () => {
    syncDebtLedgerDraftFromRow(mockDebtRow('d1', { chargeMemo: 'Late fee' }));
    clearDebtLedgerDraftStore();

    const host = mockDebtHost([{ id: 'd1', fields: {} }]);
    restoreDebtLedgerDrafts(host, listDebtLedgerDrafts());
    const row = host.querySelectorAll('.debt-row')[0] as Element;
    const memo = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement;
    expect(memo.value).toBe('');
  });
});
