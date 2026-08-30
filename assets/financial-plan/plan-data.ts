/**
 * Default (blank) plan snapshot and shared `localStorage` key constants.
 *
 * The in-memory `PLAN` starts empty. Sample/demo data lives in `dev-mock-storage`
 * and is labeled as sample when that mode is on.
 */

import type {
  DebtsEditorSort,
  DebtsProgressSort,
  FinancialPlan,
} from '../../types/index.js';

/** Fresh empty plan — no balances, debts, or dummy household names. */
export function createBlankFinancialPlan(): FinancialPlan {
  return {
    monthlyTakeHome: 0,
    paycheckAmount: 0,
    paychecksPerMonth: 0,
    hysaBalance: 0,
    hysaApy: 0,
    timelineStart: '',
    ccApr: 0,
    joseSavings: 0,
    sherlynaSavings: 0,
    savingsAccounts: [],
    debts: [],
    goalHysa: 0,
    hysaGoalByYm: '',
    monthlyFixedExpenses: 0,
    efundMonths: 0,
    phase1: { ccPayment: 0, hysaDeposit: 0 },
    phase2: { hysaDeposit: 0 },
    funBudget: 0,
    monthsDebtPayoff: 0,
    monthsHysaBuild: 0,
    debtFreeBy: '',
    hysaGoalBy: '',
    monthsToDebtFree: 0,
    monthsToHysaGoal: 0,
    netWorthGoalK: 0,
    phase2HysaResultK: 0,
    interestNote: {
      aprLow: 0,
      aprHigh: 0,
      monthOneLow: 0,
      monthOneHigh: 0,
      total8moLow: 0,
      total8moHigh: 0,
    },
    labels: {
      hysaGoalByShort: '',
      fullPictureBy: '',
      efundBuildAfter: '',
      goalHysaWhen: '',
      goalDebtWhen: '',
      monthsToCloseEfund: '',
    },
    debtsEditorSort: 'saved' as DebtsEditorSort,
    debtsProgressSort: 'saved' as DebtsProgressSort,
    debtsPaidOffLifetimeCount: 0,
    debtsEditorLedgerSegment: 'active',
    workingMonthYm: '',
    dashboardViewMonthYm: '',
    savingsGoals: [],
  };
}

/** Mutated singleton used by the Financial Plan UI. */
export const PLAN: FinancialPlan = createBlankFinancialPlan();

/**
 * Snapshot for “Reset all data” / editor draft fallbacks.
 * Keep in sync with {@link createBlankFinancialPlan}.
 */
export const PLAN_DEFAULTS: Pick<
  FinancialPlan,
  | 'hysaBalance'
  | 'joseSavings'
  | 'sherlynaSavings'
  | 'debtsEditorSort'
  | 'debtsProgressSort'
  | 'debtsPaidOffLifetimeCount'
  | 'debtsEditorLedgerSegment'
  | 'savingsAccounts'
  | 'debts'
  | 'savingsGoals'
> = {
  hysaBalance: 0,
  joseSavings: 0,
  sherlynaSavings: 0,
  debtsEditorSort: 'saved' as DebtsEditorSort,
  debtsProgressSort: 'saved' as DebtsProgressSort,
  debtsPaidOffLifetimeCount: 0,
  debtsEditorLedgerSegment: 'active',
  savingsAccounts: [],
  debts: [],
  savingsGoals: [],
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

PLAN._hysaStartingDefault = 0;
