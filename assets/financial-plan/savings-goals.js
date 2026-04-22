/**
 * Multiple savings targets; accounts can count toward one or more goals (full balance per goal).
 */

import { monthLabel } from './monthly-activity.js';
import { numOr } from './utils';

export const ID_GOAL_HYSA = 'goal-hysa';
export const ID_GOAL_EFUND = 'goal-efund';
export const ID_GOAL_PERSONAL = 'goal-personal';

/**
 * Ensure `plan.savingsGoals` exists and sync Goal 1 fields from the Joint HYSA row.
 * @param {object} plan
 */
export function ensureSavingsGoals(plan) {
  if (!plan || typeof plan !== 'object') return;
  if (Array.isArray(plan.savingsGoals) && plan.savingsGoals.length > 0) {
    const hysa = (plan.savingsGoals || []).find(function (x) {
      return x && x.id === ID_GOAL_HYSA;
    });
    if (hysa) {
      const rawYm = typeof hysa.goalByYm === 'string' ? hysa.goalByYm.trim() : '';
      const hasValidYm = /^\d{4}-\d{2}$/.test(rawYm);
      if (!hasValidYm) {
        const legacy = plan.hysaGoalByYm;
        if (typeof legacy === 'string' && /^\d{4}-\d{2}$/.test(legacy.trim())) {
          hysa.goalByYm = legacy.trim();
        }
      }
    }
    syncJointHysaPlanFieldsFromGoals(plan);
    return;
  }
  const efundT = numOr(plan.monthlyFixedExpenses, 0) * numOr(plan.efundMonths, 12);
  const hysaYm =
    typeof plan.hysaGoalByYm === 'string' && /^\d{4}-\d{2}$/.test(String(plan.hysaGoalByYm).trim())
      ? String(plan.hysaGoalByYm).trim()
      : '';
  plan.savingsGoals = [
    {
      id: ID_GOAL_HYSA,
      name: 'Joint HYSA',
      targetAmount: numOr(plan.goalHysa, 0) > 0 ? numOr(plan.goalHysa, 0) : 50000,
      goalByYm: hysaYm,
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
  ];
  syncJointHysaPlanFieldsFromGoals(plan);
}

/** Sync `goalHysa`, `hysaGoalByYm`, and Goal 1 labels from the `goal-hysa` savings row. */
export function syncJointHysaPlanFieldsFromGoals(plan) {
  const g = (plan.savingsGoals || []).find(function (x) {
    return x && x.id === ID_GOAL_HYSA;
  });
  if (g && Number.isFinite(Number(g.targetAmount))) {
    plan.goalHysa = Math.round(Math.max(0, Number(g.targetAmount)));
  }
  let ym = '';
  if (g && typeof g.goalByYm === 'string') {
    const s = g.goalByYm.trim();
    if (/^\d{4}-\d{2}$/.test(s)) ym = s;
  }
  plan.hysaGoalByYm = ym;
  if (!plan.labels) plan.labels = {};
  if (ym) {
    const lab = monthLabel(ym);
    plan.hysaGoalBy = lab;
    plan.labels.hysaGoalByShort = lab;
    plan.labels.goalHysaWhen = 'By ' + lab;
  } else {
    plan.hysaGoalBy = '';
    plan.labels.hysaGoalByShort = '';
    plan.labels.goalHysaWhen = '';
  }
}

/**
 * @param {object} acc
 * @returns {string[]}
 */
export function getAccountGoalIds(acc) {
  if (acc && Array.isArray(acc.goalIds) && acc.goalIds.length) {
    return acc.goalIds.map(String);
  }
  if (acc && typeof acc.countTowardsGoal === 'boolean' && acc.countTowardsGoal) {
    return [ID_GOAL_HYSA];
  }
  return [];
}

/**
 * @param {{ current?: number, goalIds?: string[], countTowardsGoal?: boolean }} acc
 * @param {string} goalId
 */
export function accountContributesToGoal(acc, goalId) {
  return getAccountGoalIds(acc).indexOf(String(goalId)) >= 0;
}

/**
 * Sum of account balances counting toward a goal (double-counts across goals when assigned to multiple).
 * @param {object[]} accs
 * @param {string} goalId
 */
export function sumBalancesTowardGoal(accs, goalId) {
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
export function normalizeSavingsGoalRow(g) {
  if (!g || typeof g !== 'object') return null;
  const id = String(g.id || '').trim() || 'goal_' + Math.random().toString(36).slice(2, 10);
  const name = String(g.name || 'Savings goal').trim() || 'Savings goal';
  const targetAmount = Math.max(0, Math.round(numOr(g.targetAmount, 0)));
  let goalByYm = '';
  if (typeof g.goalByYm === 'string') {
    const s = g.goalByYm.trim();
    if (/^\d{4}-\d{2}$/.test(s)) goalByYm = s;
  }
  return { id: id, name: name, targetAmount: targetAmount, goalByYm: goalByYm };
}

/**
 * Remove a goal id from every savings account (e.g. after deleting a goal).
 * @param {object} plan
 * @param {string} goalId
 */
export function stripGoalIdFromAllAccounts(plan, goalId) {
  const gid = String(goalId);
  const accs = Array.isArray(plan.savingsAccounts) ? plan.savingsAccounts : [];
  accs.forEach(function (a) {
    if (!a || !Array.isArray(a.goalIds)) return;
    a.goalIds = a.goalIds.map(String).filter(function (x) {
      return x !== gid;
    });
    a.countTowardsGoal = a.goalIds.indexOf(ID_GOAL_HYSA) >= 0;
  });
}
