import { NextResponse } from 'next/server';

import { agentJson } from '../../../../../lib/agent/http';
import { withAgentRoute } from '../../../../../lib/agent/route-context';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  return withAgentRoute(req, 'read:savings', async ({ data }) => {
    const accounts = await data.listSavingsAccounts();
    return agentJson({ savingsAccounts: accounts });
  });
}
