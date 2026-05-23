import { NextResponse } from 'next/server';

import { agentError, agentJson, readJsonBody } from '../../../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../../../lib/agent/route-context';
import { mergeDebtPatch, newPaymentId, parseOptionalNumber } from '../../../../../../../lib/agent/validate';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return withAgentRoute(req, 'write:debts', async ({ data }) => {
    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if (!parsed.ok) return parsed.response;

    const amount = parseOptionalNumber(parsed.body.amount);
    if (amount === undefined || amount <= 0) {
      return agentError('amount must be a positive number', 400);
    }

    const existing = await data.getDebt(id);
    if (!existing) return agentError(`Debt not found: ${id}`, 404);

    const at =
      typeof parsed.body.at === 'string' && parsed.body.at.trim()
        ? parsed.body.at.trim()
        : new Date().toISOString();

    const paymentId = newPaymentId();
    await data.addDebtPayment(id, { id: paymentId, amount, at });

    const nextCurrent = Math.max(0, (Number(existing.current) || 0) - amount);
    const nextPaidOff = (Number(existing.paidOff) || 0) + amount;
    const merged = mergeDebtPatch(existing, { current: nextCurrent, paidOff: nextPaidOff });
    if (typeof merged === 'string') return agentError(merged, 400);

    const debt = await data.upsertDebt(merged);
    return agentJson({ debt, payment: { id: paymentId, amount, at } });
  });
}
