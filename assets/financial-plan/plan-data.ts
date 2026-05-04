/**
 * Default plan snapshot and shared `localStorage` key constants.
 *
 * Converted from `plan-data.js` with no logic changes.
 */

import type {
  DebtsEditorSort,
  DebtsProgressSort,
  FinancialPlan,
  SavingsAccount,
  SavingsGoal,
} from '../../types/index.js';

/** Edit these values — the rest of the page is derived. */
export const PLAN: FinancialPlan = {
  monthlyTakeHome: 7615,
  paycheckAmount: 3807.43,
  paychecksPerMonth: 2,
  hysaBalance: 24000,
  hysaApy: 0.0325,
  timelineStart: '2026-10-01',
  ccApr: 0.22,
  joseSavings: 4103.96,
  sherlynaSavings: 20000,
  savingsAccounts: [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: 24000,
      apyPct: 3.25,
      goalIds: ['goal-hysa', 'goal-efund'],
      countTowardsGoal: true,
      depositHistory: [],
    },
    {
      id: 'jose',
      name: 'Avery — personal',
      current: 4103.96,
      apyPct: 0,
      goalIds: ['goal-efund', 'goal-personal'],
      countTowardsGoal: false,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Jordan — personal',
      current: 20000,
      apyPct: 0,
      goalIds: ['goal-efund', 'goal-personal'],
      countTowardsGoal: false,
      depositHistory: [],
    },
  ],
  debts: [
    {
      id: 'cc',
      name: 'Credit Cards',
      current: 27395.23,
      paidOff: 0,
      aprPct: 0,
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: [],
    },
  ],
  goalHysa: 50000,
  hysaGoalByYm: '2027-06',
  monthlyFixedExpenses: 3000,
  efundMonths: 12,
  phase1: { ccPayment: 3500, hysaDeposit: 500 },
  phase2: { hysaDeposit: 4000 },
  funBudget: 400,
  monthsDebtPayoff: 8,
  monthsHysaBuild: 6,
  debtFreeBy: 'Dec 2026',
  hysaGoalBy: 'Jun 2027',
  monthsToDebtFree: 8,
  monthsToHysaGoal: 15,
  netWorthGoalK: 87,
  phase2HysaResultK: 52,
  interestNote: {
    aprLow: 20,
    aprHigh: 24,
    monthOneLow: 450,
    monthOneHigh: 500,
    total8moLow: 2000,
    total8moHigh: 2200,
  },
  labels: {
    hysaGoalByShort: 'Jun 2027',
    fullPictureBy: 'June 2027',
    efundBuildAfter: 'Build after June 2027',
    goalHysaWhen: 'By June 2027',
    goalDebtWhen: 'By December 2026',
    monthsToCloseEfund: '4–5',
  },
  debtsEditorSort: 'saved',
  debtsProgressSort: 'saved',
  debtsPaidOffLifetimeCount: 0,
  debtsEditorLedgerSegment: 'active',
  workingMonthYm: '',
  dashboardViewMonthYm: '',
  savingsGoals: [
    { id: 'goal-hysa', name: 'Joint HYSA', targetAmount: 50000, goalByYm: '2027-06' },
    { id: 'goal-efund', name: 'Emergency fund', targetAmount: 36000, goalByYm: '' },
    { id: 'goal-personal', name: 'Personal savings', targetAmount: 0, goalByYm: '' },
  ],
};

/** Snapshot for “Reset to original defaults” — keep in sync with PLAN above. */
export const PLAN_DEFAULTS: Pick<
  FinancialPlan,
  'hysaBalance' | 'joseSavings' | 'sherlynaSavings' | 'debtsEditorSort' | 'debtsProgressSort' | 'savingsAccounts' | 'debts' | 'savingsGoals'
> = {
  hysaBalance: 0,
  joseSavings: 0,
  sherlynaSavings: 0,
  debtsEditorSort: 'saved' as DebtsEditorSort,
  debtsProgressSort: 'saved' as DebtsProgressSort,
  savingsAccounts: [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: 0,
      apyPct: 0,
      goalIds: ['goal-hysa'],
      countTowardsGoal: true,
      depositHistory: [],
    },
    {
      id: 'jose',
      name: 'Avery — personal',
      current: 0,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Jordan — personal',
      current: 0,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
  ] as SavingsAccount[],
  debts: [],
  savingsGoals: [
    { id: 'goal-hysa', name: 'Joint HYSA', targetAmount: 0, goalByYm: '' },
    { id: 'goal-efund', name: 'Emergency fund', targetAmount: 0, goalByYm: '' },
    { id: 'goal-personal', name: 'Personal savings', targetAmount: 0, goalByYm: '' },
  ] as SavingsGoal[],
};

export const STORAGE_KEY = 'financial-plan-v3-aggressive.balances' as const;
/** Month wrap-up: one-step undo + optional archives list (JSON strings). */
export const MONTH_WRAP_ROLLBACK_KEY = 'financial-plan-v3-aggressive.month-wrap-rollback' as const;
export const MONTH_WRAP_ARCHIVES_KEY = 'financial-plan-v3-aggressive.month-wrap-archives' as const;
export const TOGGLE_GOAL2_EDITOR_KEY = 'financial-plan-v3-aggressive.goal2-editor-open' as const;
export const TOGGLE_GOAL3_EDITOR_KEY = 'financial-plan-v3-aggressive.goal3-editor-open' as const;
export const BADGES_STORAGE_KEY = 'financial-plan.badges' as const;

/** Shared with History page: sample-data (demo) mode without persisting mock into storage. */
export const DEMO_MODE_STORAGE_KEY = 'financial-plan.historyDemo' as const;

/** Default APR % for a debt when unspecified (new row / missing field). */
export const DEFAULT_DEBT_APR_PCT = 0 as const;
/** Default APY % for a savings account when unspecified. */
export const DEFAULT_SAVINGS_APY_PCT = 0 as const;

const HYSA_STARTING_DEFAULT = PLAN.hysaBalance;
PLAN._hysaStartingDefault = HYSA_STARTING_DEFAULT;

