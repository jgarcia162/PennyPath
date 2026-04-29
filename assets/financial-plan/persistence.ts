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
} from './plan-data';
import { getRepositories } from '../../lib/repositories';
import { numOr } from './utils';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { yyyyMmFromDate } from './monthly-activity';
import { ID_GOAL_HYSA, ensureSavingsGoals, normalizeSavingsGoalRow } from './savings-goals';

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
      return { id: String(p.id || ''), amount: Number(p.amount), at: String(p.at) };
    });
}

export function newPaymentId(): string {
  return 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeDepositHistory(acc: unknown): DepositHistoryItem[] {
  const o = acc as any;
  if (!o || !Array.isArray(o.depositHistory)) return [];
  return o.depositHistory
    .filter(function (p: any) {
      return p && typeof p === 'object' && Number.isFinite(Number(p.amount)) && typeof p.at === 'string';
    })
    .map(function (p: any) {
      return { id: String(p.id || ''), amount: Number(p.amount), at: String(p.at) };
    });
}

export function newDepositId(): string {
  return 'dep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
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
  let goalIds: string[] = [];
  if (Array.isArray(o.goalIds) && o.goalIds.length) {
    goalIds = o.goalIds.map(String).filter(Boolean);
  } else if (typeof o.countTowardsGoal === 'boolean' && o.countTowardsGoal) {
    goalIds = [ID_GOAL_HYSA];
  }
  const countTowardsGoal = goalIds.indexOf(ID_GOAL_HYSA) >= 0;
  return {
    id: id,
    name: String(o.name || 'Account'),
    current: numOr(o.current, 0),
    apyPct: apyPct,
    goalIds: goalIds,
    countTowardsGoal: countTowardsGoal,
    depositHistory: normalizeDepositHistory(o),
  };
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
    if (Array.isArray(lb.budgetCategories)) (plan as any).budgetCategories = lb.budgetCategories;
  }
  if (Array.isArray((payload as any).budgetCategories)) {
    (plan as any).budgetCategories = (payload as any).budgetCategories;
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
  if (Array.isArray(payload.debts)) {
    (plan as any).debts = payload.debts
      .filter(function (d: any) {
        return d && typeof d === 'object';
      })
      .map(function (d: any) {
        return {
          id: String(d.id || Math.random().toString(36).slice(2)),
          name: String(d.name || 'Debt'),
          current: numOr(d.current, 0),
          paidOff: numOr(d.paidOff, 0),
          aprPct: numOr(d.aprPct, DEFAULT_DEBT_APR_PCT),
          deferredAmount: numOr(d.deferredAmount, 0),
          deferredExpiresOn: typeof d.deferredExpiresOn === 'string' ? d.deferredExpiresOn : '',
          deferredMonthsRemaining: Number.isFinite(d.deferredMonthsRemaining)
            ? Math.max(0, Math.floor(d.deferredMonthsRemaining))
            : 0,
          paymentHistory: normalizePaymentHistory(d),
        } as Debt;
      });
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
    if (!cfg && (!debts || !debts.length) && (!savingsAccounts || !savingsAccounts.length) && (!savingsGoals || !savingsGoals.length)) {
      return;
    }
    applyPlanPayloadFromObject(PLAN as any, {
      ...(cfg || {}),
      debts: debts || [],
      savingsAccounts: savingsAccounts || [],
      savingsGoals: savingsGoals || [],
    });
  } catch (e) {
    // keep silent (matches prior localStorage persistence behavior)
  }
}

export async function savePlanOverrides(): Promise<void> {
  if (isFinancialPlanDemoMode()) return;
  try {
    const repos = getRepositories();

    // Save scalar / config fields.
    await repos.planConfigRepository.save(PLAN as any);

    // Debts: remove missing, upsert current, upsert payment history.
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
      for (const p of ph) {
        await repos.debtRepository.addPayment(String(debt.id), { id: String(p.id), amount: Number(p.amount), at: String(p.at) });
      }
    }

    // Savings accounts: remove missing, upsert current, upsert deposit history.
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
      for (const d of dh) {
        await repos.savingsAccountRepository.addDeposit(String(acc.id), { id: String(d.id), amount: Number(d.amount), at: String(d.at) });
      }
    }

    // Goals: replace list.
    await repos.savingsGoalRepository.save(Array.isArray((PLAN as any).savingsGoals) ? (PLAN as any).savingsGoals : []);
  } catch (e) {
    // keep silent (matches prior localStorage persistence behavior)
  }
}

