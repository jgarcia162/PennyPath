/**
 * LocalStorage load/save + debt / savings normalization for persisted rows.
 *
 * Converted from `persistence.js` with no logic changes.
 */

import type {
  Debt,
  DebtsEditorSort,
  DebtsProgressSort,
  DepositHistoryItem,
  FinancialPlan,
  PaymentHistoryItem,
  SavingsAccount,
  SavingsGoal,
  YyyyMm,
} from '../../types/index.js';
import {
  PLAN,
  PLAN_DEFAULTS,
  DEFAULT_DEBT_APR_PCT,
  DEFAULT_SAVINGS_APY_PCT,
  DEMO_MODE_STORAGE_KEY,
  STORAGE_KEY,
} from './plan-data';
import { getRepositories } from '../../lib/repositories';
import type { Repositories } from '../../lib/repositories/types';
import { numOr } from './utils';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { yyyyMmFromDate } from './monthly-activity';
import { ID_GOAL_HYSA, ensureSavingsGoals, normalizeSavingsGoalRow } from './savings-goals';
import { normalizeLedgerStatus } from './debt-ledger';
import { debtLedgerKind, normalizeLedgerMemo, savingsLedgerKind } from './ledger-utils';
import { isTrialSessionActive } from '../../lib/trial/trial-session';

let lastPlanSaveError: string | null = null;

export function getLastPlanSaveError(): string | null {
  return lastPlanSaveError;
}

function notePlanSaveError(err: unknown): void {
  const msg =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? String((err as { message: string }).message)
      : err != null
        ? String(err)
        : 'Unknown error';
  lastPlanSaveError = msg;
}

function clearPlanSaveError(): void {
  lastPlanSaveError = null;
}

async function persistDebtsToSupabase(repos: Repositories): Promise<void> {
  const existingDebts = await repos.debtRepository.list();
  const nextDebtIds = new Set((PLAN as any).debts ? (PLAN as any).debts.map((d: any) => String(d.id)) : []);
  await Promise.all(
    (existingDebts || [])
      .filter((d) => d && !nextDebtIds.has(String(d.id)))
      .map((d) => repos.debtRepository.remove(String(d.id)))
  );
  const debts = Array.isArray((PLAN as any).debts) ? (PLAN as any).debts : [];
  for (const debt of debts) {
    await repos.debtRepository.update(debt);
    const ph = Array.isArray(debt.paymentHistory) ? debt.paymentHistory : [];
    await repos.debtRepository.syncPayments(
      String(debt.id),
      ph.map(function (p: PaymentHistoryItem) {
        return {
          id: String(p.id),
          amount: Number(p.amount),
          at: String(p.at),
          kind: debtLedgerKind(p.kind),
          memo: normalizeLedgerMemo(p.memo),
        };
      })
    );
  }
}

async function persistSavingsToSupabase(repos: Repositories): Promise<void> {
  const existingAccounts = await repos.savingsAccountRepository.list();
  const nextAccIds = new Set(
    (PLAN as any).savingsAccounts ? (PLAN as any).savingsAccounts.map((a: any) => String(a.id)) : []
  );
  await Promise.all(
    (existingAccounts || [])
      .filter((a) => a && !nextAccIds.has(String(a.id)))
      .map((a) => repos.savingsAccountRepository.remove(String(a.id)))
  );
  const accounts = Array.isArray((PLAN as any).savingsAccounts) ? (PLAN as any).savingsAccounts : [];
  for (const acc of accounts) {
    await repos.savingsAccountRepository.update(acc);
    const dh = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    await repos.savingsAccountRepository.syncDeposits(
      String(acc.id),
      dh.map(function (d: DepositHistoryItem) {
        return {
          id: String(d.id),
          amount: Number(d.amount),
          at: String(d.at),
          kind: savingsLedgerKind(d.kind),
          memo: normalizeLedgerMemo(d.memo),
        };
      })
    );
  }
  await repos.savingsGoalRepository.save(Array.isArray((PLAN as any).savingsGoals) ? (PLAN as any).savingsGoals : []);
}

function safeReadLocalPlanPayload(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function safeWriteLocalPlanPayload(plan: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan || {}));
  } catch {}
}

