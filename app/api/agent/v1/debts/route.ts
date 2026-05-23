import { NextResponse } from 'next/server';

import { agentJson } from '../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../lib/agent/route-context';
import type { DebtLedgerStatus } from '../../../../../types/index';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  return withAgentRoute(req, 'read:debts', async ({ data }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('ledgerStatus');
    const ledgerStatus =
      status === 'active' || status === 'completed' || status === 'deleted' || status === 'all'
        ? (status as DebtLedgerStatus | 'all')
        : 'active';
    const debts = await data.listDebts({ ledgerStatus });
    return agentJson({ debts });
  });
}
