/**
 * Goal 2 per-debt UI + debts list inside the balance editor (DOM builders).
 */

import type { Debt, DerivedPlanMetrics, FinancialPlan, SavingsAccount, SavingsGoal } from '../../types/index.js';
import { DEFAULT_DEBT_APR_PCT, DEFAULT_SAVINGS_APY_PCT, PLAN } from './plan-data';
import {
  getDebtsEditorSegment,
  normalizeDebtsEditorSegment,
  partitionDebtsByLedger,
  type DebtsEditorSegment,
} from './debt-ledger';
import { partitionSavingsByLedger } from './savings-ledger';
import { ensureSavingsGoals, accountContributesToGoal } from './savings-goals';
import { numOr, formatCurrencyInput, formatMoneyInput } from './utils';
import { getEditingDebtCardId, getEditingSavingsCardId } from './card-inline-edit-state';
import {
  debtLedgerKind,
  formatDebtLedgerSummary,
  formatSavingsLedgerSummary,
  isSavingsDepositEntry,
  savingsLedgerKind,
} from './ledger-utils';
import { getSavingsAccounts } from './savings-accounts';
import {
  appendDebtLedgerCellToRow,
  appendDebtLedgerHeaderCell,
  buildDebtLedgerUnifiedCellHtml,
} from './debt-ledger-editor-cells';
import {
  appendSavingsLedgerCellToRow,
  appendSavingsLedgerHeaderCell,
  buildSavingsLedgerUnifiedCellHtml,
} from './savings-ledger-editor-cells';
import {
  clearDebtLedgerActivityInputs,
  clearDebtLedgerDraftStore,
  clearSavingsLedgerActivityInputs,
  clearSavingsLedgerDraftStore,
  listDebtLedgerDrafts,
  listSavingsLedgerDrafts,
  restoreDebtLedgerDrafts,
  restoreSavingsLedgerDrafts,
} from './ledger-editor-draft';
import { applyGoal2SaveButtonState, applyGoal3SaveButtonState } from './editor-ledger-save-guard';

type MoneyFn = (n: number) => string;

let debtCardOrderIds: string[] | null = null;
let debtEditorRowOrderIds: string[] | null = null;
let savingsCardOrderIds: string[] | null = null;
let savingsEditorRowOrderIds: string[] | null = null;

function orderByIdList<T extends { id: string }>(items: T[], ids: string[] | null): T[] {
  if (!ids || !ids.length) return items;
  const byId = new Map<string, T>();
  items.forEach(function (item) {
    byId.set(String(item.id), item);
  });
  const ordered: T[] = [];
  ids.forEach(function (id) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
      byId.delete(id);
    }
  });
  byId.forEach(function (row) {
    ordered.push(row);
  });
  return ordered;
}

function applyFrozenDebtCardOrder(debts: Debt[]): Debt[] {
  return orderByIdList(debts, debtCardOrderIds);
}

function applyFrozenDebtEditorRowOrder(debts: Debt[]): Debt[] {
  return orderByIdList(debts, debtEditorRowOrderIds);
}

function applyFrozenSavingsCardOrder(accounts: SavingsAccount[]): SavingsAccount[] {
  return orderByIdList(accounts, savingsCardOrderIds);
}

function applyFrozenSavingsEditorRowOrder(accounts: SavingsAccount[]): SavingsAccount[] {
  return orderByIdList(accounts, savingsEditorRowOrderIds);
}

/** Freeze dashboard card + editor row order while a goal editor dialog is open. */
export function freezeEditorOrders(plan: FinancialPlan): void {
  debtCardOrderIds = getDebtsInProgressOrderUnfrozen(plan).map(function (d) {
    return String(d.id);
  });
  debtEditorRowOrderIds = getDebtsInEditorOrderForSegmentUnfrozen(plan).map(function (d) {
    return String(d.id);
  });
  const accs = getSavingsAccounts(plan);
  savingsCardOrderIds = accs.map(function (a) {
    return String(a.id);
  });
  savingsEditorRowOrderIds = accs.map(function (a) {
    return String(a.id);
  });
}

export function clearEditorOrderFreeze(): void {
  debtCardOrderIds = null;
  debtEditorRowOrderIds = null;
  savingsCardOrderIds = null;
  savingsEditorRowOrderIds = null;
}

