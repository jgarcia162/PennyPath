import { describe, it, expect } from 'vitest';
import type { FinancialPlan } from '../../types/index.js';
import { applyBlankFinancialBalances, applyPlanPayloadFromObject } from './persistence.js';
import { createBlankFinancialPlan } from './plan-data.js';
import { getSavingsAccounts } from './savings-accounts.js';
import { ensureSavingsGoals } from './savings-goals.js';
import { sampleDataLabel } from './dev-mock-storage.js';

function filledPlan(): FinancialPlan {
  const plan = createBlankFinancialPlan();
  plan.monthlyTakeHome = 7615;
  plan.goalHysa = 50000;
  plan.debts = [
    {
      id: 'cc',
      name: 'Credit Cards',
      current: 100,
      paidOff: 50,
      aprPct: 22,
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      ledgerStatus: 'deleted',
      paymentHistory: [{ id: 'ph1', amount: 10, at: '2026-05-01T12:00:00.000Z' }],
    },
  ];
  plan.savingsAccounts = [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: 24000,
      apyPct: 3.25,
      goalIds: ['goal-hysa'],
      countTowardsGoal: true,
      depositHistory: [],
    },
  ];
  plan.savingsGoals = [{ id: 'goal-hysa', name: 'Joint HYSA', targetAmount: 50000, goalByYm: '2027-06' }];
  (plan as any).budgetCategories = [{ id: 'custom-1', role: 'custom', label: 'Gym', amount: 80 }];
  return plan;
}

describe('applyBlankFinancialBalances', () => {
  it('clears deleted debts, savings, goals, income, and custom budget rows', () => {
    const plan = filledPlan();
    applyBlankFinancialBalances(plan);
    expect(plan.debts).toEqual([]);
    expect(plan.savingsAccounts).toEqual([]);
    expect(plan.savingsGoals).toEqual([]);
    expect(plan.monthlyTakeHome).toBe(0);
    expect(plan.goalHysa).toBe(0);
    expect(plan.budgetCategories).toBeUndefined();
    expect(getSavingsAccounts(plan)).toEqual([]);
  });
});

describe('applyPlanPayloadFromObject empty collections', () => {
  it('keeps an explicit empty savingsAccounts list instead of fabricating dummy accounts', () => {
    const plan = filledPlan();
    applyPlanPayloadFromObject(plan, {
      savingsAccounts: [],
      debts: [],
      savingsGoals: [],
      hysaBalance: 24000,
      joseSavings: 4103,
    });
    expect(plan.savingsAccounts).toEqual([]);
    expect(plan.debts).toEqual([]);
    expect(plan.savingsGoals).toEqual([]);
    expect(getSavingsAccounts(plan)).toEqual([]);
  });
});

describe('ensureSavingsGoals', () => {
  it('does not re-seed goals when the list is explicitly empty', () => {
    const plan = createBlankFinancialPlan();
    plan.savingsGoals = [];
    plan.goalHysa = 50000;
    ensureSavingsGoals(plan);
    expect(plan.savingsGoals).toEqual([]);
    expect(plan.goalHysa).toBe(0);
  });
});

describe('sampleDataLabel', () => {
  it('marks demo names as sample', () => {
    expect(sampleDataLabel('Avery — personal')).toBe('Avery — personal (sample)');
    expect(sampleDataLabel('Joint HYSA (sample)')).toBe('Joint HYSA (sample)');
  });
});
