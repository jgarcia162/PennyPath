/**
 * Savings accounts list + legacy PLAN.hysaBalance / joseSavings / sherlynaSavings sync.
 */

import type { FinancialPlan, SavingsAccount } from '../../types/index.js';
import { numOr } from './utils';
import { accountContributesToGoal, ID_GOAL_HYSA, sumBalancesTowardGoal } from './savings-goals';
import { isSavingsLedgerActive } from './savings-ledger';

/** True when the account's full balance counts toward the Joint HYSA goal. */
export function isJointHysaAccount(acc: unknown): boolean {
  return accountContributesToGoal(acc, ID_GOAL_HYSA);
}

/** Sum of active account balances linked to Joint HYSA (not hardcoded `id === 'hysa'`). */
export function sumJointHysaBalance(accs: SavingsAccount[]): number {
  return sumBalancesTowardGoal(accs || [], ID_GOAL_HYSA);
}

/** Balance-weighted APY % across joint-linked accounts (falls back to first joint APY). */
export function weightedJointHysaApyPct(accs: SavingsAccount[]): number {
  const joint = (accs || []).filter(isJointHysaAccount);
  let weighted = 0;
  let total = 0;
  joint.forEach(function (a: SavingsAccount) {
    const cur = numOr(a.current, 0);
    weighted += cur * numOr(a.apyPct, 0);
    total += cur;
  });
  if (total > 0) return weighted / total;
  return joint.length ? numOr(joint[0].apyPct, 0) : 0;
}

export function getSavingsAccounts(plan: FinancialPlan): SavingsAccount[] {
  if (Array.isArray((plan as any).savingsAccounts)) {
    return ((plan as any).savingsAccounts as SavingsAccount[]).filter(isSavingsLedgerActive);
  }
  return [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: numOr(plan.hysaBalance, 0),
      apyPct: numOr(plan.hysaApy, 0) * 100,
      goalIds: [ID_GOAL_HYSA],
      countTowardsGoal: true,
      depositHistory: [],
    },
    {
      id: 'jose',
      name: 'Personal savings',
      current: numOr(plan.joseSavings, 0),
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Personal savings 2',
      current: numOr(plan.sherlynaSavings, 0),
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
  ];
}

/** Keep legacy numeric fields aligned for payoff timeline, badges, and older code paths. */
export function syncLegacySavingsFromAccounts(plan: FinancialPlan): void {
  const accs = getSavingsAccounts(plan);
  const sumId = function (id: string): number {
    const a = accs.find(function (x: SavingsAccount) {
      return String(x.id) === id;
    });
    return a ? numOr(a.current, 0) : 0;
  };
  plan.hysaBalance = sumJointHysaBalance(accs);
  plan.joseSavings = sumId('jose');
  plan.sherlynaSavings = sumId('sher');
  const apyPct = weightedJointHysaApyPct(accs);
  if (Number.isFinite(apyPct)) {
    plan.hysaApy = Math.max(0, apyPct / 100);
  }
}
