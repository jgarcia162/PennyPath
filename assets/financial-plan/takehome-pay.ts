/**
 * Take-home pay: paycheck amount × paychecks per month = monthly take-home.
 * The three stored fields stay consistent so the cover total and the status note match.
 */

import type { FinancialPlan } from '../../types/index.js';
import { createMoneyFormatters, numOr, roundMoney } from './utils';

const { moneyExact } = createMoneyFormatters();

export interface TakeHomeDraft {
  paycheckAmount: number;
  paychecksPerMonth: number;
  monthlyTakeHome: number;
}

export type TakeHomeSource = 'paycheck' | 'monthly';

/** Paychecks-per-month can be fractional (26 paychecks / 12 months ≈ 2.1667). */
export function roundPaycheckCount(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10000) / 10000;
}

export function formatPaycheckCount(n: number): string {
  const rounded = roundPaycheckCount(n);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/**
 * Resolve a consistent draft.
 * A blank count with a dollar amount is treated as one paycheck per month.
 */
export function resolveTakeHome(input: {
  paycheckAmount: number;
  paychecksPerMonth: number;
  monthlyTakeHome: number;
  source: TakeHomeSource;
}): TakeHomeDraft {
  if (input.source === 'monthly') {
    const monthly = roundMoney(Math.max(0, numOr(input.monthlyTakeHome, 0)));
    let count = roundPaycheckCount(Math.max(0, numOr(input.paychecksPerMonth, 0)));
    if (monthly > 0 && count === 0) count = 1;
    const paycheck = count > 0 ? roundMoney(monthly / count) : 0;
    return {
      paycheckAmount: paycheck,
      paychecksPerMonth: count,
      monthlyTakeHome: roundMoney(paycheck * count),
    };
  }
  const paycheck = roundMoney(Math.max(0, numOr(input.paycheckAmount, 0)));
  let count = roundPaycheckCount(Math.max(0, numOr(input.paychecksPerMonth, 0)));
  if (paycheck > 0 && count === 0) count = 1;
  return {
    paycheckAmount: paycheck,
    paychecksPerMonth: count,
    monthlyTakeHome: roundMoney(paycheck * count),
  };
}

/** Values to show in the editor. Trust a stored monthly total when the breakdown does not multiply to it. */
export function draftFromPlan(
  plan: Pick<FinancialPlan, 'paycheckAmount' | 'paychecksPerMonth' | 'monthlyTakeHome'>
): TakeHomeDraft {
  const monthly = roundMoney(Math.max(0, numOr(plan.monthlyTakeHome, 0)));
  const paycheck = roundMoney(Math.max(0, numOr(plan.paycheckAmount, 0)));
  const count = roundPaycheckCount(Math.max(0, numOr(plan.paychecksPerMonth, 0)));
  const product = roundMoney(paycheck * (count > 0 ? count : 1));
  const breakdownMissing = paycheck <= 0 || count <= 0;
  const breakdownMismatch = Math.abs(product - monthly) > 0.009;
  if (monthly > 0 && (breakdownMissing || breakdownMismatch)) {
    return resolveTakeHome({
      paycheckAmount: paycheck,
      paychecksPerMonth: count,
      monthlyTakeHome: monthly,
      source: 'monthly',
    });
  }
  if (paycheck > 0 || count > 0) {
    return resolveTakeHome({
      paycheckAmount: paycheck,
      paychecksPerMonth: count,
      monthlyTakeHome: monthly,
      source: 'paycheck',
    });
  }
  return { paycheckAmount: 0, paychecksPerMonth: 0, monthlyTakeHome: 0 };
}

export function applyTakeHomePay(plan: FinancialPlan, draft: TakeHomeDraft): void {
  plan.paycheckAmount = roundMoney(Math.max(0, draft.paycheckAmount));
  plan.paychecksPerMonth = roundPaycheckCount(Math.max(0, draft.paychecksPerMonth));
  plan.monthlyTakeHome = roundMoney(plan.paycheckAmount * plan.paychecksPerMonth);
}

export function takeHomeStatusNote(
  plan: Pick<FinancialPlan, 'paycheckAmount' | 'paychecksPerMonth' | 'monthlyTakeHome'>
): string {
  const monthly = numOr(plan.monthlyTakeHome, 0);
  const paycheck = numOr(plan.paycheckAmount, 0);
  const count = numOr(plan.paychecksPerMonth, 0);
  if (monthly <= 0 && paycheck <= 0) {
    return 'Edit to set your take-home pay.';
  }
  const unit = count === 1 ? 'paycheck' : 'paychecks';
  return moneyExact(paycheck) + ' × ' + formatPaycheckCount(count) + ' ' + unit + ' per month';
}
