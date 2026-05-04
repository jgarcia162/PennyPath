/**
 * Export/import helpers for month-level “checkpoint” backups.
 *
 * Design goals:
 * - Round-trip import: restore storage so the app can continue from that month-end state.
 * - Human-friendly export: optional CSV with month activity + start/end balances.
 * - Forward compatibility: versioned payload for future multi-user/server storage.
 */

import type {
  CheckInEntry,
  DepositHistoryItem,
  Debt,
  FinancialPlan,
  PaymentHistoryItem,
  SavingsAccount,
} from '../../types/index.js';
import { numOr, roundMoney } from './utils';
import { getSavingsAccounts, syncLegacySavingsFromAccounts } from './savings-accounts';
import { isoInLocalYyyyMm, dateFieldInYyyyMm } from './monthly-activity';

function parseYyyyMm(yyyyMm: unknown): { y: number; m: number } | null {
  const p = String(yyyyMm || '').split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y: y, m: m };
}

function endOfMonthLocal(yyyyMm: unknown): Date | null {
  const pm = parseYyyyMm(yyyyMm);
  if (!pm) return null;
  // Day 0 of next month is last day of this month.
  return new Date(pm.y, pm.m, 0, 23, 59, 59, 999);
}

function endOfPrevMonthLocal(yyyyMm: unknown): Date | null {
  const pm = parseYyyyMm(yyyyMm);
  if (!pm) return null;
  return new Date(pm.y, pm.m - 1, 0, 23, 59, 59, 999);
}

function isoAtOrBeforeLocalCutoff(iso: unknown, cutoffLocalDate: Date | null): boolean {
  if (!cutoffLocalDate) return false;
  const dt = new Date(String(iso || ''));
  if (!Number.isFinite(dt.getTime())) return false;
  return dt.getTime() <= cutoffLocalDate.getTime();
}

type MonthExportPlanPayload = Pick<
  FinancialPlan,
  | 'hysaBalance'
  | 'joseSavings'
  | 'sherlynaSavings'
  | 'debtsEditorSort'
  | 'debtsProgressSort'
> & {
  savingsAccounts: Array<
    Pick<SavingsAccount, 'id' | 'name' | 'current' | 'apyPct' | 'ledgerStatus'> & {
      depositHistory: DepositHistoryItem[];
    }
  >;
  debts: Array<
    Pick<
      Debt,
      | 'id'
      | 'name'
      | 'current'
      | 'paidOff'
      | 'aprPct'
      | 'deferredAmount'
      | 'deferredExpiresOn'
      | 'deferredMonthsRemaining'
      | 'ledgerStatus'
    > & { paymentHistory: PaymentHistoryItem[] }
  >;
};

function clonePlanBalancesOnly(plan: FinancialPlan): MonthExportPlanPayload {
  const out: MonthExportPlanPayload = {
    hysaBalance: roundMoney(numOr(plan && plan.hysaBalance, 0)),
    joseSavings: roundMoney(numOr(plan && plan.joseSavings, 0)),
    sherlynaSavings: roundMoney(numOr(plan && plan.sherlynaSavings, 0)),
    savingsAccounts: [],
    debts: [],
    debtsEditorSort: plan && typeof plan.debtsEditorSort === 'string' ? plan.debtsEditorSort : 'saved',
    debtsProgressSort: plan && typeof plan.debtsProgressSort === 'string' ? plan.debtsProgressSort : 'saved',
  };

  const debts = Array.isArray(plan && (plan as any).debts) ? ((plan as any).debts as Debt[]) : [];
  out.debts = debts.map(function (d: any) {
    const rowDebts: MonthExportPlanPayload['debts'][number] = {
      id: String(d && d.id ? d.id : ''),
      name: String((d && d.name) || 'Debt'),
      current: roundMoney(numOr(d && d.current, 0)),
      paidOff: roundMoney(numOr(d && d.paidOff, 0)),
      aprPct: roundMoney(numOr(d && d.aprPct, 0)),
      deferredAmount: roundMoney(numOr(d && d.deferredAmount, 0)),
      deferredExpiresOn: typeof (d && d.deferredExpiresOn) === 'string' ? d.deferredExpiresOn : '',
      deferredMonthsRemaining: Number.isFinite(d && d.deferredMonthsRemaining)
        ? Math.max(0, Math.floor(d.deferredMonthsRemaining))
        : 0,
      paymentHistory: Array.isArray(d && d.paymentHistory) ? d.paymentHistory.slice() : [],
    };
    if (d && (d.ledgerStatus === 'completed' || d.ledgerStatus === 'deleted')) {
      rowDebts.ledgerStatus = d.ledgerStatus;
    }
    return rowDebts;
  });

  const rawAccs =
    Array.isArray((plan as any).savingsAccounts) && (plan as any).savingsAccounts.length
      ? ((plan as any).savingsAccounts as SavingsAccount[])
      : getSavingsAccounts((plan || {}) as FinancialPlan);
  out.savingsAccounts = rawAccs.map(function (a: any) {
    const row: MonthExportPlanPayload['savingsAccounts'][number] = {
      id: String(a && a.id ? a.id : ''),
      name: String((a && a.name) || 'Account'),
      current: roundMoney(numOr(a && a.current, 0)),
      apyPct: roundMoney(numOr(a && a.apyPct, 0)),
      depositHistory: Array.isArray(a && a.depositHistory) ? a.depositHistory.slice() : [],
    };
    if (a && a.ledgerStatus === 'deleted') {
      row.ledgerStatus = 'deleted';
    }
    return row;
  });

  return out;
}

