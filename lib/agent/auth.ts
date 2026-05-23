import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '../supabase/admin';
import { hashAgentToken, isAgentTokenFormat } from './token-crypto';

export type AgentAuthContext = {
  userId: string;
  tokenId: string;
  scopes: string[];
  tokenName: string;
};

function unauthorized(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function forbidden(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}

export async function authenticateAgentRequest(
  req: Request,
  requiredScope?: string
): Promise<AgentAuthContext | NextResponse> {
  const plaintext = getBearerToken(req);
  if (!plaintext) {
    return unauthorized('Missing Authorization: Bearer <agent token>');
  }
  if (!isAgentTokenFormat(plaintext)) {
    return unauthorized('Invalid agent token format');
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Agent API is not configured (missing SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 }
    );
  }

  const tokenHash = hashAgentToken(plaintext);
  const { data, error } = await admin
    .from('agent_api_tokens')
    .select('id, user_id, name, scopes, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'Token lookup failed' }, { status: 500 });
  }
  if (!data || data.revoked_at) {
    return unauthorized('Invalid or revoked agent token');
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return unauthorized('Agent token expired');
  }

  const scopes = Array.isArray(data.scopes) ? data.scopes.map(String) : [];
  if (requiredScope && !scopes.includes(requiredScope)) {
    return forbidden(`Missing required scope: ${requiredScope}`);
  }

  void admin
    .from('agent_api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    userId: data.user_id,
    tokenId: data.id,
    scopes,
    tokenName: data.name,
  };
}

export function isAgentAuthContext(v: AgentAuthContext | NextResponse): v is AgentAuthContext {
  return !(v instanceof NextResponse);
}