/** Avoid sharing mutable row objects with persisted payload snapshots. */
function cloneBudgetCategoryRowsFromPayload(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(function (r: any) {
    if (!r || typeof r !== 'object') return r;
    return {
      id: String(r.id || ''),
      role: r.role,
      label: String(r.label || ''),
      amount: numOr(r.amount, 0),
      emoji: typeof r.emoji === 'string' ? r.emoji : undefined,
      chip: r.chip === 'red' || r.chip === 'green' ? r.chip : undefined,
      amountTone:
        r.amountTone === 'red' || r.amountTone === 'sage' || r.amountTone === 'gold' || r.amountTone === 'default'
          ? r.amountTone
          : undefined,
    };
  });
}

function normalizeDebtsEditorSortForStorage(sort: unknown): string {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return (sort as any) || 'saved';
}

function normalizeDebtsProgressSortForStorage(sort: unknown): string {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return (sort as any) || 'saved';
}

export function normalizePaymentHistory(d: unknown): PaymentHistoryItem[] {
  const o = d as any;
  if (!o || !Array.isArray(o.paymentHistory)) return [];
  return o.paymentHistory
    .filter(function (p: any) {
      return p && typeof p === 'object' && Number.isFinite(Number(p.amount)) && typeof p.at === 'string';
    })
    .map(function (p: any) {
      const amt = Math.max(0, Number(p.amount));
      return {
        id: String(p.id || ''),
        amount: amt,
        at: String(p.at),
        kind: debtLedgerKind(p.kind),
        memo: normalizeLedgerMemo(p.memo),
      };
    });
}

export function newPaymentId(): string {
  return 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function newChargeId(): string {
  return 'ch_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeDepositHistory(acc: unknown): DepositHistoryItem[] {
  const o = acc as any;
  if (!o || !Array.isArray(o.depositHistory)) return [];
  return o.depositHistory
    .filter(function (p: any) {
      return p && typeof p === 'object' && Number.isFinite(Number(p.amount)) && typeof p.at === 'string';
    })
    .map(function (p: any) {
      const amt = Math.max(0, Number(p.amount));
      return {
        id: String(p.id || ''),
        amount: amt,
        at: String(p.at),
        kind: savingsLedgerKind(p.kind),
        memo: normalizeLedgerMemo(p.memo),
      };
    });
}

export function newDepositId(): string {
  return 'dep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function newWithdrawalId(): string {
  return 'wd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function normalizeSavingsAccount(a: unknown): SavingsAccount | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as any;
  const id = String(o.id || Math.random().toString(36).slice(2));
  let apyPct: number;
  if ('apyPct' in o && Number.isFinite(o.apyPct)) {
    apyPct = o.apyPct;
  } else if (id === 'hysa') {
    apyPct = numOr((PLAN as any).hysaApy, 0) * 100;
  } else {
    apyPct = DEFAULT_SAVINGS_APY_PCT;
  }
  apyPct = Math.max(0, numOr(apyPct, 0));
  let goalIds: string[] = [];
  if (Array.isArray(o.goalIds) && o.goalIds.length) {
    goalIds = o.goalIds.map(String).filter(Boolean);
  } else if (typeof o.countTowardsGoal === 'boolean' && o.countTowardsGoal) {
    goalIds = [ID_GOAL_HYSA];
  }
  const countTowardsGoal = goalIds.indexOf(ID_GOAL_HYSA) >= 0;
  const row: SavingsAccount = {
    id: id,
    name: String(o.name || 'Account'),
    current: numOr(o.current, 0),
    apyPct: apyPct,
    goalIds: goalIds,
    countTowardsGoal: countTowardsGoal,
    depositHistory: normalizeDepositHistory(o),
  };
  if (o.ledgerStatus === 'deleted') {
    row.ledgerStatus = 'deleted';
  }
  return row;
}

function migrateLegacySavingsFromJson(o: any): SavingsAccount[] {
  const hysaApyPct = typeof o.hysaApy === 'number' && Number.isFinite(o.hysaApy) ? o.hysaApy * 100 : 3.25;
  return [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: typeof o.hysaBalance === 'number' && Number.isFinite(o.hysaBalance) ? o.hysaBalance : 0,
      apyPct: hysaApyPct,
      goalIds: [ID_GOAL_HYSA],
      countTowardsGoal: true,
      depositHistory: [],
    },
    {
      id: 'jose',
      name: 'Avery — personal',
      current: typeof o.joseSavings === 'number' && Number.isFinite(o.joseSavings) ? o.joseSavings : 0,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Jordan — personal',
      current: typeof o.sherlynaSavings === 'number' && Number.isFinite(o.sherlynaSavings) ? o.sherlynaSavings : 0,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: [],
    },
  ];
}

