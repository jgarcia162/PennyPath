import type { SupabaseClient } from '@supabase/supabase-js';

import type { Debt, DebtLedgerStatus, SavingsAccount } from '../../types/index';
import type { Database, Tables, TablesInsert } from '../../types/supabase';

type DebtRow = Tables<'debts'>;
type PaymentRow = Tables<'payment_history'>;
type AccountRow = Tables<'savings_accounts'>;
type DepositRow = Tables<'deposit_history'>;

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
    deferredExpiresOn: row.deferred_expires_on as Debt['deferredExpiresOn'],
    deferredMonthsRemaining: row.deferred_months_remaining,
    ...(ledgerStatus ? { ledgerStatus } : {}),
    paymentHistory: payments.map((p) => ({ id: p.id, amount: p.amount, at: p.at })),
  };
}

function mapAccountRow(row: AccountRow, deposits: DepositRow[]): SavingsAccount {
  const ls = (row as { ledger_status?: string }).ledger_status;
  const ledgerStatus = ls === 'deleted' ? ('deleted' as const) : undefined;
  const goalIds = Array.isArray(row.goal_ids) ? row.goal_ids.map(String).filter(Boolean) : [];
  return {
    id: row.id,
    name: row.name,
    current: row.current,
    apyPct: row.apy_pct,
    goalIds,
    countTowardsGoal: !!row.count_towards_goal,
    ...(ledgerStatus ? { ledgerStatus } : {}),
    depositHistory: deposits.map((d) => ({ id: d.id, amount: d.amount, at: d.at })),
  };
}

function effectiveDebtLedgerStatus(debt: Debt): DebtLedgerStatus {
  return debt.ledgerStatus === 'completed' || debt.ledgerStatus === 'deleted' ? debt.ledgerStatus : 'active';
}

function matchesDebtLedgerFilter(debt: Debt, filter: DebtLedgerStatus | 'all' | undefined): boolean {
  if (!filter || filter === 'all') return true;
  return effectiveDebtLedgerStatus(debt) === filter;
}

/** Core debt columns only; ledger_status is optional until migration 006 is applied. */
function toDebtInsert(userId: string, debt: Debt): TablesInsert<'debts'> {
  const row: TablesInsert<'debts'> = {
    user_id: userId,
    id: debt.id,
    name: debt.name,
    current: debt.current,
    paid_off: debt.paidOff,
    apr_pct: debt.aprPct,
    deferred_amount: debt.deferredAmount,
    deferred_expires_on: debt.deferredExpiresOn || '',
    deferred_months_remaining: debt.deferredMonthsRemaining,
  };
  const ls = debt.ledgerStatus;
  if (ls === 'completed' || ls === 'deleted' || ls === 'active') {
    (row as TablesInsert<'debts'> & { ledger_status?: string }).ledger_status = ls;
  }
  return row;
}

/** Core savings columns only; ledger_status is optional until migration 007 is applied. */
function toAccountInsert(userId: string, account: SavingsAccount): TablesInsert<'savings_accounts'> {
  const row: TablesInsert<'savings_accounts'> = {
    user_id: userId,
    id: account.id,
    name: account.name,
    current: account.current,
    apy_pct: account.apyPct,
    count_towards_goal: !!account.countTowardsGoal,
    goal_ids: (account.goalIds || []) as string[],
  };
  const ls = account.ledgerStatus;
  if (ls === 'deleted' || ls === 'active') {
    (row as TablesInsert<'savings_accounts'> & { ledger_status?: string }).ledger_status = ls;
  }
  return row;
}

export class AgentDataAccess {
  constructor(
    private readonly admin: SupabaseClient<Database>,
    private readonly userId: string
  ) {}

  async listDebts(opts?: { ledgerStatus?: DebtLedgerStatus | 'all' }): Promise<Debt[]> {
    const filter = opts?.ledgerStatus;
    const { data: debts, error: debtsErr } = await this.admin
      .from('debts')
      .select('*')
      .eq('user_id', this.userId);
    if (debtsErr) throw debtsErr;

    const { data: payments, error: payErr } = await this.admin
      .from('payment_history')
      .select('*')
      .eq('user_id', this.userId);
    if (payErr) throw payErr;

    const byDebt: Record<string, PaymentRow[]> = {};
    for (const p of payments || []) {
      const did = String(p.debt_id || '');
      if (!did) continue;
      (byDebt[did] ||= []).push(p as PaymentRow);
    }

    const mapped = (debts || []).map((d) => mapDebtRow(d as DebtRow, byDebt[String(d.id)] || []));
    return mapped.filter((d) => matchesDebtLedgerFilter(d, filter));
  }

