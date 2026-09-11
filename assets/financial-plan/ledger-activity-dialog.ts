/**
 * “See all” ledger activity dialog for dashboard debt/savings cards.
 *
 * DOM ids (also declared in dashboard + static HTML; created here if missing):
 * `#ledger-activity-dialog`, `#ledger-activity-dialog-title`,
 * `#ledger-activity-dialog-subtitle`, `#ledger-activity-dialog-toolbar`,
 * `#ledger-activity-dialog-body`.
 *
 * `#ledger-activity-dialog-toolbar` is empty/hidden in phase 1. Sort, kind filters,
 * and month grouping controls should render there and call {@link setLedgerActivityDialogQuery}.
 */

import { PLAN } from './plan-data';
import {
  DEFAULT_LEDGER_ACTIVITY_QUERY,
  ledgerActivityItemCount,
  ledgerActivityKindLabel,
  ledgerActivityQueryForAccount,
  queryLedgerActivity,
  type LedgerActivityAccountKind,
  type LedgerActivityItem,
  type LedgerActivityQuery,
  type LedgerActivitySection,
} from './ledger-activity-query';
import { removeDebtLedgerEntry } from './debt-editor';
import { removeSavingsLedgerEntry } from './savings-editor';
import { savePlanOverrides } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import type { PlanPageRenderOptions } from './render-page';
import { createMoneyFormatters } from './utils';

type RenderFn = (opts?: PlanPageRenderOptions) => void;

export const LEDGER_ACTIVITY_DIALOG_ID = 'ledger-activity-dialog';

export type LedgerActivityDialogScope = {
  accountKind: LedgerActivityAccountKind;
  accountId: string;
};

const { moneyExact } = createMoneyFormatters();

let dialogScope: LedgerActivityDialogScope | null = null;
let dialogQuery: LedgerActivityQuery = { ...DEFAULT_LEDGER_ACTIVITY_QUERY };
let dialogRender: RenderFn | null = null;

function accountTitle(scope: LedgerActivityDialogScope): string {
  if (scope.accountKind === 'savings') {
    const accs = Array.isArray(PLAN.savingsAccounts) ? PLAN.savingsAccounts : [];
    const acc = accs.find(function (a) {
      return String(a.id) === String(scope.accountId);
    });
    return (acc && acc.name) || 'Savings';
  }
  const debts = Array.isArray(PLAN.debts) ? PLAN.debts : [];
  const debt = debts.find(function (d) {
    return String(d.id) === String(scope.accountId);
  });
  return (debt && debt.name) || 'Debt';
}

export function ensureLedgerActivityDialog(): HTMLDialogElement | null {
  let dlg = document.getElementById(LEDGER_ACTIVITY_DIALOG_ID) as HTMLDialogElement | null;
  if (dlg) return dlg;
  if (!document.body) return null;
  dlg = document.createElement('dialog');
  dlg.id = LEDGER_ACTIVITY_DIALOG_ID;
  dlg.className = 'ledger-activity-dialog no-print';
  dlg.setAttribute('aria-labelledby', 'ledger-activity-dialog-title');
  dlg.setAttribute('aria-modal', 'true');
  dlg.innerHTML =
    '<div class="ledger-activity-dialog__chrome">' +
    '<div class="ledger-activity-dialog__header">' +
    '<div class="ledger-activity-dialog__heading">' +
    '<h2 class="ledger-activity-dialog__title" id="ledger-activity-dialog-title">All transactions</h2>' +
    '<p class="ledger-activity-dialog__subtitle" id="ledger-activity-dialog-subtitle"></p>' +
    '</div>' +
    '<button type="button" class="ledger-activity-dialog__close" data-close-ledger-activity-dialog aria-label="Close">×</button>' +
    '</div>' +
    '<div class="ledger-activity-dialog__toolbar" id="ledger-activity-dialog-toolbar" hidden></div>' +
    '<div class="ledger-activity-dialog__body" id="ledger-activity-dialog-body"></div>' +
    '</div>';
  document.body.appendChild(dlg);
  return dlg;
}

