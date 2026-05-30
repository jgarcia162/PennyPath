import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRouteContext } from '../../../../../../lib/agent/route-context';

// ---------------------------------------------------------------------------
// Mock withAgentRoute
// ---------------------------------------------------------------------------

const mockData = {
  getDebt: vi.fn(),
  upsertDebt: vi.fn(),
};

vi.mock('../../../../../../lib/agent/route-context', () => ({
  withAgentRoute: vi.fn().mockImplementation(
    async (_req: Request, _scope: string, handler: (ctx: AgentRouteContext) => Promise<Response>) =>
      handler({ auth: { userId: 'u1', tokenId: 't1', scopes: ['read:debts', 'write:debts'], tokenName: 'test' }, data: mockData as never })
  ),
}));

const { GET, PATCH } = await import('./route');

// ---------------------------------------------------------------------------
// Fixtures
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

function makeGetRequest() {
  return new Request('http://localhost/api/agent/v1/debts/d1', {
    method: 'GET',
    headers: { Authorization: 'Bearer pp_agent_test' },
  });
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost/api/agent/v1/debts/d1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET /debts/[id]
// ---------------------------------------------------------------------------

describe('GET /debts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.getDebt.mockResolvedValue(makeDebt());
  });

  it('returns 200 with the debt on success', async () => {
    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.debt.id).toBe('d1');
  });

  it('returns 404 when debt is not found', async () => {
    mockData.getDebt.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('d1');
  });
});

// ---------------------------------------------------------------------------
// PATCH /debts/[id]
// ---------------------------------------------------------------------------

describe('PATCH /debts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.getDebt.mockResolvedValue(makeDebt());
    mockData.upsertDebt.mockImplementation((d: unknown) => Promise.resolve(d));
  });

  it('returns 200 with updated debt on success', async () => {
    const res = await PATCH(makePatchRequest({ name: 'New Name' }), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.debt).toBeDefined();
  });

  it('applies the name patch', async () => {
    let savedDebt: ReturnType<typeof makeDebt> | null = null;
    mockData.upsertDebt.mockImplementation((d: ReturnType<typeof makeDebt>) => {
      savedDebt = d;
      return Promise.resolve(d);
    });
    await PATCH(makePatchRequest({ name: 'Updated Name' }), { params: Promise.resolve({ id: 'd1' }) });
    expect(savedDebt!.name).toBe('Updated Name');
  });

  it('returns 404 when debt is not found', async () => {
    mockData.getDebt.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ current: 500 }), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when current is negative', async () => {
    const res = await PATCH(makePatchRequest({ current: -100 }), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/current/);
  });

  it('returns 400 when aprPct is negative', async () => {
    const res = await PATCH(makePatchRequest({ aprPct: -5 }), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/agent/v1/debts/d1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pp_agent_test' },
      body: '{ bad json }',
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'd1' }) });
    expect(res.status).toBe(400);
  });

  it('updates ledgerStatus to completed', async () => {
    let savedDebt: ReturnType<typeof makeDebt> | null = null;
    mockData.upsertDebt.mockImplementation((d: ReturnType<typeof makeDebt>) => {
      savedDebt = d;
      return Promise.resolve(d);
    });
    await PATCH(makePatchRequest({ ledgerStatus: 'completed' }), {
      params: Promise.resolve({ id: 'd1' }),
    });
    expect(savedDebt!.ledgerStatus).toBe('completed');
  });
});
