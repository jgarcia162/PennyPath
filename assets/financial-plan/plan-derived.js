/**
 * Pure derived metrics from a plan object (no DOM).
 */

import { numOr } from './utils.js';
import { getSavingsAccounts } from './savings-accounts.js';
import {
  ensureSavingsGoals,
  sumBalancesTowardGoal,
  ID_GOAL_HYSA,
  ID_GOAL_EFUND,
} from './savings-goals.js';
import { projectPayoffTimeline, projectDebtPayoffYm } from './payoff-projection.js';
import { isoInLocalYyyyMm, monthLabel, yyyyMmFromDate } from './monthly-activity.js';

/** Working month for monthly debt progress (`YYYY-MM`). Falls back to the real calendar month. */
export function getWorkingMonthYm(plan) {
  const w = plan && plan.workingMonthYm;
  if (typeof w === 'string' && /^\d{4}-\d{2}$/.test(w)) return w;
  return yyyyMmFromDate(new Date());
}

/**
 * Month shown on the dashboard monthly debt bar and used for default payment/deposit dates.
 * If `dashboardViewMonthYm` is unset, matches the working month.
 */
export function getDashboardViewMonthYm(plan) {
  const v = plan && plan.dashboardViewMonthYm;
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return v;
  return getWorkingMonthYm(plan);
}

/** Sum of debt payments logged with `at` in the given YYYY-MM (local). */
export function sumPaymentsInYyyyMm(plan, yyyyMm) {
  const ym = String(yyyyMm || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  let sum = 0;
  debts.forEach(function (d) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
      if (isoInLocalYyyyMm(p.at, ym)) sum += numOr(p.amount, 0);
    });
  });
  return sum;
}

/** @deprecated Use sumPaymentsInYyyyMm(plan, yyyyMmFromDate(new Date())) — kept for clarity in tooling. */
export function sumPaymentsThisCalendarMonth(plan) {
  return sumPaymentsInYyyyMm(plan, yyyyMmFromDate(new Date()));
}

/** Monthly rate from APY percent (e.g. 3.25 → 3.25% nominal, compounded monthly). */
function monthlyRateFromApyPct(apyPct) {
  const apyDec = numOr(apyPct, 0) / 100;
  if (apyDec <= -1) return 0;
  return Math.pow(1 + apyDec, 1 / 12) - 1;
}

/**
 * Project non–joint savings balances to end of plan using each account’s APY (no additional deposits).
 */
function projectPersonalSavingsEnd(accs, months) {
  const n = Math.max(0, months | 0);
  return accs
    .filter(function (a) {
      return String(a.id) !== 'hysa';
    })
    .reduce(function (sum, a) {
      const cur = numOr(a.current, 0);
      const rm = monthlyRateFromApyPct(numOr(a.apyPct, 0));
      return sum + cur * Math.pow(1 + rm, n);
    }, 0);
}

/**
 * Joint HYSA + deposits through `monthsToHysaGoal`, and personal savings grown at each account’s APY.
 */
export function endOfPlanLiquid(plan) {
  const months = Math.max(0, Math.floor(numOr(plan.monthsToHysaGoal, 0)));
  const accs = getSavingsAccounts(plan);
  const rows = projectPayoffTimeline(plan, { maxMonths: months, noEarlyBreak: true });
  const hysaEnd =
    rows.length > 0 ? rows[rows.length - 1].hysaEnd : accs.reduce(function (s, a) {
      return String(a.id) === 'hysa' ? s + numOr(a.current, 0) : s;
    }, 0);
  const personalEnd = projectPersonalSavingsEnd(accs, months);
  return {
    months,
    hysaEndPlan: hysaEnd,
    personalEndPlan: personalEnd,
    totalLiquidEndPlan: hysaEnd + personalEnd,
  };
}