/**
 * Compute a plan payload as-of a local month-end cutoff by reversing future activity
 * from the current plan snapshot.
 *
 * Assumptions (true in current app code):
 * - Logging a debt payment decreases `current` and increases `paidOff`.
 * - Logging a savings deposit increases `current`.
 */
export function computePlanPayloadAtMonthEnd(
  plan: FinancialPlan,
  yyyyMm: string
): MonthExportPlanPayload | null {
  const cutoff = endOfMonthLocal(yyyyMm);
  if (!cutoff) return null;

  const payload = clonePlanBalancesOnly(plan);

  payload.debts.forEach(function (d: any) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    let addBackCurrent = 0;
    let subPaidOff = 0;
    const keep: PaymentHistoryItem[] = [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      const amt = numOr(p.amount, 0);
      if (isoAtOrBeforeLocalCutoff(p.at, cutoff)) {
        keep.push({ id: String(p.id || ''), amount: roundMoney(amt), at: String(p.at) });
      } else {
        addBackCurrent += amt;
        subPaidOff += amt;
      }
    });
    d.current = roundMoney(numOr(d.current, 0) + addBackCurrent);
    d.paidOff = roundMoney(Math.max(0, numOr(d.paidOff, 0) - subPaidOff));
    d.paymentHistory = keep;
  });

  payload.savingsAccounts.forEach(function (a: any) {
    const hist = Array.isArray(a.depositHistory) ? a.depositHistory : [];
    let subCurrent = 0;
    const keep: DepositHistoryItem[] = [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      const amt = numOr(p.amount, 0);
      if (isoAtOrBeforeLocalCutoff(p.at, cutoff)) {
        keep.push({ id: String(p.id || ''), amount: roundMoney(amt), at: String(p.at) });
      } else {
        subCurrent += amt;
      }
    });
    a.current = roundMoney(Math.max(0, numOr(a.current, 0) - subCurrent));
    a.depositHistory = keep;
  });

  // Keep legacy savings fields consistent with savingsAccounts.
  try {
    syncLegacySavingsFromAccounts(payload as any);
  } catch (e) {}

  return payload;
}

export function computePlanPayloadAtPrevMonthEnd(
  plan: FinancialPlan,
  yyyyMm: string
): MonthExportPlanPayload | null {
  const prevCutoff = endOfPrevMonthLocal(yyyyMm);
  if (!prevCutoff) return null;
  const pm = parseYyyyMm(yyyyMm);
  if (!pm) return null;
  const prevYyyyMm = new Date(pm.y, pm.m - 2, 1);
  const prevKey =
    prevYyyyMm.getFullYear() + '-' + String(prevYyyyMm.getMonth() + 1).padStart(2, '0');
  return computePlanPayloadAtMonthEnd(plan, prevKey);
}