  async getDebt(id: string): Promise<Debt | null> {
    const debts = await this.listDebts({ ledgerStatus: 'all' });
    return debts.find((d) => d.id === id) ?? null;
  }

  async upsertDebt(debt: Debt): Promise<Debt> {
    const row = toDebtInsert(this.userId, debt);
    const { error } = await this.admin.from('debts').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
    const saved = await this.getDebt(debt.id);
    if (!saved) throw new Error('Debt not found after save');
    return saved;
  }

  async addDebtPayment(
    debtId: string,
    payment: { id: string; amount: number; at: string }
  ): Promise<void> {
    const row: TablesInsert<'payment_history'> = {
      user_id: this.userId,
      debt_id: debtId,
      id: payment.id,
      amount: payment.amount,
      at: payment.at,
    };
    const { error } = await this.admin.from('payment_history').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async listSavingsAccounts(): Promise<SavingsAccount[]> {
    const { data: accounts, error: accErr } = await this.admin
      .from('savings_accounts')
      .select('*')
      .eq('user_id', this.userId);
    if (accErr) throw accErr;

    const { data: deposits, error: depErr } = await this.admin
      .from('deposit_history')
      .select('*')
      .eq('user_id', this.userId);
    if (depErr) throw depErr;

    const byAcc: Record<string, DepositRow[]> = {};
    for (const d of deposits || []) {
      const aid = String(d.account_id || '');
      if (!aid) continue;
      (byAcc[aid] ||= []).push(d as DepositRow);
    }

    return (accounts || []).map((a) => mapAccountRow(a as AccountRow, byAcc[String(a.id)] || []));
  }

  async getSavingsAccount(id: string): Promise<SavingsAccount | null> {
    const accounts = await this.listSavingsAccounts();
    return accounts.find((a) => a.id === id) ?? null;
  }

  async upsertSavingsAccount(account: SavingsAccount): Promise<SavingsAccount> {
    const row = toAccountInsert(this.userId, account);
    const { error } = await this.admin.from('savings_accounts').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
    const saved = await this.getSavingsAccount(account.id);
    if (!saved) throw new Error('Savings account not found after save');
    return saved;
  }

  async addSavingsDeposit(
    accountId: string,
    deposit: { id: string; amount: number; at: string }
  ): Promise<void> {
    const row: TablesInsert<'deposit_history'> = {
      user_id: this.userId,
      account_id: accountId,
      id: deposit.id,
      amount: deposit.amount,
      at: deposit.at,
    };
    const { error } = await this.admin.from('deposit_history').upsert(row, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async getPlanSummary(): Promise<{
    monthlyTakeHome: number;
    hysaBalance: number;
    goalHysa: number;
    debtCount: number;
    activeDebtBalance: number;
    savingsAccountCount: number;
    totalSavingsBalance: number;
  }> {
    const { data, error } = await this.admin
      .from('financial_plans')
      .select('monthly_take_home, hysa_balance, goal_hysa')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw error;

    const debts = await this.listDebts({ ledgerStatus: 'active' });
    const accounts = await this.listSavingsAccounts().then((list) =>
      list.filter((a) => a.ledgerStatus !== 'deleted')
    );

    const activeDebtBalance = debts.reduce((sum, d) => sum + (Number(d.current) || 0), 0);
    const totalSavingsBalance = accounts.reduce((sum, a) => sum + (Number(a.current) || 0), 0);

    return {
      monthlyTakeHome: Number(data?.monthly_take_home) || 0,
      hysaBalance: Number(data?.hysa_balance) || 0,
      goalHysa: Number(data?.goal_hysa) || 0,
      debtCount: debts.length,
      activeDebtBalance,
      savingsAccountCount: accounts.length,
      totalSavingsBalance,
    };
  }
}

export function createAgentDataAccess(admin: SupabaseClient<Database>, userId: string): AgentDataAccess {
  return new AgentDataAccess(admin, userId);
}