function closeAllSavingsGoalsDropdowns(except?: Element | null): void {
  document.querySelectorAll('.editor-savings-goals-dd.is-open').forEach(function (el) {
    if (except && el === except) return;
    el.classList.remove('is-open');
    const btn = el.querySelector('button.editor-savings-goals-dd__btn') as HTMLButtonElement | null;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

let savingsGoalsDdGlobalHandlersInstalled = false;
function ensureSavingsGoalsDdGlobalHandlers(): void {
  if (savingsGoalsDdGlobalHandlersInstalled) return;
  savingsGoalsDdGlobalHandlersInstalled = true;

  document.addEventListener('click', function (e) {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const dd = t.closest('.editor-savings-goals-dd');
    if (dd) return;
    closeAllSavingsGoalsDropdowns();
  });

  document.addEventListener('keydown', function (e) {
    if ((e as KeyboardEvent).key !== 'Escape') return;
    closeAllSavingsGoalsDropdowns();
  });
}

/** Normalize legacy sort keys for UI + sorting. */
export function normalizeDebtsEditorSort(mode: unknown): string {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return String(m);
}

export function normalizeDebtsProgressSort(mode: unknown): string {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return String(m);
}

function sortDebtListByMode(list: Debt[], mode: string): Debt[] {
  if (mode === 'saved') return list;
  if (mode === 'balance-desc' || mode === 'balance-asc') {
    const dir = mode === 'balance-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.current, 0) - numOr(b.current, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'apr-desc' || mode === 'apr-asc') {
    const dir = mode === 'apr-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff =
        (numOr(a.aprPct, DEFAULT_DEBT_APR_PCT) - numOr(b.aprPct, DEFAULT_DEBT_APR_PCT)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'paid-desc' || mode === 'paid-asc') {
    const dir = mode === 'paid-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.paidOff, 0) - numOr(b.paidOff, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  return list;
}

/**
 * Debts in Goal 2 editor row order (saved array order, or balance / APR).
 */
export function getDebtsInEditorOrder(plan: Pick<FinancialPlan, 'debts' | 'debtsEditorSort'>): Debt[] {
  const list = partitionDebtsByLedger(Array.isArray(plan.debts) ? (plan.debts as Debt[]) : []).active;
  const mode = normalizeDebtsEditorSort(plan.debtsEditorSort as unknown);
  return sortDebtListByMode(list, mode);
}

/** Debts shown in the editor for the current ledger segment (dialog tab). */
export function getDebtsInEditorOrderForSegmentUnfrozen(
  plan: Pick<FinancialPlan, 'debts' | 'debtsEditorSort' | 'debtsEditorLedgerSegment'>
): Debt[] {
  const segment = getDebtsEditorSegment(plan as FinancialPlan);
  const parts = partitionDebtsByLedger(Array.isArray(plan.debts) ? (plan.debts as Debt[]) : []);
  const bucket = segment === 'completed' ? parts.completed : parts.active;
  const mode = normalizeDebtsEditorSort(plan.debtsEditorSort as unknown);
  return sortDebtListByMode(bucket.slice(), mode);
}

/** Debts shown in the editor for the current ledger segment (dialog tab). */
export function getDebtsInEditorOrderForSegment(
  plan: Pick<FinancialPlan, 'debts' | 'debtsEditorSort' | 'debtsEditorLedgerSegment'>
): Debt[] {
  return applyFrozenDebtEditorRowOrder(getDebtsInEditorOrderForSegmentUnfrozen(plan));
}

/**
 * Order for Goal 2 per-debt progress cards (`#goal2-debts`).
 */
export function getDebtsInProgressOrderUnfrozen(
  plan: Pick<FinancialPlan, 'debts' | 'debtsProgressSort'>
): Debt[] {
  const list = partitionDebtsByLedger(Array.isArray(plan.debts) ? (plan.debts as Debt[]) : []).active;
  const mode = normalizeDebtsProgressSort(plan.debtsProgressSort as unknown);
  return sortDebtListByMode(list, mode);
}

export function getDebtsInProgressOrder(plan: Pick<FinancialPlan, 'debts' | 'debtsProgressSort'>): Debt[] {
  return applyFrozenDebtCardOrder(getDebtsInProgressOrderUnfrozen(plan));
}

function captureDebtCardActivityOpen(host: HTMLElement): Map<string, boolean> {
  const open = new Map<string, boolean>();
  host.querySelectorAll('.goal2-debt-payments').forEach(function (det) {
    const card = det.closest('.goal2-debt');
    const id = card ? card.getAttribute('data-debt-id') : null;
    if (id && (det as HTMLDetailsElement).open) open.set(String(id), true);
  });
  return open;
}

function captureSavingsCardActivityOpen(host: HTMLElement): Map<string, boolean> {
  const open = new Map<string, boolean>();
  host.querySelectorAll('.goal3-savings-deposits').forEach(function (det) {
    const card = det.closest('.goal3-savings-account');
    const id = card ? card.getAttribute('data-savings-id') : null;
    if (id && (det as HTMLDetailsElement).open) open.set(String(id), true);
  });
  return open;
}

function buildInlineEditActions(kind: 'debt' | 'savings'): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'card-inline-edit-actions no-print';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'card-inline-edit-cancel';
  cancel.setAttribute('data-action', 'inline-cancel-' + kind);
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'card-inline-edit-save';
  save.setAttribute('data-action', 'inline-save-' + kind);
  save.textContent = 'Save';
  wrap.appendChild(cancel);
  wrap.appendChild(save);
  return wrap;
}

function buildEditableDebtCard(debt: Debt): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'goal2-debt goal2-debt--editing';
  wrap.setAttribute('data-debt-id', String(debt.id || ''));

  const head = document.createElement('div');
  head.className = 'goal2-debt-head goal2-debt-head--editing';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'card-inline-edit-name';
  nameInput.setAttribute('data-field', 'name');
  nameInput.setAttribute('aria-label', 'Debt name');
  nameInput.autocomplete = 'off';
  nameInput.value = debt.name || '';

  const balanceInput = document.createElement('input');
  balanceInput.type = 'text';
  balanceInput.className = 'card-inline-edit-balance';
  balanceInput.setAttribute('data-field', 'current');
  balanceInput.setAttribute('data-money', 'currency');
  balanceInput.setAttribute('inputmode', 'decimal');
  balanceInput.setAttribute('aria-label', 'Current balance');
  balanceInput.autocomplete = 'off';
  balanceInput.placeholder = '$0.00';
  const cur = numOr(debt.current, 0);
  balanceInput.value = cur > 0 ? formatCurrencyInput(cur) : '';

  head.appendChild(nameInput);
  head.appendChild(balanceInput);

  const ledger = document.createElement('div');
  ledger.className = 'card-inline-edit-ledger';
  ledger.innerHTML = buildDebtLedgerUnifiedCellHtml();

  wrap.appendChild(head);
  wrap.appendChild(ledger);
  wrap.appendChild(buildInlineEditActions('debt'));
  return wrap;
}

export function renderGoal2Debts(plan: FinancialPlan, moneyExact: MoneyFn): void {
  const host = document.getElementById('goal2-debts') as HTMLElement | null;
  if (!host) return;
  const activityOpen = captureDebtCardActivityOpen(host);
  host.innerHTML = '';
  const debts = getDebtsInProgressOrder(plan);
  const editingDebtId = getEditingDebtCardId();
  debts.forEach(function (debt) {
    if (editingDebtId && String(debt.id || '') === editingDebtId) {
      host.appendChild(buildEditableDebtCard(debt));
      return;
    }
    const current = Number.isFinite(debt.current) ? debt.current : 0;
    const paid = Number.isFinite(debt.paidOff) ? debt.paidOff : 0;
    const start = Math.max(0, current + paid);
    const pct = start > 0 ? Math.min(100, (Math.max(0, paid) / start) * 100) : 0;

    const wrap = document.createElement('div');
    wrap.className = 'goal2-debt';
    wrap.setAttribute('data-debt-id', String(debt.id || ''));
    wrap.setAttribute('role', 'button');
    wrap.tabIndex = 0;

    const head = document.createElement('div');
    head.className = 'goal2-debt-head';
    const name = document.createElement('div');
    name.className = 'goal2-debt-name';
    name.textContent = debt.name || 'Debt';
    const meta = document.createElement('div');
    meta.className = 'goal2-debt-meta';
    meta.textContent = moneyExact(current) + ' remaining';
    head.appendChild(name);
    head.appendChild(meta);

    const labels = document.createElement('div');
    labels.className = 'progress-label-row debt';
    labels.innerHTML = '<span>' + moneyExact(paid) + ' paid</span><span><strong>' + pct.toFixed(1) + '%</strong></span>';

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill-debt';
    fill.style.width = pct.toFixed(2) + '%';
    track.appendChild(fill);

    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const history = Array.isArray(debt.paymentHistory) ? debt.paymentHistory : [];
    const recent = history.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff && ts <= now;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal2-debt-payments';
    const summary = document.createElement('summary');
    summary.className = 'goal2-debt-payments-summary';
    summary.textContent = 'Recent activity (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal2-debt-payments-empty';
      empty.textContent = 'No activity recorded in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal2-debt-payments-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        const kind = debtLedgerKind(p.kind);
        li.className =
          'goal2-debt-payment-row goal2-debt-ledger-row goal2-debt-ledger-row--' + kind;
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal2-debt-payment-meta';
        metaSpan.textContent = formatDebtLedgerSummary(p, moneyExact) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal2-remove-ledger-entry goal2-remove-payment no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-debt-id', String(debt.id));
        rm.setAttribute('data-ledger-id', String(p.id));
        rm.setAttribute('data-payment-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    if (activityOpen.get(String(debt.id || ''))) details.open = true;

    wrap.appendChild(head);
    wrap.appendChild(labels);
    wrap.appendChild(track);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}

export function appendDebtsEditorEmptyState(host: HTMLElement, segment?: DebtsEditorSegment): void {
  const seg = segment || 'active';
  const copy =
    seg === 'completed'
      ? {
          icon: '✓',
          title: 'No paid-off debts yet',
          text:
            'When an active debt reaches <strong>$0</strong> balance with payments on record, it moves here automatically.',
        }
      : {
          icon: '📊',
          title: 'No debts yet',
          text:
            'Add credit cards or loans to track balances, APR, promos, and payments. Use <strong>+ Add debt</strong> below to get started.',
        };
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">' +
    copy.icon +
    '</div>' +
    '<h3 class="editor-empty-state__title">' +
    copy.title +
    '</h3>' +
    '<p class="editor-empty-state__text">' +
    copy.text +
    '</p>';
  host.appendChild(wrap);
}

function buildLedgerInlineActionHtml(opts: {
  amountField: string;
  memoField?: string;
  action: string;
  amountPlaceholder: string;
  title: string;
  btnClass?: string;
  includeMemo?: boolean;
}): string {
  const btnClass = opts.btnClass || 'btn-icon';
  const wrapClass =
    'field-inline-action field-inline-action--ledger' +
    (opts.includeMemo ? '' : ' field-inline-action--ledger-no-memo');
  let html =
    '<div class="' +
    wrapClass +
    '">' +
    '<input type="text" data-field="' +
    opts.amountField +
    '" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="' +
    opts.amountPlaceholder +
    '">';
  if (opts.includeMemo && opts.memoField) {
    html +=
      '<input type="text" data-field="' +
      opts.memoField +
      '" class="ledger-memo" maxlength="120" autocomplete="off" placeholder="Note">';
  }
  html +=
    '<button type="button" class="' +
    btnClass +
    '" data-action="' +
    opts.action +
    '" title="' +
    opts.title +
    '" aria-label="' +
    opts.title +
    '">+</button>' +
    '</div>';
  return html;
}

/** Spreadsheet-style table: one header row, data rows are `<tr class="debt-row">`. */
export function buildDebtsEditorThead() {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.className = 'editor-table__head-row';
  const headers = [
    { t: 'Name', title: '' },
    { t: 'Balance', title: 'Current balance' },
    { t: 'APR %', title: 'Annual percentage rate' },
    { t: 'Def $', title: 'Deferred balance (0% promo)' },
    { t: 'Until', title: 'Deferred rate expires' },
  ];
  headers.forEach(function (h) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h.t;
    if (h.title) th.title = h.title;
    tr.appendChild(th);
  });
  appendDebtLedgerHeaderCell(tr);
  const thRm = document.createElement('th');
  thRm.scope = 'col';
  thRm.className = 'editor-table__th--action';
  thRm.setAttribute('aria-label', 'Remove');
  tr.appendChild(thRm);
  thead.appendChild(tr);
  return thead;
}

export function buildDebtRowTR(debt: Debt, segment: DebtsEditorSegment = 'active'): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'debt-row';
  row.setAttribute('data-debt-id', String(debt.id));

  function tdInput(className: string, inner: string): HTMLTableCellElement {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.innerHTML = inner;
    return td;
  }

  row.appendChild(
    tdInput(
      'editor-table__cell--name',
      '<input type="text" data-field="name" autocomplete="off" value="">'
    )
  );
  row.appendChild(
    tdInput(
      '',
      '<input type="text" data-field="current" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="">'
    )
  );
  row.appendChild(
    tdInput(
      '',
      '<input type="text" data-field="aprPct" data-money="rate" inputmode="decimal" autocomplete="off" placeholder="0.00" value="">'
    )
  );
  row.appendChild(
    tdInput(
      '',
      '<input type="text" data-field="deferredAmount" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="">'
    )
  );
  row.appendChild(
    tdInput('', '<input type="date" data-field="deferredExpiresOn" autocomplete="off" value="">')
  );
  appendDebtLedgerCellToRow(row);
  const rmTd = document.createElement('td');
  rmTd.className = 'editor-table__cell--actions editor-table__cell--debt-actions';
  if (segment === 'completed') {
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn-remove-debt';
    rm.setAttribute('data-action', 'remove');
    rm.textContent = 'To Deleted';
    rmTd.appendChild(rm);
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'btn-restore-debt';
    restore.setAttribute('data-action', 'restore-active');
    restore.textContent = 'Restore';
    rmTd.appendChild(restore);
  } else {
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn-remove-debt';
    rm.setAttribute('data-action', 'remove');
    rm.textContent = 'Remove';
    rmTd.appendChild(rm);
  }
  row.appendChild(rmTd);

  const nameInput = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  const curInput = row.querySelector('input[data-field="current"]') as HTMLInputElement | null;
  const aprInput = row.querySelector('input[data-field="aprPct"]') as HTMLInputElement | null;
  const defInput = row.querySelector('input[data-field="deferredAmount"]') as HTMLInputElement | null;
  const defDateInput = row.querySelector('input[data-field="deferredExpiresOn"]') as HTMLInputElement | null;
  if (nameInput) nameInput.value = debt.name || '';
  const cur = numOr(debt.current, 0);
  const apr = numOr(debt.aprPct, DEFAULT_DEBT_APR_PCT);
  const def = numOr(debt.deferredAmount, 0);
  if (curInput) curInput.value = cur > 0 ? formatCurrencyInput(cur) : '';
  if (aprInput) aprInput.value = apr > 0 ? formatMoneyInput(apr) : '';
  if (defInput) defInput.value = def > 0 ? formatCurrencyInput(def) : '';
  if (defDateInput) defDateInput.value = typeof debt.deferredExpiresOn === 'string' ? debt.deferredExpiresOn : '';

  return row;
}

type DebtsEditorFocusSnap = {
  debtId: string;
  field: string;
  selStart: number | null;
  selEnd: number | null;
};

function captureDebtsEditorFocus(host: HTMLElement): DebtsEditorFocusSnap | null {
  const ae = document.activeElement;
  if (!ae || !host.contains(ae)) return null;
  const row = (ae as HTMLElement).closest('.debt-row');
  if (!row) return null;
  const debtId = row.getAttribute('data-debt-id');
  if (!debtId) return null;
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
    const field = ae.getAttribute('data-field');
    if (!field) return null;
    return {
      debtId,
      field,
      selStart: ae.selectionStart,
      selEnd: ae.selectionEnd,
    };
  }
  return null;
}

function restoreDebtsEditorFocus(host: HTMLElement, snap: DebtsEditorFocusSnap): void {
  function run(): void {
    const idEsc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(snap.debtId) : snap.debtId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const fieldEsc =
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(snap.field) : snap.field.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const row = host.querySelector('[data-debt-id="' + idEsc + '"]');
    if (!row) return;
    const el = row.querySelector(
      'input[data-field="' + fieldEsc + '"],textarea[data-field="' + fieldEsc + '"]'
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    if (snap.selStart != null && snap.selEnd != null && typeof el.setSelectionRange === 'function') {
      try {
        el.setSelectionRange(snap.selStart, snap.selEnd);
      } catch {
        /* date/time inputs may reject arbitrary ranges */
      }
    }
  }
  queueMicrotask(function () {
    requestAnimationFrame(run);
  });
}

export function syncDebtsEditorLedgerTabs(plan: FinancialPlan): void {
  const seg = getDebtsEditorSegment(plan);
  document.querySelectorAll('[data-debts-segment]').forEach(function (el) {
    const btn = el as HTMLButtonElement;
    const v = btn.getAttribute('data-debts-segment');
    const selected = v === seg;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.classList.toggle('is-selected', selected);
  });
}

export type EditorRenderOptions = {
  preserveLedgerActivityDrafts?: boolean;
};

export function renderDebtsEditor(plan: FinancialPlan, editorOpts?: EditorRenderOptions): void {
  const host = document.getElementById('debts-editor-list') as HTMLElement | null;
  if (!host) return;
  const preserveDrafts = editorOpts?.preserveLedgerActivityDrafts !== false;
  const prevSegAttr = host.getAttribute('data-debts-segment');
  const segment = getDebtsEditorSegment(plan);
  const sameLedgerSegment =
    prevSegAttr == null ||
    prevSegAttr === '' ||
    normalizeDebtsEditorSegment(prevSegAttr) === segment;
  const focusSnap = sameLedgerSegment ? captureDebtsEditorFocus(host) : null;
  if (!preserveDrafts) clearDebtLedgerDraftStore();

  host.dataset.debtsSegment = segment;
  host.innerHTML = '';
  const debts = getDebtsInEditorOrderForSegment(plan);
  if (debts.length === 0) {
    appendDebtsEditorEmptyState(host, segment);
  } else {
    const table = document.createElement('table');
    table.className = 'editor-table editor-table--debts';
    table.setAttribute('role', 'grid');
    table.appendChild(buildDebtsEditorThead());
    const tbody = document.createElement('tbody');
    debts.forEach(function (debt) {
      tbody.appendChild(buildDebtRowTR(debt, segment));
    });
    table.appendChild(tbody);
    host.appendChild(table);
  }
  syncDebtsEditorLedgerTabs(plan);
  const addBtn = document.getElementById('btn-add-debt') as HTMLButtonElement | null;
  if (addBtn) addBtn.disabled = segment !== 'active';

  if (preserveDrafts) {
    restoreDebtLedgerDrafts(host, listDebtLedgerDrafts());
  } else {
    clearDebtLedgerActivityInputs(host);
  }
  if (focusSnap) restoreDebtsEditorFocus(host, focusSnap);
  applyGoal2SaveButtonState();
}

/** Dashboard: paid-off debts summary (`#dash-debts-completed-list`). */
export function renderDashboardDebtArchives(plan: FinancialPlan, moneyExact: MoneyFn): void {
  const parts = partitionDebtsByLedger(Array.isArray(plan.debts) ? (plan.debts as Debt[]) : []);
  const setCount = function (id: string, n: number): void {
    const el = document.getElementById(id);
    if (el) el.textContent = String(n);
  };
  setCount('dash-archive-completed-count', parts.completed.length);

  function fillCompletedList(hostId: string, list: Debt[]): void {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    list.forEach(function (debt: Debt) {
      const row = document.createElement('div');
      row.className = 'dash-debt-archive-row';
      const name = document.createElement('span');
      name.className = 'dash-debt-archive-name';
      name.textContent = debt.name || 'Debt';
      const meta = document.createElement('span');
      meta.className = 'dash-debt-archive-meta';
      const cur = Number.isFinite(debt.current) ? debt.current : 0;
      const paid = Number.isFinite(debt.paidOff) ? debt.paidOff : 0;
      meta.textContent = moneyExact(cur) + ' left · ' + moneyExact(paid) + ' paid';
      row.appendChild(name);
      row.appendChild(meta);
      host.appendChild(row);
    });
  }

  fillCompletedList('dash-debts-completed-list', parts.completed);
}

/** Unified trash: deleted debts + deleted savings (`#dash-deleted-items-list`). */
export function renderDashboardDeletedBin(plan: FinancialPlan, moneyExact: MoneyFn): void {
  const debtDel = partitionDebtsByLedger(Array.isArray(plan.debts) ? (plan.debts as Debt[]) : []).deleted;
  const savDel = partitionSavingsByLedger(
    Array.isArray((plan as any).savingsAccounts) ? ((plan as any).savingsAccounts as SavingsAccount[]) : []
  ).deleted;
  const n = debtDel.length + savDel.length;
  const countEl = document.getElementById('dash-deleted-items-count');
  if (countEl) countEl.textContent = String(n);

  const host = document.getElementById('dash-deleted-items-list');
  if (!host) return;
  host.innerHTML = '';
  if (n === 0) {
    const empty = document.createElement('p');
    empty.className = 'dash-deleted-items-empty';
    empty.textContent = 'Nothing deleted yet.';
    host.appendChild(empty);
    return;
  }

  debtDel.forEach(function (debt: Debt) {
    host.appendChild(buildTrashRowEl('debt', String(debt.id), debt.name || 'Debt', 'Debt', moneyExact, debt));
  });
  savDel.forEach(function (acc: SavingsAccount) {
    host.appendChild(buildTrashRowEl('savings', String(acc.id), acc.name || 'Account', 'Savings', moneyExact, acc));
  });
}

function buildTrashRowEl(
  kind: 'debt' | 'savings',
  id: string,
  title: string,
  kindLabel: string,
  moneyExact: MoneyFn,
  row: Debt | SavingsAccount
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'dash-deleted-item-row';

  const main = document.createElement('div');
  main.className = 'dash-deleted-item-main';
  const lab = document.createElement('span');
  lab.className = 'dash-deleted-item-kind';
  lab.textContent = kindLabel;
  const nm = document.createElement('span');
  nm.className = 'dash-deleted-item-name';
  nm.textContent = title;
  main.appendChild(lab);
  main.appendChild(nm);

  let metaStr = '';
  if (kind === 'debt') {
    const d = row as Debt;
    const cur = Number.isFinite(d.current) ? d.current : 0;
    const paid = Number.isFinite(d.paidOff) ? d.paidOff : 0;
    metaStr = moneyExact(cur) + ' left · ' + moneyExact(paid) + ' paid';
  } else {
    const a = row as SavingsAccount;
    metaStr = moneyExact(numOr(a.current, 0)) + ' balance';
  }
  const meta = document.createElement('span');
  meta.className = 'dash-deleted-item-meta';
  meta.textContent = metaStr;

  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'btn-restore-debt dash-deleted-item-restore';
  restore.setAttribute('data-action', 'restore-trash-item');
  restore.setAttribute('data-trash-kind', kind);
  restore.setAttribute('data-trash-id', id);
  restore.textContent = 'Restore';

  wrap.appendChild(main);
  wrap.appendChild(meta);
  wrap.appendChild(restore);
  return wrap;
}

export function syncDebtsEditorSortSelect(plan: Pick<FinancialPlan, 'debtsEditorSort'>): void {
  const sortSel = document.getElementById('debts-editor-sort') as HTMLSelectElement | null;
  if (!sortSel) return;
  const next = normalizeDebtsEditorSort(plan.debtsEditorSort as unknown);
  if (sortSel.value === next) return;
  sortSel.value = next;
}

export function syncDebtsProgressSortSelect(plan: Pick<FinancialPlan, 'debtsProgressSort'>): void {
  const sortSel = document.getElementById('debts-progress-sort') as HTMLSelectElement | null;
  if (!sortSel) return;
  const next = normalizeDebtsProgressSort(plan.debtsProgressSort as unknown);
  if (sortSel.value === next) return;
  sortSel.value = next;
}

export function appendSavingsEditorEmptyState(host: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state editor-empty-state--savings';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">🏦</div>' +
    '<h3 class="editor-empty-state__title">No savings accounts</h3>' +
    '<p class="editor-empty-state__text">Add joint or personal accounts to track balances, APY, and deposits toward your emergency fund. Use <strong>+ Add account</strong> below.</p>';
  host.appendChild(wrap);
}

export function buildSavingsEditorThead(): HTMLTableSectionElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.className = 'editor-table__head-row';
  const headers = [
    { t: 'Name', title: '' },
    { t: 'Balance', title: 'Current balance' },
    { t: 'APY %', title: 'Annual percentage yield' },
  ];
  headers.forEach(function (h) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h.t;
    if (h.title) th.title = h.title;
    tr.appendChild(th);
  });
  appendSavingsLedgerHeaderCell(tr);
  const thGoals = document.createElement('th');
  thGoals.scope = 'col';
  thGoals.textContent = 'Goals';
  thGoals.title = 'This balance can count toward one or more targets';
  tr.appendChild(thGoals);
  const thRm = document.createElement('th');
  thRm.scope = 'col';
  thRm.className = 'editor-table__th--action';
  thRm.setAttribute('aria-label', 'Remove');
  tr.appendChild(thRm);
  thead.appendChild(tr);
  return thead;
}

/**
 * @param {object} acc
 * @param {Array<{ id?: string, name?: string }>} savingsGoals
 * @returns {HTMLTableRowElement}
 */
export function buildSavingsRowTR(acc: SavingsAccount, savingsGoals: SavingsGoal[]): HTMLTableRowElement {
  ensureSavingsGoalsDdGlobalHandlers();
  const row = document.createElement('tr');
  row.className = 'savings-row';
  row.setAttribute('data-savings-id', String(acc.id));

  const tdName = document.createElement('td');
  tdName.className = 'editor-table__cell--name';
  tdName.innerHTML = '<input type="text" data-field="name" autocomplete="off" value="">';

  const tdCur = document.createElement('td');
  tdCur.innerHTML =
    '<input type="text" data-field="current" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="$0.00" value="">';

  const tdApy = document.createElement('td');
  tdApy.innerHTML =
    '<input type="text" data-field="apyPct" data-money="rate" inputmode="decimal" autocomplete="off" placeholder="0.00" value="">';

  const tdGoal = document.createElement('td');
  tdGoal.className = 'editor-table__cell--goals';
  const goals = Array.isArray(savingsGoals) ? savingsGoals : [];
  if (goals.length === 0) {
    tdGoal.textContent = '—';
  } else {
    const dd = document.createElement('div');
    dd.className = 'editor-savings-goals-dd';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'editor-savings-goals-dd__btn';
    btn.setAttribute('data-action', 'toggle-goals');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'editor-savings-goals-dd__menu';
    menu.setAttribute('role', 'menu');

    function selectedGoalLabels(): string[] {
      const labels: string[] = [];
      goals.forEach(function (g) {
        const gid = String(g && g.id ? g.id : '');
        if (!gid) return;
        if (accountContributesToGoal(acc, gid)) labels.push(String(g.name || gid));
      });
      return labels;
    }

    function syncButtonLabel(): void {
      const picked: string[] = [];
      dd.querySelectorAll('input[data-field="goalId"]:checked').forEach(function (el) {
        const rowEl = el as HTMLInputElement;
        const label = rowEl.getAttribute('data-goal-name');
        if (label) picked.push(String(label));
      });
      if (picked.length === 0) {
        btn.textContent = 'Goals';
      } else if (picked.length <= 2) {
        btn.textContent = picked.join(', ');
      } else {
        btn.textContent = picked.length + ' goals';
      }
    }

    goals.forEach(function (g) {
      const gid = String(g && g.id ? g.id : '');
      if (!gid) return;
      const label = document.createElement('label');
      label.className = 'editor-savings-goals-dd__item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-field', 'goalId');
      cb.setAttribute('data-goal-id', gid);
      cb.setAttribute('data-goal-name', String(g.name || gid));
      cb.setAttribute('aria-label', 'Count toward ' + String(g.name || gid));
      cb.checked = accountContributesToGoal(acc, gid);
      const span = document.createElement('span');
      span.className = 'editor-savings-goals-dd__item-text';
      span.textContent = String(g.name || gid);
      label.appendChild(cb);
      label.appendChild(span);
      menu.appendChild(label);
    });

    btn.textContent = selectedGoalLabels().length ? selectedGoalLabels().slice(0, 2).join(', ') : 'Goals';
    syncButtonLabel();

    function close(): void {
      dd.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle(): void {
      const willOpen = !dd.classList.contains('is-open');
      closeAllSavingsGoalsDropdowns(dd);
      if (willOpen) {
        dd.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        close();
      }
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
    menu.addEventListener('change', function () {
      syncButtonLabel();
    });

    dd.appendChild(btn);
    dd.appendChild(menu);
    tdGoal.appendChild(dd);
  }

  const rmTd = document.createElement('td');
  rmTd.className = 'editor-table__cell--actions';
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'btn-remove-savings';
  rm.setAttribute('data-action', 'remove');
  rm.textContent = 'Remove';
  rmTd.appendChild(rm);

  row.appendChild(tdName);
  row.appendChild(tdCur);
  row.appendChild(tdApy);
  appendSavingsLedgerCellToRow(row);
  row.appendChild(tdGoal);
  row.appendChild(rmTd);

  const nameInput = row.querySelector('input[data-field="name"]') as HTMLInputElement | null;
  const curInput = row.querySelector('input[data-field="current"]') as HTMLInputElement | null;
  const apyInput = row.querySelector('input[data-field="apyPct"]') as HTMLInputElement | null;
  if (nameInput) nameInput.value = acc.name || '';
  const cur = numOr(acc.current, 0);
  const apy = numOr(acc.apyPct, DEFAULT_SAVINGS_APY_PCT);
  if (curInput) curInput.value = cur !== 0 ? formatCurrencyInput(cur) : '';
  if (apyInput) apyInput.value = apy > 0 ? formatMoneyInput(apy) : '';

  return row;
}

export function renderSavingsEditor(
  d: Pick<DerivedPlanMetrics, 'savingsAccounts'>,
  editorOpts?: EditorRenderOptions
): void {
  const host = document.getElementById('savings-editor-list') as HTMLElement | null;
  if (!host) return;
  const preserveDrafts = editorOpts?.preserveLedgerActivityDrafts !== false;
  if (!preserveDrafts) clearSavingsLedgerDraftStore();
  host.innerHTML = '';
  let accs: SavingsAccount[] = applyFrozenSavingsEditorRowOrder(
    (d.savingsAccounts || []) as SavingsAccount[]
  );
  ensureSavingsGoals(PLAN);
  const savingsGoals: SavingsGoal[] = ((PLAN as any).savingsGoals || []) as SavingsGoal[];
  if (accs.length === 0) {
    appendSavingsEditorEmptyState(host);
    applyGoal3SaveButtonState();
    return;
  }
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--savings';
  table.setAttribute('role', 'grid');
  table.appendChild(buildSavingsEditorThead());
  const tbody = document.createElement('tbody');
  accs.forEach(function (acc) {
    tbody.appendChild(buildSavingsRowTR(acc, savingsGoals));
  });
  table.appendChild(tbody);
  host.appendChild(table);
  if (preserveDrafts) {
    restoreSavingsLedgerDrafts(host, listSavingsLedgerDrafts());
  } else {
    clearSavingsLedgerActivityInputs(host);
  }
  applyGoal3SaveButtonState();
}

function buildEditableSavingsCard(acc: SavingsAccount): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'goal3-savings-account goal3-savings-account--editing';
  wrap.setAttribute('data-savings-id', String(acc.id || ''));

  const head = document.createElement('div');
  head.className = 'goal3-savings-head goal3-savings-head--editing';

  const titleRow = document.createElement('div');
  titleRow.className = 'goal3-savings-title-row goal3-savings-title-row--editing';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'card-inline-edit-name';
  nameInput.setAttribute('data-field', 'name');
  nameInput.setAttribute('aria-label', 'Account name');
  nameInput.autocomplete = 'off';
  nameInput.value = acc.name || '';

  const balanceInput = document.createElement('input');
  balanceInput.type = 'text';
  balanceInput.className = 'card-inline-edit-balance';
  balanceInput.setAttribute('data-field', 'current');
  balanceInput.setAttribute('data-money', 'currency');
  balanceInput.setAttribute('inputmode', 'decimal');
  balanceInput.setAttribute('aria-label', 'Balance');
  balanceInput.autocomplete = 'off';
  balanceInput.placeholder = '$0.00';
  const cur = numOr(acc.current, 0);
  balanceInput.value = cur !== 0 ? formatCurrencyInput(cur) : '';

  titleRow.appendChild(nameInput);
  titleRow.appendChild(balanceInput);

  const apyRow = document.createElement('label');
  apyRow.className = 'card-inline-edit-apy-row';
  const apyLabel = document.createElement('span');
  apyLabel.className = 'card-inline-edit-apy-label';
  apyLabel.textContent = 'APY %';
  const apyInput = document.createElement('input');
  apyInput.type = 'text';
  apyInput.className = 'card-inline-edit-apy';
  apyInput.setAttribute('data-field', 'apyPct');
  apyInput.setAttribute('data-money', 'rate');
  apyInput.setAttribute('inputmode', 'decimal');
  apyInput.setAttribute('aria-label', 'Annual percentage yield');
  apyInput.autocomplete = 'off';
  apyInput.placeholder = '0.00';
  const apy = numOr(acc.apyPct, 0);
  apyInput.value = apy > 0 ? formatMoneyInput(apy) : '';
  apyRow.appendChild(apyLabel);
  apyRow.appendChild(apyInput);

  head.appendChild(titleRow);
  head.appendChild(apyRow);

  const ledger = document.createElement('div');
  ledger.className = 'card-inline-edit-ledger';
  ledger.innerHTML = buildSavingsLedgerUnifiedCellHtml();

  wrap.appendChild(head);
  wrap.appendChild(ledger);
  wrap.appendChild(buildInlineEditActions('savings'));
  return wrap;
}

export function renderGoal3SavingsAccounts(
  d: Pick<DerivedPlanMetrics, 'savingsAccounts' | 'savingsGoalSummaries'>,
  moneyExact: MoneyFn
): void {
  const host = document.getElementById('goal3-savings') as HTMLElement | null;
  if (!host) return;
  const activityOpen = captureSavingsCardActivityOpen(host);
  host.innerHTML = '';
  const accs: SavingsAccount[] = applyFrozenSavingsCardOrder((d.savingsAccounts || []) as SavingsAccount[]);
  const editingSavingsId = getEditingSavingsCardId();
  accs.forEach(function (acc) {
    if (editingSavingsId && String(acc.id || '') === editingSavingsId) {
      host.appendChild(buildEditableSavingsCard(acc));
      return;
    }
    const current = numOr(acc.current, 0);
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    const lifetimeDep = hist.reduce(function (s, p) {
      if (!isSavingsDepositEntry(p)) return s;
      return s + numOr(p.amount, 0);
    }, 0);

    const wrap = document.createElement('div');
    wrap.className = 'goal3-savings-account';
    wrap.setAttribute('data-savings-id', String(acc.id || ''));
    wrap.setAttribute('role', 'button');
    wrap.tabIndex = 0;

    const head = document.createElement('div');
    head.className = 'goal3-savings-head';
    const titleRow = document.createElement('div');
    titleRow.className = 'goal3-savings-title-row';
    const name = document.createElement('div');
    name.className = 'goal3-savings-name';
    name.textContent = acc.name || 'Account';
    const balanceEl = document.createElement('div');
    balanceEl.className = 'goal3-savings-balance';
    balanceEl.textContent = moneyExact(current);
    titleRow.appendChild(name);
    titleRow.appendChild(balanceEl);
    const meta = document.createElement('div');
    meta.className = 'goal3-savings-meta';
    const apy = numOr(acc.apyPct, 0);
    meta.textContent =
      apy.toFixed(2) +
      '% APY · ' +
      moneyExact(lifetimeDep) +
      ' logged deposits (lifetime)';
    head.appendChild(titleRow);
    head.appendChild(meta);

    const goalWrap = document.createElement('div');
    goalWrap.className = 'goal3-savings-goals';
    const summaries = (d.savingsGoalSummaries || []) as any[];
    const assigned = summaries.filter(function (sg) {
      return accountContributesToGoal(acc, sg.id);
    });
    const anyGoal = assigned.length > 0;
    assigned.forEach(function (sg) {
      const goalAmt = numOr(sg.targetAmount, 0);
      const towardAllAccounts = numOr(sg.sum, 0);
      const pctTowardGoal = numOr(sg.pct, 0);
      const sub = document.createElement('div');
      sub.className = 'goal3-savings-goal-line';
      const cap = document.createElement('div');
      cap.className = 'goal3-savings-goal-caption';
      cap.textContent = String(sg.name || 'Goal');
      const prog = document.createElement('div');
      prog.className = 'goal3-savings-progress goal3-savings-progress--nested';
      const labels = document.createElement('div');
      labels.className = 'progress-label-row';
      const labelLeft =
        goalAmt > 0
          ? moneyExact(towardAllAccounts) + ' of ' + moneyExact(goalAmt)
          : moneyExact(current) + ' balance';
      const labelRight =
        goalAmt > 0
          ? '<strong>' + pctTowardGoal.toFixed(1) + '%</strong> of target'
          : '<strong>—</strong> set target in goal list';
      labels.innerHTML = '<span>' + labelLeft + '</span><span>' + labelRight + '</span>';
      const track = document.createElement('div');
      track.className = 'progress-track';
      const fill = document.createElement('div');
      fill.className = 'progress-fill-purple';
      fill.style.width = goalAmt > 0 ? pctTowardGoal.toFixed(2) + '%' : '0%';
      track.appendChild(fill);
      prog.appendChild(labels);
      prog.appendChild(track);
      sub.appendChild(cap);
      if (sg.goalByWhen) {
        const when = document.createElement('div');
        when.className = 'goal3-savings-goal-when';
        when.textContent = String(sg.goalByWhen);
        sub.appendChild(when);
      }
      sub.appendChild(prog);
      goalWrap.appendChild(sub);
    });
    if (!anyGoal) {
      const none = document.createElement('div');
      none.className = 'goal3-savings-not-goal';
      none.textContent = 'Not assigned to any savings goal — use the multi-select in the savings editor.';
      goalWrap.appendChild(none);
    }

    const goalsDetails = document.createElement('details');
    goalsDetails.className = 'goal3-savings-goals-details';
    const goalsSummary = document.createElement('summary');
    goalsSummary.className = 'goal3-savings-goals-summary';
    const chev = document.createElement('span');
    chev.className = 'goal3-savings-goals-chevron';
    chev.setAttribute('aria-hidden', 'true');
    const sumTitle = document.createElement('span');
    sumTitle.className = 'goal3-savings-goals-summary-title';
    sumTitle.textContent = 'Savings goal progress';
    const sumMeta = document.createElement('span');
    sumMeta.className = 'goal3-savings-goals-summary-meta';
    sumMeta.textContent = anyGoal
      ? assigned.length + (assigned.length === 1 ? ' goal' : ' goals')
      : 'None linked';
    goalsSummary.appendChild(chev);
    goalsSummary.appendChild(sumTitle);
    goalsSummary.appendChild(sumMeta);
    const goalsAnim = document.createElement('div');
    goalsAnim.className = 'goal3-savings-goals-anim';
    goalsAnim.appendChild(goalWrap);
    goalsDetails.appendChild(goalsSummary);
    goalsDetails.appendChild(goalsAnim);

    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const recent = hist.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff && ts <= now;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal3-savings-deposits';
    const summary = document.createElement('summary');
    summary.className = 'goal3-savings-deposits-summary';
    summary.textContent = 'Recent activity (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal3-savings-deposits-empty';
      empty.textContent = 'No activity logged in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal3-savings-deposits-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        const kind = savingsLedgerKind(p.kind);
        li.className =
          'goal3-savings-deposit-row goal3-savings-ledger-row goal3-savings-ledger-row--' + kind;
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal3-savings-deposit-meta';
        metaSpan.textContent = formatSavingsLedgerSummary(p, moneyExact) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal3-remove-ledger-entry goal3-remove-deposit no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-savings-id', String(acc.id));
        rm.setAttribute('data-ledger-id', String(p.id));
        rm.setAttribute('data-deposit-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    if (activityOpen.get(String(acc.id || ''))) details.open = true;

    wrap.appendChild(head);
    wrap.appendChild(goalsDetails);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}

/**
 * Renders stacked progress cards for each savings goal (plan tab + dashboard).
 * @param {string} hostId
 * @param {object} d — result of `derived(PLAN)`
 * @param {(n: number) => string} money
 * @param {(n: number) => string} moneyExact
 * @param {{ hasData?: boolean }} [opts]
 */
export function renderSavingsGoalsStack(
  hostId: string,
  d: Pick<DerivedPlanMetrics, 'savingsGoalSummaries'>,
  money: MoneyFn,
  moneyExact: MoneyFn,
  opts?: { hasData?: boolean }
): void {
  const host = document.getElementById(hostId) as HTMLElement | null;
  if (!host) return;
  const hasData = opts && opts.hasData;
  const sums = (d.savingsGoalSummaries || []) as any[];
  host.innerHTML = '';
  if (sums.length === 0) {
    const p = document.createElement('p');
    p.className = 'savings-goals-stack__empty';
    p.textContent = 'Add savings targets in “Edit goal targets” above.';
    host.appendChild(p);
    return;
  }
  sums.forEach(function (sg) {
    const block = document.createElement('div');
    block.className = 'savings-goal-block';
    const title = document.createElement('div');
    title.className = 'savings-goal-block__title';
    title.textContent = String(sg.name || 'Goal');
    block.appendChild(title);
    if (sg.goalByWhen) {
      const when = document.createElement('div');
      when.className = 'savings-goal-block__when';
      when.textContent = String(sg.goalByWhen);
      block.appendChild(when);
    }

    const grid = document.createElement('div');
    grid.className = 'efund-grid savings-goal-block__grid';
    function cell(label: string, val: string, note: string): HTMLDivElement {
      const it = document.createElement('div');
      it.className = 'efund-item';
      const l = document.createElement('div');
      l.className = 'efund-item-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'efund-item-val';
      v.textContent = val;
      const n = document.createElement('div');
      n.className = 'efund-item-note';
      n.textContent = note;
      it.appendChild(l);
      it.appendChild(v);
      it.appendChild(n);
      return it;
    }
    grid.appendChild(
      cell(
        'Target',
        money(sg.targetAmount),
        String(sg.id) === 'goal-efund' ? 'Often 12 × monthly expenses — editable below' : 'Goal amount'
      )
    );
    grid.appendChild(cell('Assigned balances', moneyExact(sg.sum), 'Full balance of each linked account'));
    grid.appendChild(cell('Gap', moneyExact(sg.gap), 'Still needed'));
    block.appendChild(grid);

    const prog = document.createElement('div');
    prog.className = 'progress-wrap';
    const row = document.createElement('div');
    row.className = 'progress-label-row';
    if (hasData && sg.targetAmount > 0) {
      row.innerHTML =
        '<span>' +
        moneyExact(sg.sum) +
        ' toward target</span><span><strong>' +
        sg.pct.toFixed(1) +
        '%</strong> complete</span>';
    } else if (!hasData) {
      row.innerHTML =
        '<span>$0</span><span><strong>—</strong> add accounts in Goal 3</span>';
    } else {
      row.innerHTML =
        '<span>' + moneyExact(sg.sum) + '</span><span>Set a target above $0 to track %</span>';
    }
    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill-purple';
    fill.style.width =
      hasData && sg.targetAmount > 0 ? Math.min(100, sg.pct).toFixed(2) + '%' : '0%';
    track.appendChild(fill);
    prog.appendChild(row);
    prog.appendChild(track);
    block.appendChild(prog);
    host.appendChild(block);
  });
}