export function derived(plan) {
  const accs = getSavingsAccounts(plan);
  ensureSavingsGoals(plan);
  const goalSavingsCurrent = sumBalancesTowardGoal(accs, ID_GOAL_HYSA);
  const savingsGoalSummaries = (plan.savingsGoals || []).map(function (g) {
    const id = String(g.id || '');
    const name = String(g.name || 'Goal');
    const targetAmount = Math.max(0, numOr(g.targetAmount, 0));
    const sum = sumBalancesTowardGoal(accs, id);
    const pct = targetAmount > 0 ? Math.min(100, (sum / targetAmount) * 100) : 0;
    const gap = Math.max(0, targetAmount - sum);
    const ym =
      typeof g.goalByYm === 'string' && /^\d{4}-\d{2}$/.test(g.goalByYm.trim())
        ? g.goalByYm.trim()
        : '';
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
      return s + numOr(a.current, 0);
    }, 0);
  const personalSavings = accs
    .filter(function (a) {
      return String(a.id) !== 'hysa';
    })
    .reduce(function (s, a) {
      return s + numOr(a.current, 0);
    }, 0);
  const totalAssets = accs.reduce(function (s, a) {
    return s + numOr(a.current, 0);
  }, 0);
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  const totalDebt = debts.reduce(function (sum, d) {
    return sum + numOr(d.current, 0);
  }, 0);
  const debtStartTotal = debts.reduce(function (sum, d) {
    const c = numOr(d.current, 0);
    const p = numOr(d.paidOff, 0);
    return sum + Math.max(0, c + p);
  }, 0);
  const debtPaidOffTotal = debts.reduce(function (sum, d) {
    return sum + numOr(d.paidOff, 0);
  }, 0);
  const debtGoalPct = debtStartTotal > 0 ? Math.min(100, (Math.max(0, debtPaidOffTotal) / debtStartTotal) * 100) : 0;

  const netWorth = totalAssets - totalDebt;
  const debtRounded = Math.round(totalDebt);
  const grossForBar = totalAssets + totalDebt;
  const assetBarPct = grossForBar > 0 ? (totalAssets / grossForBar) * 100 : 0;
  const debtBarPct = 100 - assetBarPct;
  const hysaAcc = accs.find(function (a) {
    return String(a.id) === 'hysa';
  });
  const hysaApyDec =
    hysaAcc && Number.isFinite(hysaAcc.apyPct) ? hysaAcc.apyPct / 100 : numOr(plan.hysaApy, 0);
  const hysaInterestYr = hysaBal * hysaApyDec;
  const efundRow = savingsGoalSummaries.find(function (x) {
    return x.id === ID_GOAL_EFUND;
  });
  const efundFallback = numOr(plan.monthlyFixedExpenses, 0) * numOr(plan.efundMonths, 12);
  const efundTarget = efundRow ? efundRow.targetAmount : efundFallback;
  const towardEfund = efundRow ? efundRow.sum : personalSavings;
  const efundGap = efundRow ? efundRow.gap : Math.max(0, efundFallback - personalSavings);
  const efundPct =
    efundTarget > 0 ? Math.min(100, (Math.max(0, towardEfund) / efundTarget) * 100) : 0;
  const buffer =
    plan.monthlyTakeHome -
    plan.monthlyFixedExpenses -
    plan.phase1.ccPayment -
    plan.phase1.hysaDeposit -
    plan.funBudget;
  const budgetParts = [
    plan.monthlyFixedExpenses,
    plan.phase1.ccPayment,
    plan.phase1.hysaDeposit,
    plan.funBudget,
    buffer,
  ];
  const budgetTotal = budgetParts.reduce((a, b) => a + b, 0);
  const pctOfBudget = function (amt) {
    return budgetTotal > 0 ? Math.round((amt / budgetTotal) * 100) : 0;
  };
  const phase2Savings = plan.phase1.ccPayment + plan.phase1.hysaDeposit;
  const eop = endOfPlanLiquid(plan);
  const totalLiquidEndPlan = eop.totalLiquidEndPlan;
  const hysaEndPlan = eop.hysaEndPlan;
  const personalEndPlan = eop.personalEndPlan;

  const monthlyDebtGoal = numOr(plan.phase1 && plan.phase1.ccPayment, 3500);
  const workingYm = getWorkingMonthYm(plan);
  const viewYm = getDashboardViewMonthYm(plan);
  const monthlyDebtPaidAuto = sumPaymentsInYyyyMm(plan, viewYm);
  const monthlyDebtPaid = monthlyDebtPaidAuto;
  const monthlyDebtPct =
    monthlyDebtGoal > 0 ? Math.min(100, (Math.max(0, monthlyDebtPaid) / monthlyDebtGoal) * 100) : 0;
  const monthlyDebtBudgetRemaining = Math.max(0, monthlyDebtGoal - monthlyDebtPaid);
  const dashboardFollowsWorking =
    !(typeof plan.dashboardViewMonthYm === 'string' && /^\d{4}-\d{2}$/.test(plan.dashboardViewMonthYm));

  const payoff = projectDebtPayoffYm(plan, { maxMonths: 600 });
  const debtPayoffYm = payoff.ym;
  const debtPayoffMonthIndex = payoff.monthIndex;
  let debtPayoffWhenLabel = '—';
  let debtPayoffWhenNote = '';
  let debtGoalWhenLine = '';
  if (debts.length === 0) {
    debtPayoffWhenLabel = '—';
    debtPayoffWhenNote = '';
    debtGoalWhenLine = 'Add a debt in Goal 2';
  } else if (totalDebt <= 0) {
    debtPayoffWhenLabel = 'Paid off';
    debtPayoffWhenNote = 'All listed debts at $0.';
    debtGoalWhenLine = 'Paid off';
  } else if (payoff.ym) {
    debtPayoffWhenLabel = monthLabel(payoff.ym);
    debtPayoffWhenNote =
      payoff.monthIndex != null ? '~' + (payoff.monthIndex + 1) + ' months (projected)' : '';
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
    goalHysa: numOr(plan.goalHysa, 0),
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
    savingsGoalSummaries,
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
    debts,
    monthlyDebtGoal,
    monthlyDebtPaidAuto,
    monthlyDebtPaid,
    monthlyDebtPct,
    monthlyDebtBudgetRemaining,
    savingsAccounts: accs,
  };
}
