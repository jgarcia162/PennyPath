import { describe, it, expect } from 'vitest';
import type { FinancialPlan, SavingsAccount } from '../../types/index.js';
import {
  syncLegacySavingsFromAccounts,
  sumJointHysaBalance,
  isJointHysaAccount,
  weightedJointHysaApyPct,
} from './savings-accounts';
import { ID_GOAL_HYSA } from './savings-goals';

function acc(partial: Partial<SavingsAccount> & Pick<SavingsAccount, 'id' | 'current'>): SavingsAccount {
  return {
    name: partial.name || partial.id,
    apyPct: partial.apyPct ?? 0,
    goalIds: partial.goalIds ?? [],
    countTowardsGoal: partial.countTowardsGoal ?? false,
    depositHistory: [],
    ...partial,
  };
}

describe('joint HYSA balance from linked accounts', () => {
  it('sums every account linked to Joint HYSA, not only id hysa', () => {
    const accounts = [
      acc({ id: 's_new', name: 'Joint Savings', current: 4200, apyPct: 4.25, goalIds: [ID_GOAL_HYSA], countTowardsGoal: true }),
      acc({ id: 'personal', name: 'Brokerage', current: 800, goalIds: [] }),
    ];
    expect(sumJointHysaBalance(accounts)).toBe(4200);
    expect(isJointHysaAccount(accounts[0])).toBe(true);
    expect(isJointHysaAccount(accounts[1])).toBe(false);

    const plan = { savingsAccounts: accounts, hysaBalance: 0, hysaApy: 0, joseSavings: 0, sherlynaSavings: 0 } as FinancialPlan;
    syncLegacySavingsFromAccounts(plan);
    expect(plan.hysaBalance).toBe(4200);
    expect(plan.hysaApy).toBeCloseTo(0.0425);
  });

  it('keeps id=hysa working when that account is still the joint row', () => {
    const accounts = [acc({ id: 'hysa', current: 1500, apyPct: 3, goalIds: [ID_GOAL_HYSA], countTowardsGoal: true })];
    const plan = { savingsAccounts: accounts, hysaBalance: 0, hysaApy: 0, joseSavings: 0, sherlynaSavings: 0 } as FinancialPlan;
    syncLegacySavingsFromAccounts(plan);
    expect(plan.hysaBalance).toBe(1500);
    expect(weightedJointHysaApyPct(accounts)).toBe(3);
  });

  it('does not treat an unlinked id=hysa rename as joint when goal is unchecked', () => {
    const accounts = [acc({ id: 'hysa', current: 999, goalIds: [], countTowardsGoal: false })];
    expect(sumJointHysaBalance(accounts)).toBe(0);
  });
});
