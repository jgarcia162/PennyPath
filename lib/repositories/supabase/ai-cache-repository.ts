import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiPayoffPlanCache, FinancialCalendarResponse } from '../../../types/index.js';
import type { Database, TablesInsert, TablesUpdate } from '../../../types/supabase';
import type { AiCacheRepository } from '../types';

type AiCacheInsert = TablesInsert<'ai_cache'>;
type AiCacheUpdate = TablesUpdate<'ai_cache'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export class SupabaseAiCacheRepository implements AiCacheRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getPayoffPlan(): Promise<AiPayoffPlanCache | null> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('ai_cache')
      .select('payoff_plan_text,payoff_plan_fingerprint,payoff_plan_truncated,payoff_plan_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.payoff_plan_text) return null;
    return {
      text: data.payoff_plan_text,
      fingerprint: data.payoff_plan_fingerprint || '',
      truncated: !!data.payoff_plan_truncated,
      at: (data.payoff_plan_at || undefined) as any,
    };
  }

  async setPayoffPlan(cache: AiPayoffPlanCache): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: AiCacheInsert = {
      user_id: userId,
      updated_at: new Date().toISOString(),
      payoff_plan_text: cache.text,
      payoff_plan_fingerprint: cache.fingerprint,
      payoff_plan_truncated: !!cache.truncated,
      payoff_plan_at: (cache.at || new Date().toISOString()) as any,
    };
    const { error } = await this.supabase.from('ai_cache').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getBillCalendar(): Promise<FinancialCalendarResponse | null> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase.from('ai_cache').select('bill_calendar').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data || !data.bill_calendar) return null;
    return data.bill_calendar as unknown as FinancialCalendarResponse;
  }

  async setBillCalendar(data: FinancialCalendarResponse): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const patch: AiCacheUpdate = {
      bill_calendar: data as any,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from('ai_cache').upsert({ user_id: userId, ...patch } as any, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getBillCalendarColumns(columns: unknown): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const patch: AiCacheUpdate = {
      bill_calendar_columns: columns as any,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from('ai_cache').upsert({ user_id: userId, ...patch } as any, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getColumns(): Promise<unknown | null> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('ai_cache')
      .select('bill_calendar_columns')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? (data.bill_calendar_columns as any) : null;
  }
}

