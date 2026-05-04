import type { SupabaseClient } from '@supabase/supabase-js';

import type { Debt } from '../../../types/index.js';
import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { DebtRepository } from '../types';

type DebtRow = Tables<'debts'>;
type DebtInsert = TablesInsert<'debts'>;
type PaymentRow = Tables<'payment_history'>;
type PaymentInsert = TablesInsert<'payment_history'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function mapDebtRow(row: DebtRow, payments: PaymentRow[]): Debt {
  const ls = (row as { ledger_status?: string }).ledger_status;
  const ledgerStatus =
    ls === 'completed' || ls === 'deleted' ? (ls as Debt['ledgerStatus']) : ls === 'active' ? 'active' : undefined;
  return {
    id: row.id,
    name: row.name,
    current: row.current,
    paidOff: row.paid_off,
    aprPct: row.apr_pct,
    deferredAmount: row.deferred_amount,
    deferredExpiresOn: row.deferred_expires_on as any,
    deferredMonthsRemaining: row.deferred_months_remaining,
    ...(ledgerStatus ? { ledgerStatus } : {}),
    paymentHistory: payments.map(function (p) {
      return { id: p.id, amount: p.amount, at: p.at };
    }),
  };
}

function toDebtInsert(userId: string, debt: Debt): DebtInsert {
  const ls = debt.ledgerStatus;
  const ledger_status =
    ls === 'completed' || ls === 'deleted' || ls === 'active' ? ls : 'active';
  return {
    user_id: userId,
    id: debt.id,
    name: debt.name,
    current: debt.current,
    paid_off: debt.paidOff,
    apr_pct: debt.aprPct,
    deferred_amount: debt.deferredAmount,
    deferred_expires_on: debt.deferredExpiresOn || '',
    deferred_months_remaining: debt.deferredMonthsRemaining,
    ledger_status,
  };
}

export class SupabaseDebtRepository implements DebtRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async list(): Promise<Debt[]> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data: debts, error: debtsErr } = await this.supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId);
    if (debtsErr) throw debtsErr;

    const { data: payments, error: payErr } = await this.supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', userId);
    if (payErr) throw payErr;

    const byDebt: Record<string, PaymentRow[]> = {};
    (payments || []).forEach(function (p) {
      const did = String(p.debt_id || '');
      if (!did) return;
      if (!byDebt[did]) byDebt[did] = [];
      byDebt[did].push(p as PaymentRow);
    });

    return (debts || []).map(function (d) {
      const did = String(d.id);
      return mapDebtRow(d as DebtRow, byDebt[did] || []);
    });
  }

  async add(debt: Debt): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row = toDebtInsert(userId, debt);
    const { error } = await this.supabase.from('debts').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async update(debt: Debt): Promise<void> {
    // Upsert is fine here; id is stable.
    await this.add(debt);
  }

  async remove(id: string): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { error } = await this.supabase.from('debts').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  }

  async addPayment(debtId: string, payment: { id: string; amount: number; at: string }): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row: PaymentInsert = {
      user_id: userId,
      debt_id: debtId,
      id: payment.id,
      amount: payment.amount,
      at: payment.at,
    };
    const { error } = await this.supabase.from('payment_history').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
}

