/**
 * Aggregate logged activity by calendar month (local dates for ISO timestamps;
 * YYYY-MM-DD for check-in date fields).
 *
 * Converted from `monthly-activity.js` with no logic changes.
 */

import type { CheckInEntry, Debt, FinancialPlan, MoneyLedgerItem, SavingsAccount, YyyyMm } from '../../types/index.js';
import { numOr } from './utils';
import { getSavingsAccounts } from './savings-accounts';
import { isDebtPaymentEntry, isSavingsDepositEntry } from './ledger-utils';

/** @param iso */
export function isoInLocalYyyyMm(iso: string, yyyyMm: string): boolean {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return false;
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const s = y + '-' + String(m).padStart(2, '0');
  return s === yyyyMm;
}

/** Check-in form uses YYYY-MM-DD. */
export function dateFieldInYyyyMm(dateStr: unknown, yyyyMm: string): boolean {
  if (typeof dateStr !== 'string' || dateStr.length < 7) return false;
  return dateStr.slice(0, 7) === yyyyMm;
}

export function monthLabel(yyyyMm: string): string {
  const parts = String(yyyyMm).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return String(yyyyMm);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function yyyyMmFromDate(d: Date): YyyyMm {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return (y + '-' + String(m).padStart(2, '0')) as YyyyMm;
}

export function defaultCompareMonths(): { monthA: YyyyMm; monthB: YyyyMm } {
  const now = new Date();
  const b = yyyyMmFromDate(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const a = yyyyMmFromDate(prev);
  return { monthA: a, monthB: b };
}

/**
 * @param plan
 * @param checkins
 */
export function collectMonthsWithActivity(plan: FinancialPlan, checkins: Array<{ date?: string }>): string[] {
  const set = new Set<string>();
  const debts = Array.isArray((plan as any).debts) ? ((plan as any).debts as Debt[]) : [];
  debts.forEach(function (d: any) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      const dt = new Date(p.at);
      if (!Number.isFinite(dt.getTime())) return;
      set.add(yyyyMmFromDate(dt));
    });
  });
  (getSavingsAccounts(plan) as SavingsAccount[]).forEach(function (acc: any) {
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      const dt = new Date(p.at);
      if (!Number.isFinite(dt.getTime())) return;
      set.add(yyyyMmFromDate(dt));
    });
  });
  (Array.isArray(checkins) ? checkins : []).forEach(function (c: any) {
    if (c && typeof c.date === 'string' && c.date.length >= 7) {
      set.add(c.date.slice(0, 7));
    }
  });
  return Array.from(set).sort(function (x, y) {
    return y.localeCompare(x);
  });
}

/**
 * YYYY-MM values for the dashboard month picker (newest first): logged activity plus a window around the working month.
 */
export function collectDashboardMonthOptions(
  plan: FinancialPlan,
  checkins: unknown[],
  workingYm: string
): string[] {
  const set = new Set<string>(collectMonthsWithActivity(plan, (checkins as any) || []));
  const w = typeof workingYm === 'string' && /^\d{4}-\d{2}$/.test(workingYm) ? workingYm : yyyyMmFromDate(new Date());
  set.add(w);
  const v = plan && (plan as any).dashboardViewMonthYm;
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) set.add(v);
  const parts = w.split('-');
  const y0 = Number(parts[0]);
  const m0 = Number(parts[1]);
  if (Number.isFinite(y0) && Number.isFinite(m0) && m0 >= 1 && m0 <= 12) {
    for (let i = -12; i <= 6; i++) {
      const d = new Date(y0, m0 - 1 + i, 1);
      set.add(yyyyMmFromDate(d));
    }
  }
  return Array.from(set).sort(function (a, b) {
    return b.localeCompare(a);
  });
}

/**
 * Chronological summaries for charting (oldest → newest).
 */
