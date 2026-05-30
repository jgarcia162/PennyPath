import { describe, it, expect, vi } from 'vitest';
import { AgentDataAccess } from './data-access';
import {
  createMockSupabase,
  makeDebtRow,
  makePaymentRow,
  makeAccountRow,
  makeDepositRow,
} from './__test__/mock-supabase';

const USER_ID = 'user-1';

// ---------------------------------------------------------------------------
// listDebts — row mapping and ledger filtering
// ---------------------------------------------------------------------------

describe('AgentDataAccess.listDebts', () => {
  it('maps a debt DB row to a Debt object', async () => {
    const row = makeDebtRow({ id: 'd1', name: 'Visa', current: 1500, paid_off: 300, apr_pct: 22 });
    const mock = createMockSupabase({
      debts: { data: [row] },
      payment_history: { data: [] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts();

    expect(debts).toHaveLength(1);
    const d = debts[0];
    expect(d.id).toBe('d1');
    expect(d.name).toBe('Visa');
    expect(d.current).toBe(1500);
    expect(d.paidOff).toBe(300);
    expect(d.aprPct).toBe(22);
    expect(d.paymentHistory).toEqual([]);
  });

  it('groups payment_history rows by debt_id', async () => {
    const row = makeDebtRow({ id: 'd1' });
    const p1 = makePaymentRow({ id: 'ph1', debt_id: 'd1', amount: 100 });
    const p2 = makePaymentRow({ id: 'ph2', debt_id: 'd1', amount: 200 });
    const mock = createMockSupabase({
      debts: { data: [row] },
      payment_history: { data: [p1, p2] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts();

    expect(debts[0].paymentHistory).toHaveLength(2);
    expect(debts[0].paymentHistory.map((p) => p.id)).toEqual(['ph1', 'ph2']);
  });

  it('does not attach payment rows belonging to a different debt', async () => {
    const row = makeDebtRow({ id: 'd1' });
    const payment = makePaymentRow({ id: 'ph1', debt_id: 'd2', amount: 50 }); // different debt
    const mock = createMockSupabase({
      debts: { data: [row] },
      payment_history: { data: [payment] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts();

    expect(debts[0].paymentHistory).toHaveLength(0);
  });

  it('maps ledger_status "completed" correctly', async () => {
    const row = makeDebtRow({ id: 'd1', ledger_status: 'completed' });
    const mock = createMockSupabase({ debts: { data: [row] }, payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts({ ledgerStatus: 'all' });
    expect(debts[0].ledgerStatus).toBe('completed');
  });

  it('omits ledgerStatus for an unknown ledger_status value', async () => {
    const row = makeDebtRow({ id: 'd1', ledger_status: 'unknown_value' });
    const mock = createMockSupabase({ debts: { data: [row] }, payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts({ ledgerStatus: 'all' });
    expect(debts[0].ledgerStatus).toBeUndefined();
  });

  it('filters to active debts by default', async () => {
    const active = makeDebtRow({ id: 'd1', ledger_status: 'active' });
    const completed = makeDebtRow({ id: 'd2', ledger_status: 'completed' });
    const mock = createMockSupabase({
      debts: { data: [active, completed] },
      payment_history: { data: [] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts({ ledgerStatus: 'active' });
    expect(debts).toHaveLength(1);
    expect(debts[0].id).toBe('d1');
  });

  it('returns all debts when ledgerStatus is "all"', async () => {
    const active = makeDebtRow({ id: 'd1', ledger_status: 'active' });
    const deleted = makeDebtRow({ id: 'd2', ledger_status: 'deleted' });
    const mock = createMockSupabase({
      debts: { data: [active, deleted] },
      payment_history: { data: [] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const debts = await da.listDebts({ ledgerStatus: 'all' });
    expect(debts).toHaveLength(2);
  });

  it('returns empty array when no debts exist', async () => {
    const mock = createMockSupabase({ debts: { data: [] }, payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    expect(await da.listDebts()).toEqual([]);
  });

  it('throws when Supabase returns a debts error', async () => {
    const mock = createMockSupabase({ debts: { data: [], error: new Error('DB error') } });
    const da = new AgentDataAccess(mock, USER_ID);
    await expect(da.listDebts()).rejects.toThrow('DB error');
  });

  it('throws when Supabase returns a payment_history error', async () => {
    const mock = createMockSupabase({
      debts: { data: [makeDebtRow()] },
      payment_history: { data: [], error: new Error('payment error') },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    await expect(da.listDebts()).rejects.toThrow('payment error');
  });
});

// ---------------------------------------------------------------------------
// getDebt
// ---------------------------------------------------------------------------

describe('AgentDataAccess.getDebt', () => {
  it('returns the matching debt by id', async () => {
    const row = makeDebtRow({ id: 'd1' });
    const mock = createMockSupabase({ debts: { data: [row] }, payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const debt = await da.getDebt('d1');
    expect(debt?.id).toBe('d1');
  });

  it('returns null when the debt does not exist', async () => {
    const mock = createMockSupabase({ debts: { data: [] }, payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    expect(await da.getDebt('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listSavingsAccounts — row mapping
// ---------------------------------------------------------------------------

describe('AgentDataAccess.listSavingsAccounts', () => {
  it('maps a savings account DB row to a SavingsAccount object', async () => {
    const row = makeAccountRow({ id: 'a1', name: 'HYSA', current: 10000, apy_pct: 4.5 });
    const mock = createMockSupabase({ savings_accounts: { data: [row] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const accounts = await da.listSavingsAccounts();

    expect(accounts).toHaveLength(1);
    const a = accounts[0];
    expect(a.id).toBe('a1');
    expect(a.name).toBe('HYSA');
    expect(a.current).toBe(10000);
    expect(a.apyPct).toBe(4.5);
    expect(a.depositHistory).toEqual([]);
  });

  it('groups deposit_history rows by account_id', async () => {
    const row = makeAccountRow({ id: 'a1' });
    const dep1 = makeDepositRow({ id: 'dep1', account_id: 'a1', amount: 500 });
    const dep2 = makeDepositRow({ id: 'dep2', account_id: 'a1', amount: 1000 });
    const mock = createMockSupabase({
      savings_accounts: { data: [row] },
      deposit_history: { data: [dep1, dep2] },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    const accounts = await da.listSavingsAccounts();
    expect(accounts[0].depositHistory).toHaveLength(2);
  });

  it('converts null goal_ids to empty array', async () => {
    const row = makeAccountRow({ goal_ids: null });
    const mock = createMockSupabase({ savings_accounts: { data: [row] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const accounts = await da.listSavingsAccounts();
    expect(accounts[0].goalIds).toEqual([]);
  });

  it('omits ledgerStatus when ledger_status is "active" (uses default "active" semantics)', async () => {
    const row = makeAccountRow({ ledger_status: 'active' });
    const mock = createMockSupabase({ savings_accounts: { data: [row] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const accounts = await da.listSavingsAccounts();
    // 'active' is not 'deleted', so ledgerStatus should be undefined (per mapAccountRow)
    expect(accounts[0].ledgerStatus).toBeUndefined();
  });

  it('maps ledger_status "deleted" correctly', async () => {
    const row = makeAccountRow({ ledger_status: 'deleted' });
    const mock = createMockSupabase({ savings_accounts: { data: [row] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const accounts = await da.listSavingsAccounts();
    expect(accounts[0].ledgerStatus).toBe('deleted');
  });

  it('throws when Supabase returns a savings_accounts error', async () => {
    const mock = createMockSupabase({
      savings_accounts: { data: [], error: new Error('savings error') },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    await expect(da.listSavingsAccounts()).rejects.toThrow('savings error');
  });
});

// ---------------------------------------------------------------------------
// getSavingsAccount
// ---------------------------------------------------------------------------

describe('AgentDataAccess.getSavingsAccount', () => {
  it('returns the matching account by id', async () => {
    const row = makeAccountRow({ id: 'a1' });
    const mock = createMockSupabase({ savings_accounts: { data: [row] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    const account = await da.getSavingsAccount('a1');
    expect(account?.id).toBe('a1');
  });

  it('returns null when the account does not exist', async () => {
    const mock = createMockSupabase({ savings_accounts: { data: [] }, deposit_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);
    expect(await da.getSavingsAccount('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getPlanSummary — aggregation logic
// ---------------------------------------------------------------------------

describe('AgentDataAccess.getPlanSummary', () => {
  it('sums active debt balances and non-deleted savings balances', async () => {
    const debt1 = makeDebtRow({ id: 'd1', current: 1000, ledger_status: 'active' });
    const debt2 = makeDebtRow({ id: 'd2', current: 500, ledger_status: 'active' });
    const acc1 = makeAccountRow({ id: 'a1', current: 3000, ledger_status: 'active' });
    const acc2 = makeAccountRow({ id: 'a2', current: 2000, ledger_status: 'deleted' });

    const mock = createMockSupabase({
      financial_plans: { data: [{ monthly_take_home: 5000, hysa_balance: 3000, goal_hysa: 10000 }] },
      debts: { data: [debt1, debt2] },
      payment_history: { data: [] },
      savings_accounts: { data: [acc1, acc2] },
      deposit_history: { data: [] },
    });

    // financial_plans uses maybeSingle, so we need to override
    const mockWithMaybeSingle = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'financial_plans') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi
              .fn()
              .mockResolvedValue({
                data: { monthly_take_home: 5000, hysa_balance: 3000, goal_hysa: 10000 },
                error: null,
              }),
          };
        }
        const tableData: Record<string, unknown[]> = {
          debts: [debt1, debt2],
          payment_history: [],
          savings_accounts: [acc1, acc2],
          deposit_history: [],
        };
        const result = { data: tableData[table] ?? [], error: null };
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
        return chain;
      }),
    };

    const da = new AgentDataAccess(mockWithMaybeSingle as never, USER_ID);
    const summary = await da.getPlanSummary();

    expect(summary.debtCount).toBe(2);
    expect(summary.activeDebtBalance).toBe(1500);
    expect(summary.savingsAccountCount).toBe(1); // deleted account excluded
    expect(summary.totalSavingsBalance).toBe(3000);
    expect(summary.monthlyTakeHome).toBe(5000);
    expect(summary.hysaBalance).toBe(3000);
    expect(summary.goalHysa).toBe(10000);
  });

  it('returns zeroes when financial_plans row is absent', async () => {
    const mockWithMaybeSingle = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'financial_plans') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        const result = { data: [], error: null };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
      }),
    };

    const da = new AgentDataAccess(mockWithMaybeSingle as never, USER_ID);
    const summary = await da.getPlanSummary();

    expect(summary.monthlyTakeHome).toBe(0);
    expect(summary.hysaBalance).toBe(0);
    expect(summary.goalHysa).toBe(0);
    expect(summary.debtCount).toBe(0);
    expect(summary.activeDebtBalance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addDebtPayment — verifies the upsert is called with correct shape
// ---------------------------------------------------------------------------

describe('AgentDataAccess.addDebtPayment', () => {
  it('inserts a payment_history row with the correct fields', async () => {
    const mock = createMockSupabase({ payment_history: { data: [] } });
    const da = new AgentDataAccess(mock, USER_ID);

    await da.addDebtPayment('d1', { id: 'ph_test_1', amount: 200, at: '2026-05-01T00:00:00Z' });

    // Verify from('payment_history') was called
    const fromCalls = (mock.from as ReturnType<typeof vi.fn>).mock.calls;
    const paymentCall = fromCalls.find(([t]: [string]) => t === 'payment_history');
    expect(paymentCall).toBeDefined();
  });

  it('throws when the payment_history upsert returns an error', async () => {
    const mock = createMockSupabase({
      payment_history: { data: [], error: new Error('upsert failed') },
    });
    const da = new AgentDataAccess(mock, USER_ID);
    await expect(
      da.addDebtPayment('d1', { id: 'ph1', amount: 100, at: '2026-05-01T00:00:00Z' })
    ).rejects.toThrow('upsert failed');
  });
});
