import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRouteContext } from '../../../../../../../lib/agent/route-context';

// ---------------------------------------------------------------------------
// Mock withAgentRoute so route tests bypass auth entirely
// ---------------------------------------------------------------------------

const mockData = {
  getDebt: vi.fn(),
  upsertDebt: vi.fn(),
  addDebtPayment: vi.fn(),
};

vi.mock('../../../../../../../lib/agent/route-context', () => ({
  withAgentRoute: vi.fn().mockImplementation(
    async (_req: Request, _scope: string, handler: (ctx: AgentRouteContext) => Promise<Response>) =>
      handler({ auth: { userId: 'u1', tokenId: 't1', scopes: ['write:debts'], tokenName: 'test' }, data: mockData as never })
  ),
}));

// Import AFTER mocking
const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDebt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    name: 'Credit Card',
    current: 1000,
    paidOff: 200,
    aprPct: 19.99,
    deferredAmount: 0,
    deferredExpiresOn: '' as const,
    deferredMonthsRemaining: 0,
    paymentHistory: [],
    ledgerStatus: 'active' as const,
    ...overrides,
  };
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/agent/v1/debts/d1/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /debts/[id]/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.getDebt.mockResolvedValue(makeDebt());
    mockData.addDebtPayment.mockResolvedValue(undefined);
    mockData.upsertDebt.mockImplementation((d: unknown) => Promise.resolve(d));
  });

  it('returns 400 when amount is missing', async () => {
    const res = await POST(makePostRequest({}), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/amount/);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await POST(makePostRequest({ amount: 0 }), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await POST(makePostRequest({ amount: -50 }), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/agent/v1/debts/d1/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
      body: '{ not json }',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when debt is not found', async () => {
    mockData.getDebt.mockResolvedValue(null);
    const res = await POST(makePostRequest({ amount: 100 }), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('d1');
  });

  it('returns 200 with updated debt and payment on success', async () => {
    const res = await POST(makePostRequest({ amount: 100 }), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.debt).toBeDefined();
    expect(body.payment).toBeDefined();
    expect(body.payment.amount).toBe(100);
  });

  it('decrements current balance and increments paidOff', async () => {
    const debt = makeDebt({ current: 1000, paidOff: 200 });
    mockData.getDebt.mockResolvedValue(debt);
    let savedDebt: ReturnType<typeof makeDebt> | null = null;
    mockData.upsertDebt.mockImplementation((d: ReturnType<typeof makeDebt>) => {
      savedDebt = d;
      return Promise.resolve(d);
    });

    await POST(makePostRequest({ amount: 150 }), { params: Promise.resolve({ id: 'd1' }) });

    expect(savedDebt).not.toBeNull();
    expect(savedDebt!.current).toBe(850);
    expect(savedDebt!.paidOff).toBe(350);
  });

  it('clamps current balance to 0 when payment exceeds balance', async () => {
    const debt = makeDebt({ current: 50, paidOff: 0 });
    mockData.getDebt.mockResolvedValue(debt);
    let savedDebt: ReturnType<typeof makeDebt> | null = null;
    mockData.upsertDebt.mockImplementation((d: ReturnType<typeof makeDebt>) => {
      savedDebt = d;
      return Promise.resolve(d);
    });

    await POST(makePostRequest({ amount: 200 }), { params: Promise.resolve({ id: 'd1' }) });

    expect(savedDebt!.current).toBe(0);
  });

  it('payment id starts with ph_agent_', async () => {
    const res = await POST(makePostRequest({ amount: 100 }), { params: Promise.resolve({ id: 'd1' }) });
    const body = await res.json();
    expect(body.payment.id).toMatch(/^ph_agent_/);
  });
});
