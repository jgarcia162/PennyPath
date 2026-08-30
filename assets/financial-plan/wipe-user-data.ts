/**
 * Clear all Financial Plan user data (localStorage + Supabase) and reset in-memory PLAN to blank.
 * Preserves theme preference. Does not touch Real Estate keys.
 */

import { PLAN } from './plan-data';
import { savePlanOverrides, applyBlankFinancialBalances } from './persistence';
import { FINANCIAL_PLAN_STORAGE_KEYS, THEME_STORAGE_KEY } from './dev-mock-storage';
import { getRepositories } from '../../lib/repositories';
import {
  AI_PAYOFF_PLAN_CACHE_LS_KEY,
  AI_BILL_CALENDAR_CACHE_LS_KEY,
  AI_BILL_CALENDAR_COLUMNS_LS_KEY,
} from './storage-keys';

const KEYS_TO_WIPE = FINANCIAL_PLAN_STORAGE_KEYS.filter(function (k) {
  return k !== THEME_STORAGE_KEY;
});

function removeLocalKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

async function clearCloudCaches(): Promise<void> {
  try {
    const repos = getRepositories();
    await Promise.all([
      repos.financialPlanStateRepository.setBadges({}),
      repos.financialPlanStateRepository.setMonthWrapArchives([]),
      repos.financialPlanStateRepository.clearMonthWrapRollback(),
      repos.checkInRepository.clearAll(),
      repos.aiCacheRepository.setPayoffPlan({
        text: '',
        fingerprint: '',
        truncated: false,
        at: new Date().toISOString(),
      }),
      repos.aiCacheRepository.setBillCalendar({ notes: '', events: [] }),
    ]);
  } catch (e) {
    // Local wipe already applied; cloud clear is best-effort.
  }
}

export async function wipeAllUserData(): Promise<{ ok: true }> {
  KEYS_TO_WIPE.forEach(removeLocalKey);
  removeLocalKey(AI_PAYOFF_PLAN_CACHE_LS_KEY);
  removeLocalKey(AI_BILL_CALENDAR_CACHE_LS_KEY);
  removeLocalKey(AI_BILL_CALENDAR_COLUMNS_LS_KEY);

  applyBlankFinancialBalances(PLAN);

  try {
    if (typeof window !== 'undefined' && (window as any).CheckInService && typeof (window as any).CheckInService.clearAll === 'function') {
      (window as any).CheckInService.clearAll();
    }
  } catch (e) {}

  await savePlanOverrides();
  await clearCloudCaches();
  return { ok: true };
}