/** Mutate plan to empty debts + zeroed default savings accounts (fresh start). */
export function applyBlankFinancialBalances(plan: FinancialPlan): void {
  (plan as any).debts = [];
  (plan as any).debtsEditorSort = (PLAN_DEFAULTS as any).debtsEditorSort || 'saved';
  (plan as any).debtsProgressSort = (PLAN_DEFAULTS as any).debtsProgressSort || 'saved';
  (plan as any).debtsPaidOffLifetimeCount = 0;
  (plan as any).debtsEditorLedgerSegment = 'active';
  (plan as any).workingMonthYm = yyyyMmFromDate(new Date()) as YyyyMm;
  (plan as any).dashboardViewMonthYm = '';
  (plan as any).savingsGoals = JSON.parse(JSON.stringify((PLAN_DEFAULTS as any).savingsGoals));
  (plan as any).savingsAccounts = JSON.parse(JSON.stringify((PLAN_DEFAULTS as any).savingsAccounts));
  (plan as any).hysaBalance = (PLAN_DEFAULTS as any).hysaBalance;
  (plan as any).joseSavings = (PLAN_DEFAULTS as any).joseSavings;
  (plan as any).sherlynaSavings = (PLAN_DEFAULTS as any).sherlynaSavings;
  syncLegacySavingsFromAccounts(plan as any);
  (plan as any)._hysaStartingDefault = 0;
}

export function isFinancialPlanDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

/**
 * Apply a persisted or mock balances payload to a plan object (same shape as savePlanOverrides output).
 */
