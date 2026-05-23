import { NextResponse } from 'next/server';

import { agentError, agentJson, readJsonBody } from '../../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../../lib/agent/route-context';
import { mergeSavingsPatch } from '../../../../../../lib/agent/validate';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'read:savings', async ({ data }) => {
    const account = await data.getSavingsAccount(id);
    if (!account) return agentError(`Savings account not found: ${id}`, 404);
    return agentJson({ savingsAccount: account });
  });
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'write:savings', async ({ data }) => {
    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if (!parsed.ok) return parsed.response;

    const existing = await data.getSavingsAccount(id);
    if (!existing) return agentError(`Savings account not found: ${id}`, 404);

    const merged = mergeSavingsPatch(existing, parsed.body);
    if (typeof merged === 'string') return agentError(merged, 400);

    const savingsAccount = await data.upsertSavingsAccount(merged);
    return agentJson({ savingsAccount });
  });
}
