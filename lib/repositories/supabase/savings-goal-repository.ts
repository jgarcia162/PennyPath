import type { SupabaseClient } from '@supabase/supabase-js';

import type { SavingsGoal } from '../../../types/index.js';
import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { SavingsGoalRepository } from '../types';

type GoalRow = Tables<'savings_goals'>;
type GoalInsert = TablesInsert<'savings_goals'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function mapGoalRow(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    goalByYm: row.goal_by_ym as any,
  };
}

function toGoalInsert(userId: string, goal: SavingsGoal): GoalInsert {
  return {
    user_id: userId,
    id: goal.id,
    name: goal.name,
    target_amount: goal.targetAmount,
    goal_by_ym: goal.goalByYm || '',
  };
}

export class SupabaseSavingsGoalRepository implements SavingsGoalRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async list(): Promise<SavingsGoal[]> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map(function (r) {
      return mapGoalRow(r as GoalRow);
    });
  }

  async save(goals: SavingsGoal[]): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error: delErr } = await this.supabase.from('savings_goals').delete().eq('user_id', userId);
    if (delErr) throw delErr;

    const rows = (goals || []).map(function (g) {
      return toGoalInsert(userId, g);
    });
    if (!rows.length) return;
    const { error: insErr } = await this.supabase.from('savings_goals').insert(rows);
    if (insErr) throw insErr;
  }

  async add(goal: SavingsGoal): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row = toGoalInsert(userId, goal);
    const { error } = await this.supabase.from('savings_goals').insert(row);
    if (error) throw error;
  }

  async update(goal: SavingsGoal): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row = toGoalInsert(userId, goal);
    const { error } = await this.supabase.from('savings_goals').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error } = await this.supabase.from('savings_goals').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  }
}

