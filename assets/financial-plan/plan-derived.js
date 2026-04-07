/**
 * Pure derived metrics from a plan object (no DOM).
 */

import { numOr } from './utils.js';
import { getSavingsAccounts } from './savings-accounts.js';
import { projectPayoffTimeline } from './payoff-projection.js';

/** Sum of all debt paymentHistory amounts whose `at` falls in the current calendar month (local). */
export function sumPaymentsThisCalendarMonth(plan) {
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  let sum = 0;
  debts.forEach(function (d) {
    const hist = Array.isArray(d.paymentHistory) ? d.paymentHistory : [];
    hist.forEach(function (p) {
      if (!p || typeof p.at !== 'string') return;
      const dt = new Date(p.at);
      if (!Number.isFinite(dt.getTime())) return;
      if (dt.getFullYear() === y && dt.getMonth() === mo) {
        sum += numOr(p.amount, 0);
      }
    });
  });
  return sum;
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
  const efundTarget = plan.monthlyFixedExpenses * plan.efundMonths;
  const efundGap = efundTarget - personalSavings;
  const efundPct = efundTarget > 0 ? (personalSavings / efundTarget) * 100 : 0;
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
  const monthlyDebtPaidAuto = sumPaymentsThisCalendarMonth(plan);
  const monthlyDebtPaid = monthlyDebtPaidAuto;
  const monthlyDebtPct =
    monthlyDebtGoal > 0 ? Math.min(100, (Math.max(0, monthlyDebtPaid) / monthlyDebtGoal) * 100) : 0;

  return {
    personalSavings,
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
    buffer,
    budgetTotal,
    pctOfBudget,
    phase2Savings,
    totalLiquidEndPlan,
    hysaEndPlan,
    personalEndPlan,
    debtGoalPct,
    debts,
    monthlyDebtGoal,
    monthlyDebtPaidAuto,
    monthlyDebtPaid,
    monthlyDebtPct,
    savingsAccounts: accs,
  };
}