export function buildMonthlySeriesForChart(
  plan: FinancialPlan,
  checkins: unknown[],
  maxMonths?: number
): any[] {
  const cap = Number.isFinite(maxMonths) ? Math.max(1, Math.floor(maxMonths as number)) : 24;
  const months = collectMonthsWithActivity(plan, checkins as any).sort().slice(-cap);
  return months.map(function (ym) {
    return summarizeMonth(plan, ym, checkins as any);
  });
}

export interface MonthlyDebtLine {
  debtId: string;
  debtName: string;
  total: number;
  payments: Array<Pick<MoneyLedgerItem, 'amount' | 'at'>>;
}

export interface MonthlySavingsLine {
  accountId: string;
  name: string;
  total: number;
  deposits: Array<Pick<MoneyLedgerItem, 'amount' | 'at'>>;
}

export interface MonthlySummary {
  yyyyMm: string;
  label: string;
  debtLines: MonthlyDebtLine[];
  debtPaymentsTotal: number;
  savingsLines: MonthlySavingsLine[];
  savingsDepositsTotal: number;
  checkIns: CheckInEntry[];
  checkInCount: number;
  transactionCount: number;
}

export function summarizeMonth(plan: FinancialPlan, yyyyMm: string, checkins: unknown[]): MonthlySummary {
  const debts = Array.isArray((plan as any).debts) ? ((plan as any).debts as Debt[]) : [];
  const debtLines: MonthlyDebtLine[] = [];
  let debtPaymentsTotal = 0;

  debts.forEach(function (d: any) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    const payments: Array<Pick<MoneyLedgerItem, 'amount' | 'at'>> = [];
    let total = 0;
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      if (!isDebtPaymentEntry(p)) return;
      if (!isoInLocalYyyyMm(p.at, yyyyMm)) return;
      const amt = numOr(p.amount, 0);
      total += amt;
      payments.push({ amount: amt, at: p.at });
    });
    debtLines.push({
      debtId: String(d.id || ''),
      debtName: String(d.name || 'Debt'),
      total: total,
      payments: payments,
    });
    debtPaymentsTotal += total;
  });

  const accs = getSavingsAccounts(plan) as SavingsAccount[];
  const savingsLines: MonthlySavingsLine[] = [];
  let savingsDepositsTotal = 0;
  accs.forEach(function (acc: any) {
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    const deposits: Array<Pick<MoneyLedgerItem, 'amount' | 'at'>> = [];
    let total = 0;
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      if (!isSavingsDepositEntry(p)) return;
      if (!isoInLocalYyyyMm(p.at, yyyyMm)) return;
      const amt = numOr(p.amount, 0);
      total += amt;
      deposits.push({ amount: amt, at: p.at });
    });
    savingsLines.push({
      accountId: String(acc.id || ''),
      name: String(acc.name || 'Account'),
      total: total,
      deposits: deposits,
    });
    savingsDepositsTotal += total;
  });

  const ciList: CheckInEntry[] = (Array.isArray(checkins) ? checkins : [])
    .filter(function (c: any) {
      return c && dateFieldInYyyyMm(c.date, yyyyMm);
    })
    .map(function (c: any) {
      return {
        id: String(c.id || ''),
        date: String(c.date || '') as any,
        note: String(c.note || ''),
      };
    })
    .sort(function (a, b) {
      return String((b as any).date).localeCompare(String((a as any).date));
    });

  const transactionCount =
    debtLines.reduce(function (n, line) {
      return n + line.payments.length;
    }, 0) +
    savingsLines.reduce(function (n, line) {
      return n + line.deposits.length;
    }, 0);

  return {
    yyyyMm: yyyyMm,
    label: monthLabel(yyyyMm),
    debtLines: debtLines,
    debtPaymentsTotal: debtPaymentsTotal,
    savingsLines: savingsLines,
    savingsDepositsTotal: savingsDepositsTotal,
    checkIns: ciList,
    checkInCount: ciList.length,
    transactionCount: transactionCount,
  };
}

