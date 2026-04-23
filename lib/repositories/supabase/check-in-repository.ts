import type { SupabaseClient } from '@supabase/supabase-js';

import type { CheckInEntry, CheckInServiceEntry } from '../../../types/index.js';
import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { CheckInRepository } from '../types';

type CheckInRow = Tables<'check_ins'>;
type CheckInInsert = TablesInsert<'check_ins'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function newCheckInId(): string {
  return 'ci_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function mapRow(row: CheckInRow): CheckInServiceEntry {
  return {
    id: row.id,
    date: row.date as any,
    note: row.note || '',
    createdAt: (row.created_at || new Date().toISOString()) as any,
  };
}

export class SupabaseCheckInRepository implements CheckInRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async list(): Promise<CheckInServiceEntry[]> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(function (r) {
      return mapRow(r as CheckInRow);
    });
  }

  async add(entry: Pick<CheckInEntry, 'date' | 'note'>): Promise<CheckInServiceEntry> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: CheckInInsert = {
      user_id: userId,
      id: newCheckInId(),
      date: entry.date as any,
      note: entry.note,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase.from('check_ins').insert(row).select('*').single();
    if (error) throw error;
    return mapRow(data as CheckInRow);
  }

  async remove(id: string): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error } = await this.supabase.from('check_ins').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  }

  async clearAll(): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error } = await this.supabase.from('check_ins').delete().eq('user_id', userId);
    if (error) throw error;
  }
}

