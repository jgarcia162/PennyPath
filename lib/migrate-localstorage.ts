'use client';

import { createSupabaseBrowserClient } from './supabase/browser';
import { STORAGE_KEY } from '../assets/financial-plan/plan-data';

const LEGACY_STORAGE_KEY = 'pennypath.plan';

function readLegacyPlanPayload(): unknown | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearLegacyPlanPayload(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {}
}

/**
 * One-time migration: if the current user has no `financial_plans` row yet,
 * copy any existing localStorage plan payload into Supabase, then clear localStorage.
 *
 * Errors are intentionally silent to match the existing storage-layer behavior.
 */
export async function migrateLocalStoragePlanToSupabase(): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return;

    const userId = userData.user.id;

    const { data: existing, error: existingErr } = await supabase
      .from('financial_plans')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingErr) return;
    if (existing && existing.id) return;

    const payload = readLegacyPlanPayload();
    if (!payload || typeof payload !== 'object') return;

    const { error: upsertErr } = await supabase.from('financial_plans').upsert(
      {
        user_id: userId,
        payload: payload as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (upsertErr) return;

    clearLegacyPlanPayload();
  } catch {}
}

