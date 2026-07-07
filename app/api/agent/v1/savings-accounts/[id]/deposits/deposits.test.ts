import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRouteContext } from '../../../../../../../lib/agent/route-context';

// ---------------------------------------------------------------------------
// Mock withAgentRoute
// ---------------------------------------------------------------------------

const mockData = {
  getSavingsAccount: vi.fn(),
  upsertSavingsAccount: vi.fn(),
  addSavingsDeposit: vi.fn(),
};

vi.mock('../../../../../../../lib/agent/route-context', () => ({
  withAgentRoute: vi.fn().mockImplementation(
    async (_req: Request, _scope: string, handler: (ctx: AgentRouteContext) => Promise<Response>) =>
      handler({ auth: { userId: 'u1', tokenId: 't1', scopes: ['write:savings'], tokenName: 'test' }, data: mockData as never })
  ),
}));

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    name: 'Emergency Fund',
    current: 5000,
    apyPct: 4.5,
    goalIds: [] as string[],
    countTowardsGoal: true,
    depositHistory: [],
    ...overrides,
  };
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/agent/v1/savings-accounts/a1/deposits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /savings-accounts/[id]/deposits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.getSavingsAccount.mockResolvedValue(makeAccount());
    mockData.addSavingsDeposit.mockResolvedValue(undefined);
    mockData.upsertSavingsAccount.mockImplementation((a: unknown) => Promise.resolve(a));
  });

  it('returns 400 when amount is missing', async () => {
    const res = await POST(makePostRequest({}), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount/);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await POST(makePostRequest({ amount: 0 }), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await POST(makePostRequest({ amount: -100 }), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/agent/v1/savings-accounts/a1/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
      body: '{ not json }',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when savings account is not found', async () => {
    mockData.getSavingsAccount.mockResolvedValue(null);
    const res = await POST(makePostRequest({ amount: 500 }), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('a1');
  });

  it('returns 200 with updated account and deposit on success', async () => {
    const res = await POST(makePostRequest({ amount: 500 }), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.savingsAccount).toBeDefined();
    expect(body.deposit).toBeDefined();
    expect(body.deposit.amount).toBe(500);
  });

  it('increments current balance by the deposit amount', async () => {
    const account = makeAccount({ current: 5000 });
    mockData.getSavingsAccount.mockResolvedValue(account);
    let savedAccount: ReturnType<typeof makeAccount> | null = null;
    mockData.upsertSavingsAccount.mockImplementation((a: ReturnType<typeof makeAccount>) => {
      savedAccount = a;
      return Promise.resolve(a);
    });

    await POST(makePostRequest({ amount: 1000 }), { params: Promise.resolve({ id: 'a1' }) });

    expect(savedAccount!.current).toBe(6000);
  });

  it('deposit id starts with dep_agent_', async () => {
    const res = await POST(makePostRequest({ amount: 500 }), { params: Promise.resolve({ id: 'a1' }) });
    const body = await res.json();
    expect(body.deposit.id).toMatch(/^dep_agent_/);
  });

  it('uses provided `at` timestamp when given', async () => {
    const at = '2026-01-15T10:00:00.000Z';
    const res = await POST(makePostRequest({ amount: 250, at }), { params: Promise.resolve({ id: 'a1' }) });
    const body = await res.json();
    expect(body.deposit.at).toBe(at);
  });
});