function formatActivityDate(at: string): string {
  const dt = new Date(at);
  if (!Number.isFinite(dt.getTime())) return '';
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildActivityRow(item: LedgerActivityItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'ledger-activity-row ledger-activity-row--' + item.kind;
  li.setAttribute('data-entry-id', item.id);
  li.setAttribute('data-kind', item.kind);
  li.setAttribute('data-account-id', item.accountId);
  li.setAttribute('data-account-kind', item.accountKind);

  const kind = document.createElement('span');
  kind.className = 'ledger-activity-row__kind';
  kind.textContent = ledgerActivityKindLabel(item.kind);

  const main = document.createElement('div');
  main.className = 'ledger-activity-row__main';
  const amount = document.createElement('span');
  amount.className = 'ledger-activity-row__amount';
  amount.textContent = moneyExact(item.amount);
  main.appendChild(amount);
  if (item.memo) {
    const memo = document.createElement('span');
    memo.className = 'ledger-activity-row__memo';
    memo.textContent = item.memo;
    main.appendChild(memo);
  }

  const aside = document.createElement('div');
  aside.className = 'ledger-activity-row__aside';
  const date = document.createElement('time');
  date.className = 'ledger-activity-row__date';
  if (item.at) date.setAttribute('datetime', item.at);
  date.textContent = formatActivityDate(item.at);
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'ledger-activity-row__remove no-print';
  rm.setAttribute('data-action', 'remove-ledger-activity');
  rm.setAttribute('data-entry-id', item.id);
  rm.setAttribute('data-account-id', item.accountId);
  rm.setAttribute('data-account-kind', item.accountKind);
  rm.setAttribute('aria-label', 'Remove ' + ledgerActivityKindLabel(item.kind).toLowerCase());
  rm.textContent = 'Remove';
  aside.appendChild(date);
  aside.appendChild(rm);

  li.appendChild(kind);
  li.appendChild(main);
  li.appendChild(aside);
  return li;
}

function buildSection(section: LedgerActivitySection): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'ledger-activity-section';
  wrap.setAttribute('data-section-key', section.key);
  if (section.label) {
    const heading = document.createElement('h3');
    heading.className = 'ledger-activity-section__label';
    heading.textContent = section.label;
    wrap.appendChild(heading);
  }
  const list = document.createElement('ol');
  list.className = 'ledger-activity-rows';
  section.items.forEach(function (item) {
    list.appendChild(buildActivityRow(item));
  });
  wrap.appendChild(list);
  return wrap;
}

