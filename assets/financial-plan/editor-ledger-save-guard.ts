/**
 * Disable Save and Add when both ledger amount fields in a row have input.
 */

import { parseMoneyInput } from './utils';

function ledgerAmountInputHasValue(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLInputElement)) return false;
  return String(el.value || '').trim() !== '';
}

export function debtRowHasConflictingLedgerInputs(row: Element): boolean {
  const pay = row.querySelector('input[data-field="payment"]');
  const charge = row.querySelector('input[data-field="charge"]');
  return ledgerAmountInputHasValue(pay) && ledgerAmountInputHasValue(charge);
}

export function savingsRowHasConflictingLedgerInputs(row: Element): boolean {
  const dep = row.querySelector('input[data-field="deposit"]');
  const wd = row.querySelector('input[data-field="withdrawal"]');
  return ledgerAmountInputHasValue(dep) && ledgerAmountInputHasValue(wd);
}

export function debtsEditorHasConflictingLedgerInputs(): boolean {
  const host = document.getElementById('debts-editor-list');
  if (!host) return false;
  let conflict = false;
  host.querySelectorAll('.debt-row').forEach(function (row) {
    if (debtRowHasConflictingLedgerInputs(row)) conflict = true;
  });
  return conflict;
}

export function savingsEditorHasConflictingLedgerInputs(): boolean {
  const host = document.getElementById('savings-editor-list');
  if (!host) return false;
  let conflict = false;
  host.querySelectorAll('.savings-row').forEach(function (row) {
    if (savingsRowHasConflictingLedgerInputs(row)) conflict = true;
  });
  return conflict;
}

/** Row has two positive parsed amounts (stricter check before committing). */
export function debtRowHasDualLedgerAmounts(row: Element): boolean {
  const pay = row.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const charge = row.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const p = pay ? parseMoneyInput(pay.value) : null;
  const c = charge ? parseMoneyInput(charge.value) : null;
  return p !== null && p > 0 && c !== null && c > 0;
}

export function savingsRowHasDualLedgerAmounts(row: Element): boolean {
  const dep = row.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const wd = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const d = dep ? parseMoneyInput(dep.value) : null;
  const w = wd ? parseMoneyInput(wd.value) : null;
  return d !== null && d > 0 && w !== null && w > 0;
}

const CONFLICT_TITLE =
  'Enter only one amount (payment or charge, or deposit or withdrawal), then use Add.';

function setAddButtonsDisabled(
  host: HTMLElement | null,
  rowSelector: string,
  addSelector: string,
  rowConflictFn: (row: Element) => boolean
): void {
  if (!host) return;
  host.querySelectorAll(addSelector).forEach(function (btn) {
    const el = btn as HTMLButtonElement;
    const row = el.closest(rowSelector);
    el.disabled = row ? rowConflictFn(row) : false;
    if (el.disabled) el.title = CONFLICT_TITLE;
    else el.removeAttribute('title');
  });
}

export function applyGoal2SaveButtonState(): void {
  const saveBtn = document.getElementById('btn-save-goal2-debts') as HTMLButtonElement | null;
  if (!saveBtn) return;
  const needsSave = saveBtn.dataset.needsSave === '1';
  const saving = saveBtn.dataset.saving === '1';
  const conflict = debtsEditorHasConflictingLedgerInputs();
  saveBtn.disabled = saving || !needsSave || conflict;
  if (conflict) saveBtn.title = CONFLICT_TITLE;
  else saveBtn.removeAttribute('title');

  setAddButtonsDisabled(
    document.getElementById('debts-editor-list'),
    '.debt-row',
    '.btn-quick-ledger-entry',
    debtRowHasConflictingLedgerInputs
  );
  setAddButtonsDisabled(
    document.getElementById('goal2-debts'),
    '.goal2-debt--editing',
    '.btn-quick-ledger-entry',
    debtRowHasConflictingLedgerInputs
  );
}

export function applyGoal3SaveButtonState(): void {
  const saveBtn = document.getElementById('btn-save-goal3-savings') as HTMLButtonElement | null;
  if (!saveBtn) return;
  const needsSave = saveBtn.dataset.needsSave === '1';
  const saving = saveBtn.dataset.saving === '1';
  const conflict = savingsEditorHasConflictingLedgerInputs();
  saveBtn.disabled = saving || !needsSave || conflict;
  if (conflict) saveBtn.title = CONFLICT_TITLE;
  else saveBtn.removeAttribute('title');

  setAddButtonsDisabled(
    document.getElementById('savings-editor-list'),
    '.savings-row',
    '.btn-quick-savings-ledger-entry',
    savingsRowHasConflictingLedgerInputs
  );
  setAddButtonsDisabled(
    document.getElementById('goal3-savings'),
    '.goal3-savings-account--editing',
    '.btn-quick-savings-ledger-entry',
    savingsRowHasConflictingLedgerInputs
  );
}

export function findDebtRowWithDualLedgerAmounts(): Element | null {
  const host = document.getElementById('debts-editor-list');
  if (!host) return null;
  let found: Element | null = null;
  host.querySelectorAll('.debt-row').forEach(function (row) {
    if (!found && debtRowHasDualLedgerAmounts(row)) found = row;
  });
  return found;
}

export function findSavingsRowWithDualLedgerAmounts(): Element | null {
  const host = document.getElementById('savings-editor-list');
  if (!host) return null;
  let found: Element | null = null;
  host.querySelectorAll('.savings-row').forEach(function (row) {
    if (!found && savingsRowHasDualLedgerAmounts(row)) found = row;
  });
  return found;
}
