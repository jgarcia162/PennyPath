/**
 * Aggregate logged activity by calendar month (local dates for ISO timestamps;
 * YYYY-MM-DD for check-in date fields).
 */

import { numOr } from './utils.js';
import { getSavingsAccounts } from './savings-accounts.js';

/** @param {string} iso */
export function isoInLocalYyyyMm(iso, yyyyMm) {
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return false;
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const s = y + '-' + String(m).padStart(2, '0');
  return s === yyyyMm;
}

/** Check-in form uses YYYY-MM-DD. */
export function dateFieldInYyyyMm(dateStr, yyyyMm) {
  if (typeof dateStr !== 'string' || dateStr.length < 7) return false;
  return dateStr.slice(0, 7) === yyyyMm;
}

export function monthLabel(yyyyMm) {
  const parts = String(yyyyMm).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return String(yyyyMm);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function yyyyMmFromDate(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return y + '-' + String(m).padStart(2, '0');
}

export function defaultCompareMonths() {
  const now = new Date();
  const b = yyyyMmFromDate(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const a = yyyyMmFromDate(prev);
  return { monthA: a, monthB: b };
}

/**
 * @param {object} plan
 * @param {Array<{ date?: string }>} checkins
 */
export function collectMonthsWithActivity(plan, checkins) {
  const set = new Set();
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  debts.forEach(function (d) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
      const dt = new Date(p.at);
      if (!Number.isFinite(dt.getTime())) return;
      set.add(yyyyMmFromDate(dt));
    });
  });
  getSavingsAccounts(plan).forEach(function (acc) {
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
      const dt = new Date(p.at);
      if (!Number.isFinite(dt.getTime())) return;
      set.add(yyyyMmFromDate(dt));
    });
  });
  (Array.isArray(checkins) ? checkins : []).forEach(function (c) {
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
 * @param {object} plan
 * @param {Array} checkins
 * @param {string} workingYm YYYY-MM
 */
export function collectDashboardMonthOptions(plan, checkins, workingYm) {
  const set = new Set(collectMonthsWithActivity(plan, checkins || []));
  const w =
    typeof workingYm === 'string' && /^\d{4}-\d{2}$/.test(workingYm) ? workingYm : yyyyMmFromDate(new Date());
  set.add(w);
  const v = plan && plan.dashboardViewMonthYm;
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
 * @param {object} plan
 * @param {Array} checkins
 * @param {number} [maxMonths=24]
 */
export function buildMonthlySeriesForChart(plan, checkins, maxMonths) {
  const cap = Number.isFinite(maxMonths) ? Math.max(1, Math.floor(maxMonths)) : 24;
  const months = collectMonthsWithActivity(plan, checkins)
    .sort()
    .slice(-cap);
  return months.map(function (ym) {
    return summarizeMonth(plan, ym, checkins);
  });
}

/**
 * @param {object} plan
 * @param {string} yyyyMm
 * @param {Array<{ id?: string, date?: string, note?: string }>} checkins
 */
export function summarizeMonth(plan, yyyyMm, checkins) {
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  const debtLines = [];
  let debtPaymentsTotal = 0;

  debts.forEach(function (d) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    const payments = [];
    let total = 0;
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
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

  const accs = getSavingsAccounts(plan);
  const savingsLines = [];
  let savingsDepositsTotal = 0;
  accs.forEach(function (acc) {
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    const deposits = [];
    let total = 0;
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
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

  const ciList = (Array.isArray(checkins) ? checkins : [])
    .filter(function (c) {
      return c && dateFieldInYyyyMm(c.date, yyyyMm);
    })
    .map(function (c) {
      return {
        id: String(c.id || ''),
        date: String(c.date || ''),
        note: String(c.note || ''),
      };
    })
    .sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
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
