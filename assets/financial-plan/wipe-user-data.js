/**
 * Clear all Financial Plan user data in localStorage and reset in-memory PLAN balances to blank.
 * Preserves theme preference. Does not touch Real Estate keys.
 */

import { PLAN } from './plan-data.js';
import { savePlanOverrides, applyBlankFinancialBalances } from './persistence.js';
import { FINANCIAL_PLAN_STORAGE_KEYS, THEME_STORAGE_KEY } from './dev-mock-storage.js';
import { AI_PAYOFF_PLAN_CACHE_LS_KEY, AI_BILL_CALENDAR_CACHE_LS_KEY } from './storage-keys.js';

const KEYS_TO_WIPE = FINANCIAL_PLAN_STORAGE_KEYS.filter(function (k) {
  return k !== THEME_STORAGE_KEY;
});

export function wipeAllUserData() {
  KEYS_TO_WIPE.forEach(function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });
  try {
    localStorage.removeItem(AI_PAYOFF_PLAN_CACHE_LS_KEY);
  } catch (e) {}
  try {
    localStorage.removeItem(AI_BILL_CALENDAR_CACHE_LS_KEY);
  } catch (e) {}
  applyBlankFinancialBalances(PLAN);
  savePlanOverrides();
  try {
    if (window.CheckInService && typeof window.CheckInService.clearAll === 'function') {
      window.CheckInService.clearAll();
    }
  } catch (e) {}
  return { ok: true };
}
