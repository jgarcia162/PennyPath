/**
 * Whether the plan has saved balances worth showing in personalized / derived UI.
 */

import { numOr } from './utils';
import { getSavingsAccounts } from './savings-accounts';

/** True if there is at least one debt row or any savings balance &gt; 0. */
export function hasBalanceDataForProjections(plan) {
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  if (debts.length > 0) return true;
  const accs = getSavingsAccounts(plan);
  return accs.some(function (a) {
    return numOr(a.current, 0) > 0;
  });
}

/** True if any debt still has a remaining balance (for interest copy). */
export function hasDebtBalanceForInterest(plan) {
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  return debts.some(function (d) {
    return numOr(d.current, 0) > 0;
  });
}

/** True if Goal 2 has at least one debt row (for monthly debt tracker visibility). */
export function hasDebtsOnFile(plan) {
  const debts = Array.isArray(plan.debts) ? plan.debts : [];
  return debts.length > 0;
}
