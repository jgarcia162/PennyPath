import { NextResponse } from 'next/server';

import { agentError, agentJson, readJsonBody } from '../../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../../lib/agent/route-context';
import { mergeDebtPatch } from '../../../../../../lib/agent/validate';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'read:debts', async ({ data }) => {
    const debt = await data.getDebt(id);
    if (!debt) return agentError(`Debt not found: ${id}`, 404);
    return agentJson({ debt });
  });
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'write:debts', async ({ data }) => {
    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if (!parsed.ok) return parsed.response;

    const existing = await data.getDebt(id);
    if (!existing) return agentError(`Debt not found: ${id}`, 404);

    const merged = mergeDebtPatch(existing, parsed.body);
    if (typeof merged === 'string') return agentError(merged, 400);

    const debt = await data.upsertDebt(merged);
    return agentJson({ debt });
  });
}
