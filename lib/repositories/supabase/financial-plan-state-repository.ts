import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { FinancialPlanStateRepository } from '../types';

type StateRow = Tables<'financial_plan_state'>;
type StateInsert = TablesInsert<'financial_plan_state'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function asRecordOfStrings(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(v as Record<string, unknown>).forEach(function ([k, val]) {
    if (typeof val === 'string') out[k] = val;
  });
  return out;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function baseInsert(userId: string): Pick<StateInsert, 'user_id' | 'updated_at'> {
  return { user_id: userId, updated_at: new Date().toISOString() };
}

export class SupabaseFinancialPlanStateRepository implements FinancialPlanStateRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getRow(): Promise<StateRow | null> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('financial_plan_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as StateRow) || null;
  }

  async getBadges(): Promise<Record<string, string>> {
    const row = await this.getRow();
    return asRecordOfStrings(row?.badges);
  }

  async setBadges(unlocks: Record<string, string>): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: StateInsert = {
      ...baseInsert(userId),
      badges: unlocks as any,
    };
    const { error } = await this.supabase.from('financial_plan_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getMonthWrapArchives(): Promise<unknown[]> {
    const row = await this.getRow();
    return asArray(row?.month_wrap_archives);
  }

  async setMonthWrapArchives(archives: unknown[]): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: StateInsert = {
      ...baseInsert(userId),
      month_wrap_archives: (Array.isArray(archives) ? archives : []) as any,
    };
    const { error } = await this.supabase.from('financial_plan_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getMonthWrapRollback(): Promise<unknown | null> {
    const row = await this.getRow();
    return row?.month_wrap_rollback ?? null;
  }

  async setMonthWrapRollback(payload: unknown): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: StateInsert = {
      ...baseInsert(userId),
      month_wrap_rollback: payload as any,
    };
    const { error } = await this.supabase.from('financial_plan_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async clearMonthWrapRollback(): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: StateInsert = {
      ...baseInsert(userId),
      month_wrap_rollback: null,
    };
    const { error } = await this.supabase.from('financial_plan_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

