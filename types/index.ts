/**
 * Core data model types for PennyPath (incremental TS migration).
 *
 * These types are derived from the current JavaScript shapes in `assets/financial-plan/*`.
 * Keep them strict and aligned with real runtime usage.
 */

// --------- Primitive string brands (best-effort, runtime still validates) ----------

/** ISO 8601 date-time string (e.g. `2026-04-21T12:34:56.789Z`). */
export type IsoDateTimeString = string;

/** Calendar date string (`YYYY-MM-DD`). */
export type YyyyMmDd = `${number}-${number}-${number}`;

/** Month string (`YYYY-MM`). */
export type YyyyMm = `${number}-${number}`;

// --------- Shared ledger history ----------

export interface MoneyLedgerItem {
  /** Stable client-generated id (e.g. `ph_...`, `dep_...`). */
  id: string;
  /** Positive dollar amount (the UI enforces non-negative; keep as number here). */
  amount: number;
  /** ISO timestamp. */
  at: IsoDateTimeString;
}

export type PaymentHistoryItem = MoneyLedgerItem;
export type DepositHistoryItem = MoneyLedgerItem;

// --------- Financial Plan models ----------

/** Where this debt sits in the UI: accruing, paid off, or removed from active tracking. */
export type DebtLedgerStatus = 'active' | 'completed' | 'deleted';

export interface Debt {
  id: string;
  name: string;
  /** Current remaining balance. */
  current: number;
  /** Lifetime paid down (used for progress). */
  paidOff: number;
  /** Defaults to active when omitted (legacy plans). */
  ledgerStatus?: DebtLedgerStatus;
  /** APR as a percent (e.g. `22` means 22%). */
  aprPct: number;
  /** Deferred/promo balance (0% while promo active). */
  deferredAmount: number;
  /** Promo end date (`YYYY-MM-DD`) or empty string. */
  deferredExpiresOn: YyyyMmDd | '';
  /** Legacy months remaining, non-negative integer. */
  deferredMonthsRemaining: number;
  /** Optional applied payments (last 30 days shown in UI). */
  paymentHistory: PaymentHistoryItem[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  /** Dollar target for this goal. */
  targetAmount: number;
  /** Optional goal month (`YYYY-MM`) or empty string. */
  goalByYm: YyyyMm | '';
}

export interface SavingsAccount {
  id: string;
  name: string;
  current: number;
  /** APY as a percent (e.g. `3.25` means 3.25%). */
  apyPct: number;
  /** Savings goal ids this account contributes to. */
  goalIds: string[];
  /** Convenience boolean: whether it counts toward the Joint HYSA goal. */
  countTowardsGoal: boolean;
  depositHistory: DepositHistoryItem[];
}

export interface Phase1Budget {
  ccPayment: number;
  hysaDeposit: number;
}

export interface Phase2Budget {
  hysaDeposit: number;
}

export interface InterestNote {
  aprLow: number;
  aprHigh: number;
  monthOneLow: number;
  monthOneHigh: number;
  total8moLow: number;
  total8moHigh: number;
}

export interface PlanLabels {
  hysaGoalByShort: string;
  fullPictureBy: string;
  efundBuildAfter: string;
  goalHysaWhen: string;
  goalDebtWhen: string;
  monthsToCloseEfund: string;
  /** Persisted inside Supabase `financial_plans.labels` JSON. */
  debtsEditorLedgerSegment?: DebtLedgerStatus;
}

/** Monthly budget breakdown row (How We Get There table); synced to legacy plan fields by role. */
export type BudgetCategoryRole = 'expenses' | 'cc' | 'hysa' | 'fun' | 'custom' | 'buffer';

export interface BudgetCategoryRow {
  id: string;
  role: BudgetCategoryRole;
  label: string;
  amount: number;
  emoji?: string;
  chip?: 'red' | 'green';
  /** Accent for amount column */
  amountTone?: 'red' | 'sage' | 'gold' | 'default';
}

export type DebtsEditorSort =
  | 'saved'
  | 'balance'
  | 'balance-desc'
  | 'balance-asc'
  | 'apr'
  | 'apr-desc'
  | 'apr-asc';

export type DebtsProgressSort = DebtsEditorSort | 'paid-desc' | 'paid-asc';

export interface FinancialPlan {
  // Income / payroll
  monthlyTakeHome: number;
  paycheckAmount: number;
  paychecksPerMonth: number;

  // Savings (legacy fields kept in sync with `savingsAccounts`)
  hysaBalance: number;
  /**
   * Legacy HYSA APY as a decimal fraction (e.g. `0.0325` means 3.25%).
   * Source-of-truth for APY is `savingsAccounts[].apyPct` (percent).
   *
   * Kept for older code paths and migrations; code normalizes between the two.
   */
  hysaApy: number;
  joseSavings: number;
  sherlynaSavings: number;

  // Timeline / assumptions
  timelineStart: YyyyMmDd;
  ccApr: number; // decimal fraction (e.g. 0.22)

  // Source-of-truth accounts / debts
  savingsAccounts: SavingsAccount[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];

  // Targets / budgets
  goalHysa: number;
  hysaGoalByYm: YyyyMm | '';
  monthlyFixedExpenses: number;
  efundMonths: number;
  phase1: Phase1Budget;
  phase2: Phase2Budget;
  funBudget: number;

  // Derived/cached display fields (persisted today)
  monthsDebtPayoff: number;
  monthsHysaBuild: number;
  debtFreeBy: string;
  hysaGoalBy: string;
  monthsToDebtFree: number;
  monthsToHysaGoal: number;
  netWorthGoalK: number;
  phase2HysaResultK: number;
  interestNote: InterestNote;
  labels: PlanLabels;

