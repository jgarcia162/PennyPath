/**
 * Multiple savings targets; accounts can count toward one or more goals (full balance per goal).
 */

import type { FinancialPlan, SavingsAccount, SavingsGoal, YyyyMm } from '../../types/index.js';
import { monthLabel } from './monthly-activity';
import { numOr } from './utils';

export const ID_GOAL_HYSA = 'goal-hysa';
export const ID_GOAL_EFUND = 'goal-efund';
export const ID_GOAL_PERSONAL = 'goal-personal';

/**
 * Ensure `plan.savingsGoals` exists and sync Goal 1 fields from the Joint HYSA row.
 * @param {object} plan
 */
export function ensureSavingsGoals(plan: FinancialPlan): void {
  if (!plan || typeof plan !== 'object') return;
  if (Array.isArray((plan as any).savingsGoals)) {
    if ((plan as any).savingsGoals.length === 0) {
      (plan as any).goalHysa = 0;
      (plan as any).hysaGoalByYm = '';
      (plan as any).hysaGoalBy = '';
      if (!(plan as any).labels) (plan as any).labels = {};
      (plan as any).labels.hysaGoalByShort = '';
      (plan as any).labels.goalHysaWhen = '';
      return;
    }
    const hysa = ((plan as any).savingsGoals || []).find(function (x: any) {
      return x && x.id === ID_GOAL_HYSA;
    });
    if (hysa) {
      const rawYm = typeof hysa.goalByYm === 'string' ? hysa.goalByYm.trim() : '';
      const hasValidYm = /^\d{4}-\d{2}$/.test(rawYm);
      if (!hasValidYm) {
        const legacy = (plan as any).hysaGoalByYm;
        if (typeof legacy === 'string' && /^\d{4}-\d{2}$/.test(legacy.trim())) {
          hysa.goalByYm = legacy.trim();
        }
      }
    }
    syncJointHysaPlanFieldsFromGoals(plan);
    return;
  }
  const efundT = numOr((plan as any).monthlyFixedExpenses, 0) * numOr((plan as any).efundMonths, 12);
  const hysaYm =
    typeof (plan as any).hysaGoalByYm === 'string' &&
    /^\d{4}-\d{2}$/.test(String((plan as any).hysaGoalByYm).trim())
      ? String((plan as any).hysaGoalByYm).trim()
      : '';
  (plan as any).savingsGoals = [
    {
      id: ID_GOAL_HYSA,
      name: 'Joint HYSA',
      targetAmount: numOr((plan as any).goalHysa, 0),
      goalByYm: hysaYm as YyyyMm,
    },
    {
      id: ID_GOAL_EFUND,
      name: 'Emergency fund',
      targetAmount: efundT,
      goalByYm: '',
    },
    {
      id: ID_GOAL_PERSONAL,
      name: 'Personal savings',
      targetAmount: 0,
      goalByYm: '',
    },
  ] satisfies SavingsGoal[];
  syncJointHysaPlanFieldsFromGoals(plan);
}

/** Sync `goalHysa`, `hysaGoalByYm`, and Goal 1 labels from the `goal-hysa` savings row. */
export function syncJointHysaPlanFieldsFromGoals(plan: FinancialPlan): void {
  const g = (((plan as any).savingsGoals || []) as any[]).find(function (x: any) {
    return x && x.id === ID_GOAL_HYSA;
  });
  if (g && Number.isFinite(Number(g.targetAmount))) {
    (plan as any).goalHysa = Math.round(Math.max(0, Number(g.targetAmount)));
  }
  let ym = '';
  if (g && typeof g.goalByYm === 'string') {
    const s = g.goalByYm.trim();
    if (/^\d{4}-\d{2}$/.test(s)) ym = s;
  }
  (plan as any).hysaGoalByYm = ym;
  if (!(plan as any).labels) (plan as any).labels = {};
  if (ym) {
    const lab = monthLabel(ym);
    (plan as any).hysaGoalBy = lab;
    (plan as any).labels.hysaGoalByShort = lab;
    (plan as any).labels.goalHysaWhen = 'By ' + lab;
  } else {
    (plan as any).hysaGoalBy = '';
    (plan as any).labels.hysaGoalByShort = '';
    (plan as any).labels.goalHysaWhen = '';
  }
}

/**
 * @param {object} acc
 * @returns {string[]}
 */
export function getAccountGoalIds(acc: unknown): string[] {
  const a = acc as any;
  if (a && Array.isArray(a.goalIds) && a.goalIds.length) {
    return a.goalIds.map(String);
  }
  if (a && typeof a.countTowardsGoal === 'boolean' && a.countTowardsGoal) {
    return [ID_GOAL_HYSA];
  }
  return [];
}

/**
 * @param {{ current?: number, goalIds?: string[], countTowardsGoal?: boolean }} acc
 * @param {string} goalId
 */
export function accountContributesToGoal(acc: unknown, goalId: string): boolean {
  return getAccountGoalIds(acc).indexOf(String(goalId)) >= 0;
}

/**
 * Sum of account balances counting toward a goal (double-counts across goals when assigned to multiple).
 * @param {object[]} accs
 * @param {string} goalId
 */
export function sumBalancesTowardGoal(accs: SavingsAccount[], goalId: string): number {
  const gid = String(goalId);
  return (accs || []).reduce(function (s, a) {
    if (accountContributesToGoal(a, gid)) return s + numOr(a.current, 0);
    return s;
  }, 0);
}

/**
 * @param {object} g
 * @returns {{ id: string, name: string, targetAmount: number, goalByYm: string } | null}
 */
export function normalizeSavingsGoalRow(g: unknown): SavingsGoal | null {
  if (!g || typeof g !== 'object') return null;
  const o = g as any;
  const id = String(o.id || '').trim() || 'goal_' + Math.random().toString(36).slice(2, 10);
  const name = String(o.name || 'Savings goal').trim() || 'Savings goal';
  const targetAmount = Math.max(0, Math.round(numOr(o.targetAmount, 0)));
  let goalByYm = '';
  if (typeof o.goalByYm === 'string') {
    const s = o.goalByYm.trim();
    if (/^\d{4}-\d{2}$/.test(s)) goalByYm = s;
  }
  return { id: id, name: name, targetAmount: targetAmount, goalByYm: goalByYm as any };
}

/**
 * Remove a goal id from every savings account (e.g. after deleting a goal).
 * @param {object} plan
 * @param {string} goalId
 */
export function stripGoalIdFromAllAccounts(plan: FinancialPlan, goalId: string): void {
  const gid = String(goalId);
  const accs = Array.isArray((plan as any).savingsAccounts) ? ((plan as any).savingsAccounts as SavingsAccount[]) : [];
  accs.forEach(function (a: any) {
    if (!a || !Array.isArray(a.goalIds)) return;
    a.goalIds = a.goalIds.map(String).filter(function (x: string) {
      return x !== gid;
    });
    a.countTowardsGoal = a.goalIds.indexOf(ID_GOAL_HYSA) >= 0;
  });
}
