/**
 * Pure derived metrics from a plan object (no DOM).
 *
 * Converted from `plan-derived.js` with no logic changes.
 */

import type { DerivedPlanMetrics, EndOfPlanLiquidSummary, FinancialPlan, SavingsAccount, YyyyMm } from '../../types/index.js';
import { numOr } from './utils';
import { getSavingsAccounts } from './savings-accounts';
import {
  ensureSavingsGoals,
  sumBalancesTowardGoal,
  ID_GOAL_HYSA,
  ID_GOAL_EFUND,
} from './savings-goals';
import { projectPayoffTimeline, projectDebtPayoffYm } from './payoff-projection.js';
import { isoInLocalYyyyMm, monthLabel, yyyyMmFromDate } from './monthly-activity';
import { activeDebtsOnly } from './debt-ledger';
import { isDebtPaymentEntry } from './ledger-utils';

/** Working month for monthly debt progress (`YYYY-MM`). Falls back to the real calendar month. */
export function getWorkingMonthYm(plan: FinancialPlan): YyyyMm {
  const w = plan && (plan as any).workingMonthYm;
  if (typeof w === 'string' && /^\d{4}-\d{2}$/.test(w)) return w as YyyyMm;
  return yyyyMmFromDate(new Date()) as YyyyMm;
}

/**
 * Month shown on the dashboard monthly debt bar and used for default payment/deposit dates.
 * If `dashboardViewMonthYm` is unset, matches the working month.
 */
export function getDashboardViewMonthYm(plan: FinancialPlan): YyyyMm {
  const v = plan && (plan as any).dashboardViewMonthYm;
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return v as YyyyMm;
  return getWorkingMonthYm(plan);
}

/** Sum of debt payments logged with `at` in the given YYYY-MM (local). */
export function sumPaymentsInYyyyMm(plan: FinancialPlan, yyyyMm: string): number {
  const ym = String(yyyyMm || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  const debts = Array.isArray((plan as any).debts) ? (plan as any).debts : [];
  let sum = 0;
  debts.forEach(function (d: any) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p: any) {
      if (!p || typeof p.at !== 'string') return;
      if (!isDebtPaymentEntry(p)) return;
      if (isoInLocalYyyyMm(p.at, ym)) sum += numOr(p.amount, 0);
    });
  });
  return sum;
}

/** @deprecated Use sumPaymentsInYyyyMm(plan, yyyyMmFromDate(new Date())) — kept for clarity in tooling. */
export function sumPaymentsThisCalendarMonth(plan: FinancialPlan): number {
  return sumPaymentsInYyyyMm(plan, yyyyMmFromDate(new Date()));
}

/** Monthly rate from APY percent (e.g. 3.25 → 3.25% nominal, compounded monthly). */
function monthlyRateFromApyPct(apyPct: unknown): number {
  const apyDec = numOr(apyPct, 0) / 100;
  if (apyDec <= -1) return 0;
  return Math.pow(1 + apyDec, 1 / 12) - 1;
}

/**
 * Project non–joint savings balances to end of plan using each account’s APY (no additional deposits).
 */
function projectPersonalSavingsEnd(accs: SavingsAccount[], months: unknown): number {
  const n = Math.max(0, (months as any) | 0);
  return accs
    .filter(function (a) {
      return String(a.id) !== 'hysa';
    })
    .reduce(function (sum, a) {
      const cur = numOr((a as any).current, 0);
      const rm = monthlyRateFromApyPct(numOr((a as any).apyPct, 0));
      return sum + cur * Math.pow(1 + rm, n);
    }, 0);
}

/**
 * Joint HYSA + deposits through `monthsToHysaGoal`, and personal savings grown at each account’s APY.
 */
export function endOfPlanLiquid(plan: FinancialPlan): EndOfPlanLiquidSummary {
  const months = Math.max(0, Math.floor(numOr((plan as any).monthsToHysaGoal, 0)));
  const accs = getSavingsAccounts(plan) as SavingsAccount[];
  const rows = projectPayoffTimeline(plan, { maxMonths: months, noEarlyBreak: true });
  const hysaEnd =
    rows.length > 0
      ? rows[rows.length - 1].hysaEnd
      : accs.reduce(function (s, a) {
          return String(a.id) === 'hysa' ? s + numOr((a as any).current, 0) : s;
        }, 0);
  const personalEnd = projectPersonalSavingsEnd(accs, months);
  return {
    months,
    hysaEndPlan: hysaEnd,
    personalEndPlan: personalEnd,
    totalLiquidEndPlan: hysaEnd + personalEnd,
  };
}