  // UI preferences / working-month state
  debtsEditorSort: DebtsEditorSort;
  debtsProgressSort: DebtsProgressSort;
  workingMonthYm: YyyyMm | '';
  dashboardViewMonthYm: YyyyMm | '';

  /** Increments when a debt first reaches paid-off; survives moving to deleted. */
  debtsPaidOffLifetimeCount?: number;

  /** Which bucket the debts editor dialog is showing (local preference). */
  debtsEditorLedgerSegment?: DebtLedgerStatus;

  /** Optional editable budget breakdown rows (persisted via Supabase `labels` JSON). */
  budgetCategories?: BudgetCategoryRow[];

  // Internal runtime helpers (not persisted consistently)
  _hysaStartingDefault?: number;
}

// --------- Check-ins ----------

export interface CheckInEntry {
  id: string;
  /** `YYYY-MM-DD` */
  date: YyyyMmDd;
  note: string;
}

/** Check-in rows as returned by `window.CheckInService.list()` (includes createdAt). */
export interface CheckInServiceEntry extends CheckInEntry {
  createdAt: IsoDateTimeString;
}

export interface CheckInServiceApi {
  STORAGE_KEY: string;
  list(): CheckInServiceEntry[];
  add(entry: Pick<CheckInEntry, 'date' | 'note'>): CheckInServiceEntry | null;
  remove(id: string): boolean;
  clearAll(): void;
}

// --------- AI outputs / cached payloads ----------

export type AiProvider = 'gemini' | 'claude' | 'chatgpt';

export interface AiPayoffPlanCache {
  /** Markdown content */
  text: string;
  /** Stable fingerprint string derived from plan snapshot */
  fingerprint: string;
  truncated?: boolean;
  at?: IsoDateTimeString;
}

export type FinancialCalendarKind = 'bill' | 'debt';

export interface FinancialCalendarEvent {
  date: YyyyMmDd;
  kind: FinancialCalendarKind;
  label: string;
  /** USD amount; may be null if model omitted it. */
  amount: number | null;
  /** Debt account label; empty string when not provided / not applicable. */
  debtName: string;
}

export interface FinancialCalendarResponse {
  notes: string;
  events: FinancialCalendarEvent[];
}

// --------- Savings goals helpers / derived summaries ----------

/** IDs used throughout the Financial Plan savings-goals module. */
export const ID_GOAL_HYSA = 'goal-hysa' as const;
export const ID_GOAL_EFUND = 'goal-efund' as const;
export const ID_GOAL_PERSONAL = 'goal-personal' as const;

export type SavingsGoalId =
  | typeof ID_GOAL_HYSA
  | typeof ID_GOAL_EFUND
  | typeof ID_GOAL_PERSONAL
  | (string & {});
export interface SavingsGoalSummary {
  id: string;
  name: string;
  targetAmount: number;
  /** Sum of balances that contribute to this goal. */
  sum: number;
  /** 0–100 */
  pct: number;
  /** Remaining amount to target. */
  gap: number;
  goalByYm: YyyyMm | '';
  /** Human label, e.g. `By Jun 2027` or empty. */
  goalByWhen: string;
}

// --------- Plan-derived output ----------

/** Return shape of `derived(plan)` in `assets/financial-plan/plan-derived.js`. */
export interface DerivedPlanMetrics {
  workingMonthYm: YyyyMm;
  workingMonthLabel: string;
  dashboardViewMonthYm: YyyyMm;
  dashboardViewMonthLabel: string;
  viewingDifferentFromWorking: boolean;
  dashboardFollowsWorking: boolean;

  debts: Debt[];
  savingsAccounts: SavingsAccount[];

  goalHysa: number;
  personalSavings: number;
  goalSavingsCurrent: number;
  totalAssets: number;
  netWorth: number;

  debtRounded: number;
  totalDebt: number;
  debtStartTotal: number;
  debtGoalPct: number;
  assetBarPct: number;
  debtBarPct: number;

  hysaInterestYr: number;

  efundTarget: number;
  efundGap: number;
  efundPct: number;
  towardEfund: number;

  savingsGoalSummaries: SavingsGoalSummary[];

  buffer: number;
  budgetTotal: number;
  /** Converts a raw amount into an integer percent of the computed budget. */
  pctOfBudget(amt: number): number;
  phase2Savings: number;
  totalLiquidEndPlan: number;
  hysaEndPlan: number;
  personalEndPlan: number;

  // Monthly debt progress
  monthlyDebtGoal: number;
  monthlyDebtPaidAuto: number;
  monthlyDebtPaid: number;
  monthlyDebtPaidNonNeg: number;
  monthlyDebtPct: number;
  monthlyDebtBudgetRemaining: number;

  // Payoff projection summary
  debtPayoffYm: YyyyMm | '';
  debtPayoffMonthIndex: number | null;
  debtPayoffWhenLabel: string;
  debtPayoffWhenNote: string;
  debtGoalWhenLine: string;

  /** Same as plan field; surfaced for dashboard binding. */
  debtsPaidOffLifetimeCount: number;
}

export interface EndOfPlanLiquidSummary {
  months: number;
  hysaEndPlan: number;
  personalEndPlan: number;
  totalLiquidEndPlan: number;
}

// --------- Storage keys ----------

export interface AiProviderStorageKeys {
  AI_PAYOFF_PLAN_CACHE_LS_KEY: string;
  AI_BILL_CALENDAR_CACHE_LS_KEY: string;
  AI_BILL_CALENDAR_COLUMNS_LS_KEY: string;
}


