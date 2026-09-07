/**
 * Query pipeline for the ledger activity dialog (and later card/history views).
 *
 * Phase 1 shows one account, newest-first, ungrouped.
 * Later phases plug into the same {@link LedgerActivityQuery}: sort by date/amount,
 * filter by kind (payment/charge/deposit/withdrawal) or account type, and group by month.
 */

import type {
  Debt,
  DebtLedgerEntryKind,
  FinancialPlan,
  SavingsAccount,
  SavingsLedgerEntryKind,
} from '../../types/index.js';
import { monthLabel, yyyyMmFromDate } from './monthly-activity';
import { getSavingsAccounts } from './savings-accounts';
import {
  debtLedgerKind,
  normalizeLedgerMemo,
  savingsLedgerKind,
} from './ledger-utils';
import { numOr } from './utils';

export type LedgerActivityAccountKind = 'debt' | 'savings';

export type LedgerActivityEntryKind = DebtLedgerEntryKind | SavingsLedgerEntryKind;

export interface LedgerActivityItem {
  id: string;
  accountId: string;
  accountName: string;
  accountKind: LedgerActivityAccountKind;
  kind: LedgerActivityEntryKind;
  amount: number;
  at: string;
  memo: string;
}

export type LedgerActivitySort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type LedgerActivityGroupBy = 'none' | 'month';

export interface LedgerActivityQuery {
  sort: LedgerActivitySort;
  groupBy: LedgerActivityGroupBy;
  /** When set, only these ledger kinds (payment/charge/deposit/withdrawal). */
  kinds?: LedgerActivityEntryKind[];
  /** When set, only these debt/savings ids. */
  accountIds?: string[];
  /** When set, only debts or only savings. */
  accountKinds?: LedgerActivityAccountKind[];
}

export const DEFAULT_LEDGER_ACTIVITY_QUERY: LedgerActivityQuery = {
  sort: 'date-desc',
  groupBy: 'none',
};

export interface LedgerActivitySection {
  /** Stable key for DOM (`all`, `2026-04`, `unknown`). */
  key: string;
  /** Visible heading; empty when ungrouped so the renderer can hide it. */
  label: string;
  items: LedgerActivityItem[];
}

export function ledgerActivityKindLabel(kind: LedgerActivityEntryKind): string {
  if (kind === 'charge') return 'Charge';
  if (kind === 'withdrawal') return 'Withdrawal';
  if (kind === 'deposit') return 'Deposit';
  return 'Payment';
}

/** Phase-1 (and default) query: one account, newest first, no month groups. */
export function ledgerActivityQueryForAccount(
  accountKind: LedgerActivityAccountKind,
  accountId: string,
  extras?: Partial<LedgerActivityQuery>
): LedgerActivityQuery {
  return {
    sort: extras && extras.sort ? extras.sort : DEFAULT_LEDGER_ACTIVITY_QUERY.sort,
    groupBy: extras && extras.groupBy ? extras.groupBy : DEFAULT_LEDGER_ACTIVITY_QUERY.groupBy,
    accountKinds: extras && extras.accountKinds ? extras.accountKinds : [accountKind],
    accountIds: extras && extras.accountIds ? extras.accountIds : [accountId],
    kinds: extras && extras.kinds ? extras.kinds : undefined,
  };
}

export function collectLedgerActivityItems(plan: FinancialPlan): LedgerActivityItem[] {
  const items: LedgerActivityItem[] = [];
  const debts = Array.isArray(plan.debts) ? (plan.debts as Debt[]) : [];
  debts.forEach(function (d) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p) {
      if (!p || p.id == null) return;
      items.push({
        id: String(p.id),
        accountId: String(d.id || ''),
        accountName: d.name || 'Debt',
        accountKind: 'debt',
        kind: debtLedgerKind(p.kind),
        amount: numOr(p.amount, 0),
        at: typeof p.at === 'string' ? p.at : '',
        memo: normalizeLedgerMemo(p.memo),
      });
    });
  });
  (getSavingsAccounts(plan) as SavingsAccount[]).forEach(function (acc) {
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    hist.forEach(function (p) {
      if (!p || p.id == null) return;
      items.push({
        id: String(p.id),
        accountId: String(acc.id || ''),
        accountName: acc.name || 'Savings',
        accountKind: 'savings',
        kind: savingsLedgerKind(p.kind),
        amount: numOr(p.amount, 0),
        at: typeof p.at === 'string' ? p.at : '',
        memo: normalizeLedgerMemo(p.memo),
      });
    });
  });
  return items;
}

export function filterLedgerActivityItems(
  items: LedgerActivityItem[],
  query: Pick<LedgerActivityQuery, 'kinds' | 'accountIds' | 'accountKinds'>
): LedgerActivityItem[] {
  const kinds = query.kinds && query.kinds.length ? new Set(query.kinds) : null;
  const accountIds = query.accountIds && query.accountIds.length ? new Set(query.accountIds.map(String)) : null;
  const accountKinds =
    query.accountKinds && query.accountKinds.length ? new Set(query.accountKinds) : null;
  return items.filter(function (item) {
    if (kinds && !kinds.has(item.kind)) return false;
    if (accountIds && !accountIds.has(String(item.accountId))) return false;
    if (accountKinds && !accountKinds.has(item.accountKind)) return false;
    return true;
  });
}

function atMs(at: string): number {
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortLedgerActivityItems(
  items: LedgerActivityItem[],
  sort: LedgerActivitySort
): LedgerActivityItem[] {
  const list = items.slice();
  list.sort(function (a, b) {
    if (sort === 'amount-desc' || sort === 'amount-asc') {
      const diff = sort === 'amount-desc' ? b.amount - a.amount : a.amount - b.amount;
      if (diff !== 0) return diff;
    } else {
      const diff = sort === 'date-asc' ? atMs(a.at) - atMs(b.at) : atMs(b.at) - atMs(a.at);
      if (diff !== 0) return diff;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  return list;
}

export function groupLedgerActivityItems(
  items: LedgerActivityItem[],
  groupBy: LedgerActivityGroupBy,
  sort: LedgerActivitySort
): LedgerActivitySection[] {
  if (groupBy !== 'month') {
    return [{ key: 'all', label: '', items: items }];
  }
  const buckets = new Map<string, LedgerActivityItem[]>();
  items.forEach(function (item) {
    const dt = new Date(item.at);
    const key = Number.isFinite(dt.getTime()) ? yyyyMmFromDate(dt) : 'unknown';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  });
  const keys = Array.from(buckets.keys());
  const newestFirst = sort !== 'date-asc';
  keys.sort(function (a, b) {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return newestFirst ? b.localeCompare(a) : a.localeCompare(b);
  });
  return keys.map(function (key) {
    return {
      key: key,
      label: key === 'unknown' ? 'Unknown date' : monthLabel(key),
      items: buckets.get(key) || [],
    };
  });
}

export function queryLedgerActivity(plan: FinancialPlan, query: LedgerActivityQuery): LedgerActivitySection[] {
  const filtered = filterLedgerActivityItems(collectLedgerActivityItems(plan), query);
  const sorted = sortLedgerActivityItems(filtered, query.sort);
  return groupLedgerActivityItems(sorted, query.groupBy, query.sort);
}

export function ledgerActivityItemCount(sections: LedgerActivitySection[]): number {
  return sections.reduce(function (n, section) {
    return n + section.items.length;
  }, 0);
}
