/**
 * Savings accounts list + legacy PLAN.hysaBalance / joseSavings / sherlynaSavings sync.
 */

import type { FinancialPlan, SavingsAccount } from '../../types/index.js';
import { numOr } from './utils';
import { ID_GOAL_HYSA } from './savings-goals';

export function getSavingsAccounts(plan: FinancialPlan): SavingsAccount[] {
  if (Array.isArray((plan as any).savingsAccounts) && (plan as any).savingsAccounts.length) {
    return (plan as any).savingsAccounts as SavingsAccount[];
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
      name: 'Jose — personal',
      current: numOr(plan.joseSavings, 0),
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Sherlyna — personal',
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
  plan.hysaBalance = sumId('hysa');
  plan.joseSavings = sumId('jose');
  plan.sherlynaSavings = sumId('sher');
  const hysaA = accs.find(function (x: SavingsAccount) {
    return String(x.id) === 'hysa';
  });
  if (hysaA && Number.isFinite(hysaA.apyPct)) {
    plan.hysaApy = Math.max(0, hysaA.apyPct / 100);
  }
}