export function renderLedgerActivityDialogList(sections: LedgerActivitySection[]): void {
  const body = document.getElementById('ledger-activity-dialog-body');
  if (!body) return;
  body.innerHTML = '';
  const count = ledgerActivityItemCount(sections);
  if (count === 0) {
    const empty = document.createElement('p');
    empty.className = 'ledger-activity-dialog__empty';
    empty.textContent = 'No transactions yet.';
    body.appendChild(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'ledger-activity-list';
  sections.forEach(function (section) {
    list.appendChild(buildSection(section));
  });
  body.appendChild(list);
}

function fillOpenDialog(): void {
  if (!dialogScope) return;
  const dlg = ensureLedgerActivityDialog();
  if (!dlg) return;
  const title = document.getElementById('ledger-activity-dialog-title');
  const subtitle = document.getElementById('ledger-activity-dialog-subtitle');
  const sections = queryLedgerActivity(PLAN, dialogQuery);
  const count = ledgerActivityItemCount(sections);
  const name = accountTitle(dialogScope);
  if (title) title.textContent = 'All transactions';
  if (subtitle) {
    subtitle.textContent =
      name + ' · ' + String(count) + (count === 1 ? ' transaction' : ' transactions');
  }
  renderLedgerActivityDialogList(sections);
}

/** Replace sort/filter/group on the open dialog and redraw. Used by later phases. */
export function setLedgerActivityDialogQuery(next: Partial<LedgerActivityQuery>): void {
  dialogQuery = { ...dialogQuery, ...next };
  fillOpenDialog();
}

export function refreshOpenLedgerActivityDialog(): void {
  const dlg = document.getElementById(LEDGER_ACTIVITY_DIALOG_ID) as HTMLDialogElement | null;
  if (!dlg || !dialogScope) return;
  const isOpen = typeof dlg.open === 'boolean' ? dlg.open : dlg.hasAttribute('open');
  if (!isOpen) return;
  fillOpenDialog();
}

export function openLedgerActivityDialog(scope: LedgerActivityDialogScope): void {
  const id = String(scope.accountId || '').trim();
  if (!id) return;
  dialogScope = { accountKind: scope.accountKind, accountId: id };
  dialogQuery = ledgerActivityQueryForAccount(scope.accountKind, id);
  const dlg = ensureLedgerActivityDialog();
  if (!dlg) return;
  fillOpenDialog();
  try {
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    else dlg.setAttribute('open', '');
  } catch {
    dlg.setAttribute('open', '');
  }
  const closeBtn = dlg.querySelector('[data-close-ledger-activity-dialog]') as HTMLElement | null;
  if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
}

export function closeLedgerActivityDialog(): void {
  const dlg = document.getElementById(LEDGER_ACTIVITY_DIALOG_ID) as HTMLDialogElement | null;
  if (!dlg) return;
  if (typeof dlg.close === 'function') {
    try {
      dlg.close();
    } catch {
      dlg.removeAttribute('open');
    }
  } else {
    dlg.removeAttribute('open');
  }
}

function scopeFromSeeAllButton(btn: HTMLElement): LedgerActivityDialogScope | null {
  const kind = btn.getAttribute('data-account-kind');
  const id = btn.getAttribute('data-account-id') || btn.getAttribute('data-debt-id') || btn.getAttribute('data-savings-id');
  if (!id) return null;
  if (kind === 'savings' || btn.getAttribute('data-savings-id')) {
    return { accountKind: 'savings', accountId: String(id) };
  }
  return { accountKind: 'debt', accountId: String(id) };
}

function refreshAfterLedgerRemove(accountKind: LedgerActivityAccountKind): void {
  if (dialogRender) {
    dialogRender({
      refreshBalanceEditors: true,
      refreshGoal2DebtsCards: accountKind === 'debt',
      refreshGoal3SavingsCards: accountKind === 'savings',
    });
  }
  refreshOpenLedgerActivityDialog();
}

function removeLedgerActivityFromDialog(btn: HTMLElement): void {
  if (btn.getAttribute('aria-busy') === 'true') return;
  const entryId = btn.getAttribute('data-entry-id');
  const accountId = btn.getAttribute('data-account-id');
  const accountKind = btn.getAttribute('data-account-kind');
  if (!entryId || !accountId) return;
  if (accountKind !== 'debt' && accountKind !== 'savings') return;
  const ok = window.confirm('Remove this activity record?\n\nThe balance will be adjusted.');
  if (!ok) return;
  btn.setAttribute('aria-busy', 'true');
  const removed =
    accountKind === 'savings'
      ? removeSavingsLedgerEntry(accountId, entryId, function () {}, function () {
          refreshAfterLedgerRemove('savings');
        })
      : removeDebtLedgerEntry(accountId, entryId, function () {}, function () {
          refreshAfterLedgerRemove('debt');
        });
  if (!removed) {
    btn.removeAttribute('aria-busy');
    return;
  }
  if (accountKind === 'savings') syncLegacySavingsFromAccounts(PLAN);
  void savePlanOverrides(
    accountKind === 'savings' ? { savingsId: accountId } : { debtId: accountId }
  ).then(function () {
    refreshOpenLedgerActivityDialog();
  });
}

export function wireLedgerActivityDialog(render?: RenderFn): void {
  if (render) dialogRender = render;
  const prevAc = (wireLedgerActivityDialog as any)._ac as AbortController | undefined;
  if (prevAc) prevAc.abort();
  const ac = new AbortController();
  (wireLedgerActivityDialog as any)._ac = ac;
  const signal = ac.signal;

  const dlg = ensureLedgerActivityDialog();
  if (dlg) {
    dlg.addEventListener(
      'click',
      function (e) {
        if (e.target === dlg) {
          closeLedgerActivityDialog();
          return;
        }
        const t = e.target as HTMLElement | null;
        if (!t || typeof t.closest !== 'function') return;
        const rm = t.closest('[data-action="remove-ledger-activity"]') as HTMLElement | null;
        if (rm && dlg.contains(rm)) {
          e.preventDefault();
          e.stopPropagation();
          removeLedgerActivityFromDialog(rm);
          return;
        }
        if (t.closest('[data-close-ledger-activity-dialog]')) {
          closeLedgerActivityDialog();
        }
      },
      { signal }
    );
    dlg.addEventListener(
      'close',
      function () {
        dialogScope = null;
        dialogQuery = { ...DEFAULT_LEDGER_ACTIVITY_QUERY };
      },
      { signal }
    );
  }

  document.addEventListener(
    'click',
    function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest('[data-action="see-all-ledger"], .card-activity-see-all') as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const scope = scopeFromSeeAllButton(btn);
      if (scope) openLedgerActivityDialog(scope);
    },
    { signal, capture: true }
  );
}
