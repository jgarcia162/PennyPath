/**
 * Multiple savings targets; accounts can count toward one or more goals (full balance per goal).
 */

import { numOr } from './utils.js';

export const ID_GOAL_HYSA = 'goal-hysa';
export const ID_GOAL_EFUND = 'goal-efund';
export const ID_GOAL_PERSONAL = 'goal-personal';

/**
 * Ensure `plan.savingsGoals` exists and sync `plan.goalHysa` from the Joint HYSA goal.
 * @param {object} plan
 */
export function ensureSavingsGoals(plan) {
  if (!plan || typeof plan !== 'object') return;
  if (Array.isArray(plan.savingsGoals) && plan.savingsGoals.length > 0) {
    syncGoalHysaFromGoals(plan);
    return;
  }
  const efundT = numOr(plan.monthlyFixedExpenses, 0) * numOr(plan.efundMonths, 12);
  plan.savingsGoals = [
    {
      id: ID_GOAL_HYSA,
      name: 'Joint HYSA',
      targetAmount: numOr(plan.goalHysa, 0) > 0 ? numOr(plan.goalHysa, 0) : 50000,
    },
    {
      id: ID_GOAL_EFUND,
      name: 'Emergency fund',
      targetAmount: efundT,
    },
    {
      id: ID_GOAL_PERSONAL,
      name: 'Personal savings',
      targetAmount: 0,
    },
  ];
  syncGoalHysaFromGoals(plan);
}

export function syncGoalHysaFromGoals(plan) {
  const g = (plan.savingsGoals || []).find(function (x) {
    return x && x.id === ID_GOAL_HYSA;
  });
  if (g && Number.isFinite(Number(g.targetAmount))) {
    plan.goalHysa = Math.round(Math.max(0, Number(g.targetAmount)));
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
 * @returns {{ id: string, name: string, targetAmount: number } | null}
 */
export function normalizeSavingsGoalRow(g) {
  if (!g || typeof g !== 'object') return null;
  const id = String(g.id || '').trim() || 'goal_' + Math.random().toString(36).slice(2, 10);
  const name = String(g.name || 'Savings goal').trim() || 'Savings goal';
  const targetAmount = Math.max(0, Math.round(numOr(g.targetAmount, 0)));
  return { id: id, name: name, targetAmount: targetAmount };
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
