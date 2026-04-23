'use client';

import { STORAGE_KEY, PLAN } from '../assets/financial-plan/plan-data';
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

    // If the user already has a row, nothing to migrate.
    const existing = await repos.planConfigRepository.load();
    if (existing) return;

    const planPayload = safeReadJson(STORAGE_KEY);
    if (planPayload && typeof planPayload === 'object') {
      // Normalize into the in-memory plan using existing logic, then persist the full plan via repositories.
      applyPlanPayloadFromObject(PLAN as any, planPayload);
      await savePlanOverrides();
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

    // If we got this far, clear the legacy keys so it never runs again.
    safeRemoveKey(STORAGE_KEY);
    safeRemoveKey(AI_PAYOFF_PLAN_CACHE_LS_KEY);
    safeRemoveKey(AI_BILL_CALENDAR_CACHE_LS_KEY);
    safeRemoveKey(AI_BILL_CALENDAR_COLUMNS_LS_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[PennyPath] migrateLocalStorageToSupabase failed', e);
  }
}