export function applyPlanPayloadFromObject(plan: FinancialPlan, o: unknown): void {
  const payload = o as any;
  if (!plan || !payload || typeof payload !== 'object') return;
  if (typeof payload.goalHysa === 'number' && Number.isFinite(payload.goalHysa)) {
    (plan as any).goalHysa = payload.goalHysa;
  }
  if (typeof payload.hysaGoalByYm === 'string') {
    (plan as any).hysaGoalByYm = payload.hysaGoalByYm;
  }
  if (typeof payload.hysaGoalBy === 'string') {
    (plan as any).hysaGoalBy = payload.hysaGoalBy;
  }
  if (typeof payload.workingMonthYm === 'string' && /^\d{4}-\d{2}$/.test(payload.workingMonthYm)) {
    (plan as any).workingMonthYm = payload.workingMonthYm;
  }
  if (typeof payload.dashboardViewMonthYm === 'string' && /^\d{4}-\d{2}$/.test(payload.dashboardViewMonthYm)) {
    (plan as any).dashboardViewMonthYm = payload.dashboardViewMonthYm;
  } else if (payload.dashboardViewMonthYm === '' || payload.dashboardViewMonthYm == null) {
    (plan as any).dashboardViewMonthYm = '';
  }
  if (payload.labels && typeof payload.labels === 'object') {
    if (!(plan as any).labels) (plan as any).labels = {};
    ['hysaGoalByShort', 'goalHysaWhen'].forEach(function (k) {
      if (typeof payload.labels[k] === 'string') (plan as any).labels[k] = payload.labels[k];
    });
    const lb = payload.labels as { budgetCategories?: unknown };
    if (Array.isArray(lb.budgetCategories)) (plan as any).budgetCategories = cloneBudgetCategoryRowsFromPayload(lb.budgetCategories);
  }
  if (Array.isArray((payload as any).budgetCategories)) {
    (plan as any).budgetCategories = cloneBudgetCategoryRowsFromPayload((payload as any).budgetCategories);
  }
  ['hysaBalance', 'joseSavings', 'sherlynaSavings'].forEach(function (k) {
    if (typeof payload[k] === 'number' && Number.isFinite(payload[k])) (plan as any)[k] = payload[k];
  });
  if (typeof payload.debtsEditorSort === 'string') {
    const s = payload.debtsEditorSort;
    const allowed =
      s === 'saved' ||
      s === 'balance' ||
      s === 'balance-desc' ||
      s === 'balance-asc' ||
      s === 'apr' ||
      s === 'apr-desc' ||
      s === 'apr-asc';
    if (allowed) {
      if (s === 'balance') (plan as any).debtsEditorSort = 'balance-desc';
      else if (s === 'apr') (plan as any).debtsEditorSort = 'apr-desc';
      else (plan as any).debtsEditorSort = s as DebtsEditorSort;
    }
  }
  if (typeof payload.debtsProgressSort === 'string') {
    const s = payload.debtsProgressSort;
    const allowed =
      s === 'saved' ||
      s === 'balance' ||
      s === 'balance-desc' ||
      s === 'balance-asc' ||
      s === 'apr' ||
      s === 'apr-desc' ||
      s === 'apr-asc' ||
      s === 'paid-desc' ||
      s === 'paid-asc';
    if (allowed) {
      if (s === 'balance') (plan as any).debtsProgressSort = 'balance-desc';
      else if (s === 'apr') (plan as any).debtsProgressSort = 'apr-desc';
      else (plan as any).debtsProgressSort = s as DebtsProgressSort;
    }
  }
  if (Array.isArray(payload.savingsGoals) && payload.savingsGoals.length) {
    (plan as any).savingsGoals = payload.savingsGoals.map(normalizeSavingsGoalRow).filter(Boolean) as SavingsGoal[];
  }
  if (typeof payload.debtsPaidOffLifetimeCount === 'number' && Number.isFinite(payload.debtsPaidOffLifetimeCount)) {
    (plan as any).debtsPaidOffLifetimeCount = Math.max(0, Math.floor(payload.debtsPaidOffLifetimeCount));
  }
  if (typeof payload.debtsEditorLedgerSegment === 'string') {
    const s = payload.debtsEditorLedgerSegment;
    if (s === 'completed') {
      (plan as any).debtsEditorLedgerSegment = 'completed';
    } else {
      (plan as any).debtsEditorLedgerSegment = 'active';
    }
  }
  if (Array.isArray(payload.debts)) {
    (plan as any).debts = payload.debts
      .filter(function (d: any) {
        return d && typeof d === 'object';
      })
      .map(function (d: any) {
        let ledgerStatus = normalizeLedgerStatus(d.ledgerStatus);
        const current = Math.max(0, numOr(d.current, 0));
        const paidOff = Math.max(0, numOr(d.paidOff, 0));
        const histNorm = normalizePaymentHistory(d);
        const hasAnyPayments = histNorm.some(function (p) {
          return debtLedgerKind(p.kind) === 'payment';
        });
        if (!d.ledgerStatus && current <= 0 && (paidOff > 0 || hasAnyPayments)) {
          ledgerStatus = 'completed';
        }
        const row: Debt = {
          id: String(d.id || Math.random().toString(36).slice(2)),
          name: String(d.name || 'Debt'),
          current: current,
          paidOff: paidOff,
          aprPct: numOr(d.aprPct, DEFAULT_DEBT_APR_PCT),
          deferredAmount: Math.max(0, numOr(d.deferredAmount, 0)),
          deferredExpiresOn: typeof d.deferredExpiresOn === 'string' ? d.deferredExpiresOn : '',
          deferredMonthsRemaining: Number.isFinite(d.deferredMonthsRemaining)
            ? Math.max(0, Math.floor(d.deferredMonthsRemaining))
            : 0,
          paymentHistory: normalizePaymentHistory(d),
        };
        if (ledgerStatus === 'completed' || ledgerStatus === 'deleted') {
          (row as any).ledgerStatus = ledgerStatus;
        }
        return row;
      });
    const debtsArr = (plan as any).debts as Debt[];
    let lifetime = numOr((plan as any).debtsPaidOffLifetimeCount, 0);
    const completedN = debtsArr.filter(function (x: Debt) {
      return normalizeLedgerStatus(x && x.ledgerStatus) === 'completed';
    }).length;
    if (lifetime < completedN) lifetime = completedN;
    (plan as any).debtsPaidOffLifetimeCount = lifetime;
  }
  if (Array.isArray(payload.savingsAccounts) && payload.savingsAccounts.length) {
    (plan as any).savingsAccounts = payload.savingsAccounts.map(normalizeSavingsAccount).filter(Boolean) as SavingsAccount[];
  } else {
    (plan as any).savingsAccounts = migrateLegacySavingsFromJson(payload);
  }
  syncLegacySavingsFromAccounts(plan as any);
  if (typeof (plan as any).workingMonthYm !== 'string' || !/^\d{4}-\d{2}$/.test((plan as any).workingMonthYm)) {
    (plan as any).workingMonthYm = yyyyMmFromDate(new Date()) as YyyyMm;
  }
  if (typeof (plan as any).dashboardViewMonthYm !== 'string' || !/^\d{4}-\d{2}$/.test((plan as any).dashboardViewMonthYm)) {
    (plan as any).dashboardViewMonthYm = '';
  }
  ensureSavingsGoals(plan as any);
}

