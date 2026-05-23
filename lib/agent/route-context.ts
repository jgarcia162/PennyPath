import { NextResponse } from 'next/server';

import { authenticateAgentRequest, isAgentAuthContext, type AgentAuthContext } from './auth';
import { createAgentDataAccess, type AgentDataAccess } from './data-access';
import { formatAgentError } from './errors';
import { agentError } from './http';
import { createSupabaseAdminClient } from '../supabase/admin';

export type AgentRouteContext = {
  auth: AgentAuthContext;
  data: AgentDataAccess;
};

export async function withAgentRoute(
  req: Request,
  requiredScope: string | undefined,
  handler: (ctx: AgentRouteContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await authenticateAgentRequest(req, requiredScope);
  if (!isAgentAuthContext(authResult)) {
    return authResult;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return agentError('Agent API is not configured (missing SUPABASE_SERVICE_ROLE_KEY)', 503);
  }

  try {
    return await handler({
      auth: authResult,
      data: createAgentDataAccess(admin, authResult.userId),
    });
  } catch (e) {
    const message = formatAgentError(e);
    return agentError(message, 500);
  }
}
