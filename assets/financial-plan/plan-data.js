/**
 * Default plan snapshot and shared `localStorage` key constants.
 *
 * Edit `PLAN` for the shipped defaults; `PLAN_DEFAULTS` must stay aligned for “reset” flows.
 * Other modules import keys from here so string literals are not scattered across the repo.
 * Check-in persistence uses the same key string in `assets/checkin-service.js` (classic script).
 */

/** Edit these values — the rest of the page is derived. */
export const PLAN = {
  monthlyTakeHome: 7615,
  paycheckAmount: 3807.43,
  paychecksPerMonth: 2,
  hysaBalance: 24000,
  hysaApy: 0.0325,
  timelineStart: '2026-10-01',
  ccApr: 0.22,
  joseSavings: 4103.96,
  sherlynaSavings: 20000,
  /**
   * Savings accounts (source of truth). Legacy hysaBalance / joseSavings / sherlynaSavings stay synced.
   * depositHistory: [{ id, amount, at: ISO }] — log deposits like debt payments.
   */
  /**
   * apyPct: APY as a percent (e.g. 3.25 = 3.25%), same idea as aprPct on debts.
   */
  savingsAccounts: [
    { id: 'hysa', name: 'Joint Savings', current: 24000, apyPct: 3.25, depositHistory: [] },
    { id: 'jose', name: 'Jose — personal', current: 4103.96, apyPct: 0, depositHistory: [] },
    { id: 'sher', name: 'Sherlyna — personal', current: 20000, apyPct: 0, depositHistory: [] },
  ],
  /**
   * Debts list.
   * - current: current balance remaining
   * - paidOff: amount you’ve already paid off (used for progress)
   * - aprPct: APR as a percent (e.g. 0 = 0%, 22 = 22%)
   * - deferredAmount: promo balance that accrues 0% while deferredExpiresOn is in the future
   * - deferredExpiresOn: YYYY-MM-DD (promo end date)
   * - deferredMonthsRemaining: (legacy) months left for 0% promo (integer)
   * - paymentHistory: optional [{ id, amount, at: ISO }] for applied payments (last 30 days shown in Goal 2)
   *
   * Progress for each debt is paidOff / (current + paidOff).
   */
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
  /** Goal 2 debts editor row order (independent of progress cards). */
  debtsEditorSort: 'saved',
  /** Goal 2 per-debt progress cards order; includes `paid-desc` | `paid-asc` (lifetime paid toward debt). */
  debtsProgressSort: 'saved',
};

/** Snapshot for “Reset to original defaults” — keep in sync with PLAN above. */
export const PLAN_DEFAULTS = {
  hysaBalance: 0,
  joseSavings: 0,
  sherlynaSavings: 0,
  debtsEditorSort: 'saved',
  debtsProgressSort: 'saved',
  savingsAccounts: [
    { id: 'hysa', name: 'Joint Savings', current: 0, apyPct: 0, depositHistory: [] },
    { id: 'jose', name: 'Jose — personal', current: 0, apyPct: 0, depositHistory: [] },
    { id: 'sher', name: 'Sherlyna — personal', current: 0, apyPct: 0, depositHistory: [] },
  ],
  debts: [],
};

export const STORAGE_KEY = 'financial-plan-v3-aggressive.balances';
export const TOGGLE_GOAL2_EDITOR_KEY = 'financial-plan-v3-aggressive.goal2-editor-open';
export const TOGGLE_GOAL3_EDITOR_KEY = 'financial-plan-v3-aggressive.goal3-editor-open';
export const BADGES_STORAGE_KEY = 'financial-plan.badges';

/** Shared with History page: sample-data (demo) mode without persisting mock into storage. */
export const DEMO_MODE_STORAGE_KEY = 'financial-plan.historyDemo';

/** Default APR % for a debt when unspecified (new row / missing field). */
export const DEFAULT_DEBT_APR_PCT = 0;
/** Default APY % for a savings account when unspecified. */
export const DEFAULT_SAVINGS_APY_PCT = 0;

const HYSA_STARTING_DEFAULT = PLAN.hysaBalance;
PLAN._hysaStartingDefault = HYSA_STARTING_DEFAULT;
