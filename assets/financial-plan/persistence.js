/**
 * LocalStorage load/save + debt / savings normalization for persisted rows.
 */

import {
  PLAN,
  PLAN_DEFAULTS,
  STORAGE_KEY,
  DEFAULT_DEBT_APR_PCT,
  DEFAULT_SAVINGS_APY_PCT,
  DEMO_MODE_STORAGE_KEY,
} from './plan-data.js';
import { numOr } from './utils.js';
import { syncLegacySavingsFromAccounts } from './savings-accounts.js';

function normalizeDebtsEditorSortForStorage(sort) {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return sort || 'saved';
}

function normalizeDebtsProgressSortForStorage(sort) {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return sort || 'saved';
}

export function normalizePaymentHistory(d) {
  if (!d || !Array.isArray(d.paymentHistory)) return [];
  return d.paymentHistory
    .filter(function (p) {
      return p && typeof p === 'object' && Number.isFinite(Number(p.amount)) && typeof p.at === 'string';
    })
    .map(function (p) {
      return { id: String(p.id || ''), amount: Number(p.amount), at: String(p.at) };
    });
}

export function newPaymentId() {
  return 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeDepositHistory(acc) {
  if (!acc || !Array.isArray(acc.depositHistory)) return [];
  return acc.depositHistory
    .filter(function (p) {
      return p && typeof p === 'object' && Number.isFinite(Number(p.amount)) && typeof p.at === 'string';
    })
    .map(function (p) {
      return { id: String(p.id || ''), amount: Number(p.amount), at: String(p.at) };
    });
}

export function newDepositId() {
  return 'dep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function normalizeSavingsAccount(a) {
  if (!a || typeof a !== 'object') return null;
  const id = String(a.id || Math.random().toString(36).slice(2));
  var apyPct;
  if ('apyPct' in a && Number.isFinite(a.apyPct)) {
    apyPct = a.apyPct;
  } else if (id === 'hysa') {
    apyPct = numOr(PLAN.hysaApy, 0) * 100;
  } else {
    apyPct = DEFAULT_SAVINGS_APY_PCT;
  }
  return {
    id: id,
    name: String(a.name || 'Account'),
    current: numOr(a.current, 0),
    apyPct: apyPct,
    depositHistory: normalizeDepositHistory(a),
  };
}

function migrateLegacySavingsFromJson(o) {
  const hysaApyPct =
    typeof o.hysaApy === 'number' && Number.isFinite(o.hysaApy) ? o.hysaApy * 100 : 3.25;
  return [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: typeof o.hysaBalance === 'number' && Number.isFinite(o.hysaBalance) ? o.hysaBalance : 0,
      apyPct: hysaApyPct,
      depositHistory: [],
    },
    {
      id: 'jose',
      name: 'Jose — personal',
      current: typeof o.joseSavings === 'number' && Number.isFinite(o.joseSavings) ? o.joseSavings : 0,
      apyPct: 0,
      depositHistory: [],
    },
    {
      id: 'sher',
      name: 'Sherlyna — personal',
      current: typeof o.sherlynaSavings === 'number' && Number.isFinite(o.sherlynaSavings) ? o.sherlynaSavings : 0,
      apyPct: 0,
      depositHistory: [],
    },
  ];
}

/** Mutate plan to empty debts + zeroed default savings accounts (fresh start). */
export function applyBlankFinancialBalances(plan) {
  plan.debts = [];
  plan.debtsEditorSort = PLAN_DEFAULTS.debtsEditorSort || 'saved';
  plan.debtsProgressSort = PLAN_DEFAULTS.debtsProgressSort || 'saved';
  plan.savingsAccounts = JSON.parse(JSON.stringify(PLAN_DEFAULTS.savingsAccounts));
  plan.hysaBalance = PLAN_DEFAULTS.hysaBalance;
  plan.joseSavings = PLAN_DEFAULTS.joseSavings;
  plan.sherlynaSavings = PLAN_DEFAULTS.sherlynaSavings;
  syncLegacySavingsFromAccounts(plan);
  plan._hysaStartingDefault = 0;
}

export function isFinancialPlanDemoMode() {
  try {
    return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

/**
 * Apply a persisted or mock balances payload to a plan object (same shape as savePlanOverrides output).
 */
export function applyPlanPayloadFromObject(plan, o) {
  if (!plan || !o || typeof o !== 'object') return;
  ['hysaBalance', 'joseSavings', 'sherlynaSavings'].forEach(function (k) {
    if (typeof o[k] === 'number' && Number.isFinite(o[k])) plan[k] = o[k];
  });
  if (typeof o.debtsEditorSort === 'string') {
    const s = o.debtsEditorSort;
    const allowed =
      s === 'saved' ||
      s === 'balance' ||
      s === 'balance-desc' ||
      s === 'balance-asc' ||
      s === 'apr' ||
      s === 'apr-desc' ||
      s === 'apr-asc';
    if (allowed) {
      if (s === 'balance') plan.debtsEditorSort = 'balance-desc';
      else if (s === 'apr') plan.debtsEditorSort = 'apr-desc';
      else plan.debtsEditorSort = s;
    }
  }
  if (typeof o.debtsProgressSort === 'string') {
    const s = o.debtsProgressSort;
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
      if (s === 'balance') plan.debtsProgressSort = 'balance-desc';
      else if (s === 'apr') plan.debtsProgressSort = 'apr-desc';
      else plan.debtsProgressSort = s;
    }
  }
  if (Array.isArray(o.debts)) {
    plan.debts = o.debts
      .filter(function (d) {
        return d && typeof d === 'object';
      })
      .map(function (d) {
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
        };
      });
  }
  if (Array.isArray(o.savingsAccounts) && o.savingsAccounts.length) {
    plan.savingsAccounts = o.savingsAccounts.map(normalizeSavingsAccount).filter(Boolean);
  } else {
    plan.savingsAccounts = migrateLegacySavingsFromJson(o);
  }
  syncLegacySavingsFromAccounts(plan);
}

export function applyPlanOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    applyPlanPayloadFromObject(PLAN, o);
  } catch (e) {}
}

export function savePlanOverrides() {
  if (isFinancialPlanDemoMode()) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hysaBalance: PLAN.hysaBalance,
        joseSavings: PLAN.joseSavings,
        sherlynaSavings: PLAN.sherlynaSavings,
        savingsAccounts: PLAN.savingsAccounts,
        debts: PLAN.debts,
        debtsEditorSort: normalizeDebtsEditorSortForStorage(PLAN.debtsEditorSort),
        debtsProgressSort: normalizeDebtsProgressSortForStorage(PLAN.debtsProgressSort),
      })
    );
  } catch (e) {}
}
