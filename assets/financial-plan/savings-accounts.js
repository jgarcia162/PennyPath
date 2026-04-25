/**
 * Savings accounts list + legacy PLAN.hysaBalance / joseSavings / sherlynaSavings sync.
 */

import { numOr } from './utils';

export function getSavingsAccounts(plan) {
  if (Array.isArray(plan.savingsAccounts) && plan.savingsAccounts.length) {
    return plan.savingsAccounts;
  }
  return [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: numOr(plan.hysaBalance, 0),
      apyPct: numOr(plan.hysaApy, 0) * 100,
      depositHistory: [],
    },
    { id: 'jose', name: 'Avery — personal', current: numOr(plan.joseSavings, 0), apyPct: 0, depositHistory: [] },
    { id: 'sher', name: 'Jordan — personal', current: numOr(plan.sherlynaSavings, 0), apyPct: 0, depositHistory: [] },
  ];
}

/** Keep legacy numeric fields aligned for payoff timeline, badges, and older code paths. */
export function syncLegacySavingsFromAccounts(plan) {
  const accs = getSavingsAccounts(plan);
  const sumId = function (id) {
    const a = accs.find(function (x) {
      return String(x.id) === id;
    });
    return a ? numOr(a.current, 0) : 0;
  };
  plan.hysaBalance = sumId('hysa');
  plan.joseSavings = sumId('jose');
  plan.sherlynaSavings = sumId('sher');
  const hysaA = accs.find(function (x) {
    return String(x.id) === 'hysa';
  });
  if (hysaA && Number.isFinite(hysaA.apyPct)) {
    plan.hysaApy = Math.max(0, hysaA.apyPct / 100);
  }
}
