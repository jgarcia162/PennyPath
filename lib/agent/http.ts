import { NextResponse } from 'next/server';

export function agentJson<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function agentError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function readJsonBody<T extends Record<string, unknown>>(
  req: Request
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  try {
    const body = (await req.json()) as T;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, response: agentError('JSON body must be an object', 400) };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, response: agentError('Invalid JSON body', 400) };
  }
}