export async function applyPlanOverrides(): Promise<void> {
  try {
    const repos = getRepositories();
    const [cfg, debts, savingsAccounts, savingsGoals] = await Promise.all([
      repos.planConfigRepository.load(),
      repos.debtRepository.list(),
      repos.savingsAccountRepository.list(),
      repos.savingsGoalRepository.list(),
    ]);
    const local = safeReadLocalPlanPayload();
    if (
      !cfg &&
      (!debts || !debts.length) &&
      (!savingsAccounts || !savingsAccounts.length) &&
      (!savingsGoals || !savingsGoals.length)
    ) {
      // Supabase returned nothing (or RLS blocked). Fall back to legacy localStorage payload if present.
      if (local) {
        applyPlanPayloadFromObject(PLAN as any, local);
      }
      return;
    }
    // Supabase can partially succeed (e.g., config row exists but debts table is empty/blocked).
    // In that case, prefer the cached local lists to avoid wiping the UI on refresh.
    const localDebts = local && Array.isArray((local as any).debts) ? ((local as any).debts as unknown[]) : [];
    const localAccs =
      local && Array.isArray((local as any).savingsAccounts) ? ((local as any).savingsAccounts as unknown[]) : [];
    const localGoals =
      local && Array.isArray((local as any).savingsGoals) ? ((local as any).savingsGoals as unknown[]) : [];

    applyPlanPayloadFromObject(PLAN as any, {
      ...(cfg || {}),
      debts: debts && debts.length ? debts : (localDebts as any),
      savingsAccounts: savingsAccounts && savingsAccounts.length ? savingsAccounts : (localAccs as any),
      savingsGoals: savingsGoals && savingsGoals.length ? savingsGoals : (localGoals as any),
    });
    // Keep a local cache so a Supabase outage doesn't wipe the UI on refresh.
    safeWriteLocalPlanPayload(PLAN as any);
  } catch (e) {
    // Fall back to legacy localStorage payload if present.
    const local = safeReadLocalPlanPayload();
    if (local) applyPlanPayloadFromObject(PLAN as any, local);
  }
}

export async function savePlanOverrides(): Promise<boolean> {
  // Trial sessions should not persist any edits beyond the current tab lifetime.
  if (isTrialSessionActive()) {
    return true;
  }
  if (isFinancialPlanDemoMode()) {
    // If the user is editing, treat it as opting out of demo mode.
    // Persist locally so refreshes don't revert to the mock snapshot.
    safeWriteLocalPlanPayload(PLAN as any);
    try {
      localStorage.setItem(DEMO_MODE_STORAGE_KEY, '0');
    } catch {}
    return true;
  }
  clearPlanSaveError();
  try {
    const repos = getRepositories();
    let debtsOk = false;

    // Debts + payment_history first (matches agent API; not blocked by plan config errors).
    try {
      await persistDebtsToSupabase(repos);
      debtsOk = true;
    } catch (e) {
      notePlanSaveError(e);
      // eslint-disable-next-line no-console
      console.warn('[PennyPath] persistDebtsToSupabase failed', e);
    }

    try {
      await repos.planConfigRepository.save(PLAN as any);
    } catch (e) {
      notePlanSaveError(e);
      // eslint-disable-next-line no-console
      console.warn('[PennyPath] planConfigRepository.save failed', e);
    }

    try {
      await persistSavingsToSupabase(repos);
    } catch (e) {
      notePlanSaveError(e);
      // eslint-disable-next-line no-console
      console.warn('[PennyPath] persistSavingsToSupabase failed', e);
    }

    safeWriteLocalPlanPayload(PLAN as any);
    return debtsOk;
  } catch (e) {
    notePlanSaveError(e);
    safeWriteLocalPlanPayload(PLAN as any);
    // eslint-disable-next-line no-console
    console.warn('[PennyPath] savePlanOverrides failed; saved to localStorage fallback', e);
    return false;
  }
}

