import { NextResponse } from 'next/server';

import { authenticateAgentRequest, isAgentAuthContext } from '../../../../../../lib/agent/auth';
import { createAgentDataAccess } from '../../../../../../lib/agent/data-access';
import { formatAgentError } from '../../../../../../lib/agent/errors';
import { agentError, agentJson } from '../../../../../../lib/agent/http';
import { hasAnyScope } from '../../../../../../lib/agent/scopes';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  const authResult = await authenticateAgentRequest(req);
  if (!isAgentAuthContext(authResult)) {
    return authResult;
  }
  if (!hasAnyScope(authResult.scopes, ['read:debts', 'read:savings'])) {
    return agentError('Missing required scope: read:debts or read:savings', 403);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return agentError('Agent API is not configured (missing SUPABASE_SERVICE_ROLE_KEY)', 503);
  }

  try {
    const data = createAgentDataAccess(admin, authResult.userId);
    const summary = await data.getPlanSummary();
    return agentJson({ summary });
  } catch (e) {
    return agentError(formatAgentError(e), 500);
  }
}
