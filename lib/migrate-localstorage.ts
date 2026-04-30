'use client';

import {
  BADGES_STORAGE_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  STORAGE_KEY,
  PLAN,
} from '../assets/financial-plan/plan-data';
import {
  AI_BILL_CALENDAR_CACHE_LS_KEY,
  AI_BILL_CALENDAR_COLUMNS_LS_KEY,
  AI_PAYOFF_PLAN_CACHE_LS_KEY,
} from '../assets/financial-plan/storage-keys';
import { applyPlanPayloadFromObject, savePlanOverrides } from '../assets/financial-plan/persistence';
import { getRepositories } from './repositories';

function safeReadJson(key: string): any | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeRemoveKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * One-time migration utility for logged-in users.
 *
 * - Migrates plan payload from localStorage STORAGE_KEY → Supabase via repositories.
 * - Migrates AI cache keys from localStorage → `ai_cache` row.
 *
 * Any errors are logged and swallowed; migration should never block dashboard boot.
 */
export async function migrateLocalStorageToSupabase(): Promise<void> {
  try {
    const repos = getRepositories();

    // If the user already has a plan row, skip plan migration (but still migrate misc state).
    const existing = await repos.planConfigRepository.load();
    if (!existing) {
      const planPayload = safeReadJson(STORAGE_KEY);
      if (planPayload && typeof planPayload === 'object') {
        // Normalize into the in-memory plan using existing logic, then persist the full plan via repositories.
        applyPlanPayloadFromObject(PLAN as any, planPayload);
        await savePlanOverrides();
      }
    }

    const payoffCache = safeReadJson(AI_PAYOFF_PLAN_CACHE_LS_KEY);
    if (payoffCache && typeof payoffCache === 'object' && typeof payoffCache.text === 'string') {
      await repos.aiCacheRepository.setPayoffPlan(payoffCache as any);
    }

    const calCache = safeReadJson(AI_BILL_CALENDAR_CACHE_LS_KEY);
    if (calCache && typeof calCache === 'object') {
      const maybeCalendar = (calCache as any).events ? calCache : (calCache as any).data;
      if (maybeCalendar && typeof maybeCalendar === 'object' && Array.isArray((maybeCalendar as any).events)) {
        await repos.aiCacheRepository.setBillCalendar(maybeCalendar as any);
      }
    }

    const colCache = safeReadJson(AI_BILL_CALENDAR_COLUMNS_LS_KEY);
    if (colCache && typeof colCache === 'object') {
      await repos.aiCacheRepository.getBillCalendarColumns(colCache);
    }

    // Badges + month wrap state (merge non-destructively).
    const localBadges = safeReadJson(BADGES_STORAGE_KEY);
    if (localBadges && typeof localBadges === 'object') {
      try {
        const serverBadges = await repos.financialPlanStateRepository.getBadges();
        const merged = { ...(serverBadges || {}) } as Record<string, string>;
        Object.entries(localBadges as Record<string, unknown>).forEach(function ([k, v]) {
          if (!merged[k] && typeof v === 'string') merged[k] = v;
        });
        await repos.financialPlanStateRepository.setBadges(merged);
      } catch {}
    }

    const localArchives = safeReadJson(MONTH_WRAP_ARCHIVES_KEY);
    if (Array.isArray(localArchives) && localArchives.length) {
      try {
        const serverArchives = await repos.financialPlanStateRepository.getMonthWrapArchives();
        const seen = new Set<string>();
        const merged: unknown[] = [];
        (Array.isArray(serverArchives) ? serverArchives : []).forEach(function (item) {
          const key = JSON.stringify(item);
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(item);
        });
        localArchives.forEach(function (item) {
          const key = JSON.stringify(item);
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(item);
        });
        while (merged.length > 48) merged.shift();
        await repos.financialPlanStateRepository.setMonthWrapArchives(merged);
      } catch {}
    }

    const localRollback = safeReadJson(MONTH_WRAP_ROLLBACK_KEY);
    if (localRollback && typeof localRollback === 'object') {
      try {
        const serverRollback = await repos.financialPlanStateRepository.getMonthWrapRollback();
        if (!serverRollback) await repos.financialPlanStateRepository.setMonthWrapRollback(localRollback);
      } catch {}
    }

    // If we got this far, clear the legacy keys so it never runs again.
    if (!existing) safeRemoveKey(STORAGE_KEY);
    safeRemoveKey(AI_PAYOFF_PLAN_CACHE_LS_KEY);
    safeRemoveKey(AI_BILL_CALENDAR_CACHE_LS_KEY);
    safeRemoveKey(AI_BILL_CALENDAR_COLUMNS_LS_KEY);
    safeRemoveKey(BADGES_STORAGE_KEY);
    safeRemoveKey(MONTH_WRAP_ARCHIVES_KEY);
    safeRemoveKey(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[PennyPath] migrateLocalStorageToSupabase failed', e);
  }
}

