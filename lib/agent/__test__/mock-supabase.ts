import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';

type TableEntry = { data: unknown[]; error?: unknown };

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    upsert: vi.fn().mockResolvedValue({ error: result.error ?? null }),
    // Thenable: direct `await chain` resolves to { data, error }
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (fn: (e: unknown) => unknown) => Promise.resolve(result).catch(fn),
    finally: (fn: () => void) => Promise.resolve(result).finally(fn),
  };
  return chain;
}

/**
 * Creates a minimal mock SupabaseClient for unit-testing AgentDataAccess.
 *
 * Pass per-table data; any table not listed defaults to { data: [], error: null }.
 * The returned `from` is a `vi.fn()` so tests can call `.mock.calls` to verify
 * which tables were queried, or use `mockReturnValueOnce` for sequential overrides.
 */
export function createMockSupabase(
  tables: Record<string, TableEntry> = {}
): SupabaseClient<Database> {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const entry = tables[table];
      return makeChain({ data: entry?.data ?? [], error: entry?.error ?? null });
    }),
  } as unknown as SupabaseClient<Database>;
}

/** Make a minimal debt DB row with sensible defaults. */
export function makeDebtRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Test Debt',
    current: 1000,
    paid_off: 200,
    apr_pct: 19.99,
    deferred_amount: 0,
    deferred_expires_on: '',
    deferred_months_remaining: 0,
    ledger_status: 'active',
    ...overrides,
  };
}

/** Make a minimal savings account DB row with sensible defaults. */
export function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Emergency Fund',
    current: 5000,
    apy_pct: 4.5,
    count_towards_goal: true,
    goal_ids: [],
    ledger_status: 'active',
    ...overrides,
  };
}

/** Make a minimal payment history DB row. */
export function makePaymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ph1',
    user_id: 'u1',
    debt_id: 'd1',
    amount: 150,
    at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Make a minimal deposit history DB row. */
export function makeDepositRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dep1',
    user_id: 'u1',
    account_id: 'a1',
    amount: 500,
    at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}
