/**
 * Clear all Financial Plan user data in localStorage and reset in-memory PLAN balances to blank.
 * Preserves theme preference. Does not touch Real Estate keys.
 */

import { PLAN } from './plan-data.js';
import { savePlanOverrides, applyBlankFinancialBalances } from './persistence.js';
import { FINANCIAL_PLAN_STORAGE_KEYS, THEME_STORAGE_KEY } from './dev-mock-storage.js';

const KEYS_TO_WIPE = FINANCIAL_PLAN_STORAGE_KEYS.filter(function (k) {
  return k !== THEME_STORAGE_KEY;
});

/** Gemini AI payoff plan (browser-only key + cached response). */
const GEMINI_PAYOFF_LS_KEYS = ['pennypath.gemini.apiKey', 'pennypath.aiPayoffPlan.v1'];

export function wipeAllUserData() {
  KEYS_TO_WIPE.forEach(function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });
  GEMINI_PAYOFF_LS_KEYS.forEach(function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });
  applyBlankFinancialBalances(PLAN);
  savePlanOverrides();
  try {
    if (window.CheckInService && typeof window.CheckInService.clearAll === 'function') {
      window.CheckInService.clearAll();
    }
  } catch (e) {}
  return { ok: true };
}
