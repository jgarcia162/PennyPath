import type { SupabaseClient } from '@supabase/supabase-js';

import type { SavingsAccount } from '../../../types/index.js';
import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { SavingsAccountRepository } from '../types';

type AccountRow = Tables<'savings_accounts'>;
type AccountInsert = TablesInsert<'savings_accounts'>;
type DepositRow = Tables<'deposit_history'>;
type DepositInsert = TablesInsert<'deposit_history'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function mapAccountRow(row: AccountRow, deposits: DepositRow[]): SavingsAccount {
  return {
    id: row.id,
    name: row.name,
    current: row.current,
    apyPct: row.apy_pct,
    goalIds: asStringArray(row.goal_ids),
    countTowardsGoal: !!row.count_towards_goal,
    depositHistory: deposits.map(function (d) {
      return { id: d.id, amount: d.amount, at: d.at };
    }),
  };
}

function toAccountInsert(userId: string, account: SavingsAccount): AccountInsert {
  return {
    user_id: userId,
    id: account.id,
    name: account.name,
    current: account.current,
    apy_pct: account.apyPct,
    count_towards_goal: !!account.countTowardsGoal,
    goal_ids: (account.goalIds || []) as any,
  };
}

export class SupabaseSavingsAccountRepository implements SavingsAccountRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async list(): Promise<SavingsAccount[]> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data: accounts, error: accErr } = await this.supabase
      .from('savings_accounts')
      .select('*')
      .eq('user_id', userId);
    if (accErr) throw accErr;

    const { data: deposits, error: depErr } = await this.supabase
      .from('deposit_history')
      .select('*')
      .eq('user_id', userId);
    if (depErr) throw depErr;

    const byAcc: Record<string, DepositRow[]> = {};
    (deposits || []).forEach(function (d) {
      const aid = String(d.account_id || '');
      if (!aid) return;
      if (!byAcc[aid]) byAcc[aid] = [];
      byAcc[aid].push(d as DepositRow);
    });

    return (accounts || []).map(function (a) {
      const aid = String(a.id);
      return mapAccountRow(a as AccountRow, byAcc[aid] || []);
    });
  }

  async add(account: SavingsAccount): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row = toAccountInsert(userId, account);
    const { error } = await this.supabase.from('savings_accounts').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  async update(account: SavingsAccount): Promise<void> {
    await this.add(account);
  }

  async remove(id: string): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error } = await this.supabase.from('savings_accounts').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  }

  async addDeposit(accountId: string, deposit: { id: string; amount: number; at: string }): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: DepositInsert = {
      user_id: userId,
      account_id: accountId,
      id: deposit.id,
      amount: deposit.amount,
      at: deposit.at,
    };
    const { error } = await this.supabase.from('deposit_history').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }
}

