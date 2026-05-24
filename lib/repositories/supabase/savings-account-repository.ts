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
  const ls = (row as { ledger_status?: string }).ledger_status;
  const ledgerStatus = ls === 'deleted' ? ('deleted' as const) : undefined;
  return {
    id: row.id,
    name: row.name,
    current: row.current,
    apyPct: row.apy_pct,
    goalIds: asStringArray(row.goal_ids),
    countTowardsGoal: !!row.count_towards_goal,
    ...(ledgerStatus ? { ledgerStatus } : {}),
    depositHistory: deposits.map(function (d) {
      const kind = d.kind === 'withdrawal' ? ('withdrawal' as const) : ('deposit' as const);
      return {
        id: d.id,
        amount: d.amount,
        at: d.at,
        kind,
        memo: typeof d.memo === 'string' ? d.memo : '',
      };
    }),
  };
}

function toAccountInsert(userId: string, account: SavingsAccount): AccountInsert {
  const ledger_status =
    account.ledgerStatus === 'deleted' || account.ledgerStatus === 'active'
      ? account.ledgerStatus
      : 'active';
  return {
    user_id: userId,
    id: account.id,
    name: account.name,
    current: account.current,
    apy_pct: account.apyPct,
    count_towards_goal: !!account.countTowardsGoal,
    goal_ids: (account.goalIds || []) as any,
    ledger_status,
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
    const { error } = await this.supabase.from('savings_accounts').upsert(row, { onConflict: 'user_id,id' });
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

  async addDeposit(
    accountId: string,
    deposit: { id: string; amount: number; at: string; kind?: 'deposit' | 'withdrawal'; memo?: string }
  ): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: DepositInsert = {
      user_id: userId,
      account_id: accountId,
      id: deposit.id,
      amount: deposit.amount,
      at: deposit.at,
      kind: deposit.kind === 'withdrawal' ? 'withdrawal' : 'deposit',
      memo: typeof deposit.memo === 'string' ? deposit.memo : '',
    };
    const { error } = await this.supabase.from('deposit_history').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async syncDeposits(
    accountId: string,
    deposits: { id: string; amount: number; at: string; kind?: 'deposit' | 'withdrawal'; memo?: string }[]
  ): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);
    const accountKey = String(accountId);

    const { data: existing, error: listErr } = await this.supabase
      .from('deposit_history')
      .select('id')
      .eq('user_id', userId)
      .eq('account_id', accountKey);
    if (listErr) throw listErr;

    const nextIds = new Set(
      deposits.map((d) => String(d.id)).filter((id) => id.length > 0)
    );
    const staleIds = (existing || [])
      .map((row) => String(row.id))
      .filter((id) => id.length > 0 && !nextIds.has(id));

    if (staleIds.length) {
      const { error: delErr } = await this.supabase
        .from('deposit_history')
        .delete()
        .eq('user_id', userId)
        .eq('account_id', accountKey)
        .in('id', staleIds);
      if (delErr) throw delErr;
    }

    for (const deposit of deposits) {
      const id = String(deposit.id || '').trim();
      if (!id) continue;
      const amount = Number(deposit.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      await this.addDeposit(accountKey, {
        id,
        amount,
        at: String(deposit.at),
        kind: deposit.kind === 'withdrawal' ? 'withdrawal' : 'deposit',
        memo: typeof deposit.memo === 'string' ? deposit.memo : '',
      });
    }
  }
}