function csvEscape(v: unknown): string {
  const s = String(v == null ? '' : v);
  if (/["\n,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function buildMonthCsv(planNow: FinancialPlan, checkinsNow: unknown[], yyyyMm: string): string | null {
  const startPayload = computePlanPayloadAtPrevMonthEnd(planNow, yyyyMm);
  const endPayload = computePlanPayloadAtMonthEnd(planNow, yyyyMm);
  if (!endPayload) return null;

  const lines: string[] = [];
  lines.push('section,yyyyMm,type,id,name,at,date,amount,startBalance,endBalance,note');

  // Summary balances: debts
  const startDebts = (startPayload && Array.isArray(startPayload.debts) ? startPayload.debts : []).reduce(function (
    m: Record<string, any>,
    d: any
  ) {
    m[String(d.id || '')] = d;
    return m;
  }, {});
  (endPayload.debts || []).forEach(function (d: any) {
    const sd = startDebts[String(d.id || '')];
    lines.push(
      [
        'balances',
        yyyyMm,
        'debt',
        d.id,
        d.name,
        '',
        '',
        '',
        sd ? roundMoney(numOr(sd.current, 0)) : '',
        roundMoney(numOr(d.current, 0)),
        '',
      ].map(csvEscape).join(',')
    );
  });

  // Summary balances: savings
  const startAcc = (startPayload && Array.isArray(startPayload.savingsAccounts) ? startPayload.savingsAccounts : []).reduce(function (
    m: Record<string, any>,
    a: any
  ) {
    m[String(a.id || '')] = a;
    return m;
  }, {});
  (endPayload.savingsAccounts || []).forEach(function (a: any) {
    const sa = startAcc[String(a.id || '')];
    lines.push(
      [
        'balances',
        yyyyMm,
        'savings',
        a.id,
        a.name,
        '',
        '',
        '',
        sa ? roundMoney(numOr(sa.current, 0)) : '',
        roundMoney(numOr(a.current, 0)),
        '',
      ].map(csvEscape).join(',')
    );
  });

  // Transactions: debt payments in month (from current plan histories)
  const debtsNow = Array.isArray(planNow && (planNow as any).debts) ? ((planNow as any).debts as any[]) : [];
  debtsNow.forEach(function (d: any) {
    const hist = Array.isArray(d && d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      if (!isoInLocalYyyyMm(p.at, yyyyMm)) return;
      lines.push(
        [
          'transactions',
          yyyyMm,
          'debt_payment',
          String(d.id || ''),
          String(d.name || 'Debt'),
          String(p.at),
          '',
          roundMoney(numOr(p.amount, 0)),
          '',
          '',
          '',
        ].map(csvEscape).join(',')
      );
    });
  });

  // Transactions: savings deposits in month
  const accNow = getSavingsAccounts((planNow || {}) as FinancialPlan);
  accNow.forEach(function (a: any) {
    const hist = Array.isArray(a && a.depositHistory) ? a.depositHistory : [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      if (!isoInLocalYyyyMm(p.at, yyyyMm)) return;
      lines.push(
        [
          'transactions',
          yyyyMm,
          'savings_deposit',
          String(a.id || ''),
          String(a.name || 'Account'),
          String(p.at),
          '',
          roundMoney(numOr(p.amount, 0)),
          '',
          '',
          '',
        ].map(csvEscape).join(',')
      );
    });
  });

  // Check-ins in month
  (Array.isArray(checkinsNow) ? checkinsNow : []).forEach(function (c: any) {
    const ds = String((c && c.date) || '');
    if (!dateFieldInYyyyMm(ds, yyyyMm)) return;
    lines.push(
      [
        'checkins',
        yyyyMm,
        'checkin',
        String((c && c.id) || ''),
        '',
        '',
        ds,
        '',
        '',
        '',
        String((c && c.note) || ''),
      ].map(csvEscape).join(',')
    );
  });

  return lines.join('\n') + '\n';
}

/**
 * Build a month-end checkpoint payload suitable for import.
 * The payload restores plan balances + histories and check-ins up through the month end.
 */
export function buildMonthCheckpointPayload(
  planNow: FinancialPlan,
  checkinsNow: unknown[],
  yyyyMm: string
): {
  schema: 'pennypath.month-checkpoint';
  version: 1;
  yyyyMm: string;
  exportedAt: string;
  payload: { plan: MonthExportPlanPayload; checkins: Array<CheckInEntry & { createdAt?: string }> };
} | null {
  const endPayload = computePlanPayloadAtMonthEnd(planNow, yyyyMm);
  if (!endPayload) return null;
  const cutoff = endOfMonthLocal(yyyyMm);

  const checkins = (Array.isArray(checkinsNow) ? checkinsNow : [])
    .filter(function (c: any) {
      const ds = String((c && c.date) || '');
      // date fields are YYYY-MM-DD; keep anything <= cutoff month end
      if (ds.length < 10) return false;
      const dt = new Date(ds + 'T12:00:00');
      if (!Number.isFinite(dt.getTime())) return false;
      return cutoff ? dt.getTime() <= cutoff.getTime() : false;
    })
    .map(function (c: any) {
      return {
        id: String((c && c.id) || ''),
        date: String((c && c.date) || '') as any,
        note: String((c && c.note) || ''),
        createdAt: String((c && c.createdAt) || ''),
      };
    });

  return {
    schema: 'pennypath.month-checkpoint',
    version: 1,
    yyyyMm: String(yyyyMm),
    exportedAt: new Date().toISOString(),
    // Future multi-user: a server will likely add userId/accountId here.
    payload: {
      plan: endPayload,
      checkins: checkins,
    },
  };
}