export function derived(plan: FinancialPlan): DerivedPlanMetrics {
  const accs = getSavingsAccounts(plan) as SavingsAccount[];
  ensureSavingsGoals(plan);
  const goalSavingsCurrent = sumBalancesTowardGoal(accs as any, ID_GOAL_HYSA);
  const savingsGoalSummaries = ((plan as any).savingsGoals || []).map(function (g: any) {
    const id = String(g.id || '');
    const name = String(g.name || 'Goal');
    const targetAmount = Math.max(0, numOr(g.targetAmount, 0));
    const sum = sumBalancesTowardGoal(accs as any, id);
    const pct = targetAmount > 0 ? Math.min(100, (sum / targetAmount) * 100) : 0;
    const gap = Math.max(0, targetAmount - sum);
    const ym =
      typeof g.goalByYm === 'string' && /^\d{4}-\d{2}$/.test(g.goalByYm.trim()) ? g.goalByYm.trim() : '';
    const goalByWhen = ym ? 'By ' + monthLabel(ym) : '';
    return {
      id: id,
      name: name,
      targetAmount: targetAmount,
      sum: sum,
      pct: pct,
      gap: gap,
      goalByYm: ym,
      goalByWhen: goalByWhen,
    };
  });
  const hysaBal = accs
    .filter(function (a) {
      return String(a.id) === 'hysa';
    })
    .reduce(function (s, a) {
      return s + numOr((a as any).current, 0);
    }, 0);
  const personalSavings = accs
    .filter(function (a) {
      return String(a.id) !== 'hysa';
    })
    .reduce(function (s, a) {
      return s + numOr((a as any).current, 0);
    }, 0);
  const totalAssets = accs.reduce(function (s, a) {
    return s + numOr((a as any).current, 0);
  }, 0);
  const unfilteredDebts = Array.isArray((plan as any).debts) ? ((plan as any).debts as any[]) : [];
  const debts = activeDebtsOnly(unfilteredDebts);
  const totalDebt = debts.reduce(function (sum: number, d: any) {
    return sum + numOr(d.current, 0);
  }, 0);
  const debtStartTotal = debts.reduce(function (sum: number, d: any) {
    const c = numOr(d.current, 0);
    const p = numOr(d.paidOff, 0);
    return sum + Math.max(0, c + p);
  }, 0);
  const debtPaidOffTotal = debts.reduce(function (sum: number, d: any) {
    return sum + numOr(d.paidOff, 0);
  }, 0);
  const debtGoalPct =
    debtStartTotal > 0 ? Math.min(100, (Math.max(0, debtPaidOffTotal) / debtStartTotal) * 100) : 0;

  const netWorth = totalAssets - totalDebt;
  const debtRounded = Math.round(totalDebt);
  const grossForBar = totalAssets + totalDebt;
  const assetBarPct = grossForBar > 0 ? (totalAssets / grossForBar) * 100 : 0;
  const debtBarPct = 100 - assetBarPct;
  const hysaAcc = accs.find(function (a) {
    return String(a.id) === 'hysa';
  });
  const hysaApyDec =
    hysaAcc && Number.isFinite((hysaAcc as any).apyPct) ? (hysaAcc as any).apyPct / 100 : numOr((plan as any).hysaApy, 0);
  const hysaInterestYr = hysaBal * hysaApyDec;
  const efundRow = savingsGoalSummaries.find(function (x: any) {
    return x.id === ID_GOAL_EFUND;
  });
  const efundFallback = numOr((plan as any).monthlyFixedExpenses, 0) * numOr((plan as any).efundMonths, 12);
  const efundTarget = efundRow ? efundRow.targetAmount : efundFallback;
  const towardEfund = efundRow ? efundRow.sum : personalSavings;
  const efundGap = efundRow ? efundRow.gap : Math.max(0, efundFallback - personalSavings);
  const efundPct = efundTarget > 0 ? Math.min(100, (Math.max(0, towardEfund) / efundTarget) * 100) : 0;
  let customBudgetSum = 0;
  const bcats = (plan as any).budgetCategories;
  if (Array.isArray(bcats)) {
    bcats.forEach(function (r: { role?: string; amount?: unknown }) {
      if (r && r.role === 'custom') customBudgetSum += numOr(r.amount, 0);
    });
  }
  customBudgetSum = Math.round(customBudgetSum * 100) / 100;
  const buffer =
    (plan as any).monthlyTakeHome -
    (plan as any).monthlyFixedExpenses -
    (plan as any).phase1.ccPayment -
    (plan as any).phase1.hysaDeposit -
    (plan as any).funBudget -
    customBudgetSum;
  const budgetParts: number[] = [
    (plan as any).monthlyFixedExpenses,
    (plan as any).phase1.ccPayment,
    (plan as any).phase1.hysaDeposit,
    (plan as any).funBudget,
  ];
  if (Array.isArray(bcats)) {
    bcats.forEach(function (r: { role?: string; amount?: unknown }) {
      if (r && r.role === 'custom') budgetParts.push(numOr(r.amount, 0));
    });
  }
  budgetParts.push(buffer);
  const budgetTotal = budgetParts.reduce((a: number, b: number) => a + b, 0);
  const pctOfBudget = function (amt: number) {
    return budgetTotal > 0 ? Math.round((amt / budgetTotal) * 100) : 0;
  };
  const phase2Savings = (plan as any).phase1.ccPayment + (plan as any).phase1.hysaDeposit;
  const eop = endOfPlanLiquid(plan);
  const totalLiquidEndPlan = eop.totalLiquidEndPlan;
  const hysaEndPlan = eop.hysaEndPlan;
  const personalEndPlan = eop.personalEndPlan;

  const monthlyDebtGoal = numOr((plan as any).phase1 && (plan as any).phase1.ccPayment, 3500);
  const workingYm = getWorkingMonthYm(plan);
  const viewYm = getDashboardViewMonthYm(plan);
  const monthlyDebtPaidAuto = sumPaymentsInYyyyMm(plan, viewYm);
  const monthlyDebtPaid = monthlyDebtPaidAuto;
  const monthlyDebtPaidNonNeg = Math.max(0, monthlyDebtPaid);
  const monthlyDebtPct = monthlyDebtGoal > 0 ? Math.min(100, (monthlyDebtPaidNonNeg / monthlyDebtGoal) * 100) : 0;
  const monthlyDebtBudgetRemaining = Math.max(0, monthlyDebtGoal - monthlyDebtPaidNonNeg);
  const dashboardFollowsWorking =
    !(typeof (plan as any).dashboardViewMonthYm === 'string' && /^\d{4}-\d{2}$/.test((plan as any).dashboardViewMonthYm));

  const debtsPaidOffLifetimeCount = Math.max(
    0,
    Math.floor(numOr((plan as any).debtsPaidOffLifetimeCount, 0))
  );

  const payoff = projectDebtPayoffYm(plan, { maxMonths: 600 });
  const debtPayoffYm = payoff.ym;
  const debtPayoffMonthIndex = payoff.monthIndex;
  let debtPayoffWhenLabel = '—';
  let debtPayoffWhenNote = '';
  let debtGoalWhenLine = '';
  if (unfilteredDebts.length === 0) {
    debtPayoffWhenLabel = '—';
    debtPayoffWhenNote = '';
    debtGoalWhenLine = 'Add a debt in Goal 2';
  } else if (unfilteredDebts.length > 0 && debts.length === 0) {
    debtPayoffWhenLabel = 'Paid off';
    debtPayoffWhenNote = 'No balances on the active list — all debts are paid off or archived.';
    debtGoalWhenLine = 'Paid off';
  } else if (totalDebt <= 0) {
    debtPayoffWhenLabel = 'Paid off';
    debtPayoffWhenNote = 'All listed debts at $0.';
    debtGoalWhenLine = 'Paid off';
  } else if (payoff.ym) {
    debtPayoffWhenLabel = monthLabel(payoff.ym);
    debtPayoffWhenNote = payoff.monthIndex != null ? '~' + (payoff.monthIndex + 1) + ' months (projected)' : '';
    debtGoalWhenLine = 'By ' + monthLabel(payoff.ym);
  } else {
    debtPayoffWhenLabel = '—';
    debtPayoffWhenNote = 'Not reaching $0 in the long-run projection at current payment levels.';
    debtGoalWhenLine = 'Beyond current projection';
  }

  return {
    workingMonthYm: workingYm,
    workingMonthLabel: monthLabel(workingYm),
    dashboardViewMonthYm: viewYm,
    dashboardViewMonthLabel: monthLabel(viewYm),
    viewingDifferentFromWorking: viewYm !== workingYm,
    dashboardFollowsWorking: dashboardFollowsWorking,
    goalHysa: numOr((plan as any).goalHysa, 0),
    personalSavings,
    goalSavingsCurrent,
    totalAssets,
    netWorth,
    debtRounded,
    totalDebt,
    assetBarPct,
    debtBarPct,
    hysaInterestYr,
    efundTarget,
    efundGap,
    efundPct,
    towardEfund,
    savingsGoalSummaries: savingsGoalSummaries as any,
    buffer,
    budgetTotal,
    pctOfBudget,
    phase2Savings,
    totalLiquidEndPlan,
    hysaEndPlan,
    personalEndPlan,
    debtGoalPct,
    debtStartTotal,
    debtPayoffYm,
    debtPayoffMonthIndex,
    debtPayoffWhenLabel,
    debtPayoffWhenNote,
    debtGoalWhenLine,
    debts: debts as any,
    monthlyDebtGoal,
    monthlyDebtPaidAuto,
    monthlyDebtPaid,
    monthlyDebtPaidNonNeg,
    monthlyDebtPct,
    monthlyDebtBudgetRemaining,
    savingsAccounts: accs,
    debtsPaidOffLifetimeCount,
  } as any;
}

