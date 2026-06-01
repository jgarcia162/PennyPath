/**
 * Preserve in-progress Activity column inputs when editor tables are re-rendered.
 */

export type DebtLedgerDraft = {
  debtId: string;
  payment: string;
  charge: string;
  chargeMemo: string;
};

export type SavingsLedgerDraft = {
  savingsId: string;
  deposit: string;
  withdrawal: string;
  withdrawalMemo: string;
};

function captureDebtLedgerDraftsFromRoot(row: Element, drafts: DebtLedgerDraft[]): void {
  const debtId = row.getAttribute('data-debt-id');
  if (!debtId) return;
  const pay = row.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const charge = row.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement | null;
  drafts.push({
    debtId: String(debtId),
    payment: pay ? String(pay.value || '') : '',
    charge: charge ? String(charge.value || '') : '',
    chargeMemo: memo ? String(memo.value || '') : '',
  });
}

export function captureDebtLedgerDrafts(host: HTMLElement): DebtLedgerDraft[] {
  const drafts: DebtLedgerDraft[] = [];
  host.querySelectorAll('.debt-row').forEach(function (row) {
    captureDebtLedgerDraftsFromRoot(row, drafts);
  });
  host.querySelectorAll('.goal2-debt--editing').forEach(function (row) {
    captureDebtLedgerDraftsFromRoot(row, drafts);
  });
  return drafts;
}

function restoreDebtLedgerDraftsToRoot(row: Element, byId: Map<string, DebtLedgerDraft>): void {
  const id = row.getAttribute('data-debt-id');
  if (!id) return;
  const snap = byId.get(String(id));
  if (!snap) return;
  const pay = row.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const charge = row.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement | null;
  if (pay) pay.value = snap.payment;
  if (charge) charge.value = snap.charge;
  if (memo) memo.value = snap.chargeMemo;
}

export function restoreDebtLedgerDrafts(host: HTMLElement, drafts: DebtLedgerDraft[]): void {
  if (!drafts.length) return;
  const byId = new Map<string, DebtLedgerDraft>();
  drafts.forEach(function (d) {
    byId.set(d.debtId, d);
  });
  host.querySelectorAll('.debt-row').forEach(function (row) {
    restoreDebtLedgerDraftsToRoot(row, byId);
  });
  host.querySelectorAll('.goal2-debt--editing').forEach(function (row) {
    restoreDebtLedgerDraftsToRoot(row, byId);
  });
}

function captureSavingsLedgerDraftsFromRoot(row: Element, drafts: SavingsLedgerDraft[]): void {
  const savingsId = row.getAttribute('data-savings-id');
  if (!savingsId) return;
  const dep = row.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const wd = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement | null;
  drafts.push({
    savingsId: String(savingsId),
    deposit: dep ? String(dep.value || '') : '',
    withdrawal: wd ? String(wd.value || '') : '',
    withdrawalMemo: memo ? String(memo.value || '') : '',
  });
}

export function captureSavingsLedgerDrafts(host: HTMLElement): SavingsLedgerDraft[] {
  const drafts: SavingsLedgerDraft[] = [];
  host.querySelectorAll('.savings-row').forEach(function (row) {
    captureSavingsLedgerDraftsFromRoot(row, drafts);
  });
  host.querySelectorAll('.goal3-savings-account--editing').forEach(function (row) {
    captureSavingsLedgerDraftsFromRoot(row, drafts);
  });
  return drafts;
}

function restoreSavingsLedgerDraftsToRoot(row: Element, byId: Map<string, SavingsLedgerDraft>): void {
  const id = row.getAttribute('data-savings-id');
  if (!id) return;
  const snap = byId.get(String(id));
  if (!snap) return;
  const dep = row.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const wd = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement | null;
  if (dep) dep.value = snap.deposit;
  if (wd) wd.value = snap.withdrawal;
  if (memo) memo.value = snap.withdrawalMemo;
}

export function restoreSavingsLedgerDrafts(host: HTMLElement, drafts: SavingsLedgerDraft[]): void {
  if (!drafts.length) return;
  const byId = new Map<string, SavingsLedgerDraft>();
  drafts.forEach(function (d) {
    byId.set(d.savingsId, d);
  });
  host.querySelectorAll('.savings-row').forEach(function (row) {
    restoreSavingsLedgerDraftsToRoot(row, byId);
  });
  host.querySelectorAll('.goal3-savings-account--editing').forEach(function (row) {
    restoreSavingsLedgerDraftsToRoot(row, byId);
  });
}

const _debtStore = new Map<string, DebtLedgerDraft>();
const _savingsStore = new Map<string, SavingsLedgerDraft>();

export function syncDebtLedgerDraftFromRow(row: Element): void {
  const debtId = row.getAttribute('data-debt-id');
  if (!debtId) return;
  const pay = row.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const charge = row.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="charge-memo"]') as HTMLInputElement | null;
  _debtStore.set(debtId, {
    debtId,
    payment: pay ? pay.value : '',
    charge: charge ? charge.value : '',
    chargeMemo: memo ? memo.value : '',
  });
}

export function listDebtLedgerDrafts(): DebtLedgerDraft[] {
  return Array.from(_debtStore.values());
}

export function clearDebtLedgerDraftStore(): void {
  _debtStore.clear();
}

function clearDebtLedgerInputsInRoot(root: Element): void {
  const pay = root.querySelector('input[data-field="payment"]') as HTMLInputElement | null;
  const charge = root.querySelector('input[data-field="charge"]') as HTMLInputElement | null;
  const memo = root.querySelector('input[data-field="charge-memo"]') as HTMLInputElement | null;
  if (pay) pay.value = '';
  if (charge) charge.value = '';
  if (memo) memo.value = '';
}

export function clearDebtLedgerActivityInputs(host: HTMLElement): void {
  host.querySelectorAll('.debt-row').forEach(clearDebtLedgerInputsInRoot);
  host.querySelectorAll('.goal2-debt--editing').forEach(clearDebtLedgerInputsInRoot);
}

export function syncSavingsLedgerDraftFromRow(row: Element): void {
  const savingsId = row.getAttribute('data-savings-id');
  if (!savingsId) return;
  const dep = row.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const wd = row.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const memo = row.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement | null;
  _savingsStore.set(savingsId, {
    savingsId,
    deposit: dep ? dep.value : '',
    withdrawal: wd ? wd.value : '',
    withdrawalMemo: memo ? memo.value : '',
  });
}

export function listSavingsLedgerDrafts(): SavingsLedgerDraft[] {
  return Array.from(_savingsStore.values());
}

export function clearSavingsLedgerDraftStore(): void {
  _savingsStore.clear();
}

function clearSavingsLedgerInputsInRoot(root: Element): void {
  const dep = root.querySelector('input[data-field="deposit"]') as HTMLInputElement | null;
  const wd = root.querySelector('input[data-field="withdrawal"]') as HTMLInputElement | null;
  const memo = root.querySelector('input[data-field="withdrawal-memo"]') as HTMLInputElement | null;
  if (dep) dep.value = '';
  if (wd) wd.value = '';
  if (memo) memo.value = '';
}

export function clearSavingsLedgerActivityInputs(host: HTMLElement): void {
  host.querySelectorAll('.savings-row').forEach(clearSavingsLedgerInputsInRoot);
  host.querySelectorAll('.goal3-savings-account--editing').forEach(clearSavingsLedgerInputsInRoot);
}
