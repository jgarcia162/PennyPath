import { NextResponse } from 'next/server';

import { agentError, agentJson, readJsonBody } from '../../../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../../../lib/agent/route-context';
import { mergeSavingsPatch, newDepositId, parseOptionalNumber } from '../../../../../../../lib/agent/validate';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'write:savings', async ({ data }) => {
    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if (!parsed.ok) return parsed.response;

    const amount = parseOptionalNumber(parsed.body.amount);
    if (amount === undefined || amount <= 0) {
      return agentError('amount must be a positive number', 400);
    }

    const existing = await data.getSavingsAccount(id);
    if (!existing) return agentError(`Savings account not found: ${id}`, 404);

    const at =
      typeof parsed.body.at === 'string' && parsed.body.at.trim()
        ? parsed.body.at.trim()
        : new Date().toISOString();

    const depositId = newDepositId();
    await data.addSavingsDeposit(id, { id: depositId, amount, at });

    const nextCurrent = (Number(existing.current) || 0) + amount;
    const merged = mergeSavingsPatch(existing, { current: nextCurrent });
    if (typeof merged === 'string') return agentError(merged, 400);

    const savingsAccount = await data.upsertSavingsAccount(merged);
    return agentJson({ savingsAccount, deposit: { id: depositId, amount, at } });
  });
}
