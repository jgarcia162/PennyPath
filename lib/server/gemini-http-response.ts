import { NextResponse } from 'next/server';

import type { GeminiEnvelopeResult } from './gemini-api';
import { keySentDebug, summarizeGeminiFailure } from './gemini-api';

/** Maps failed Gemini envelopes to HTTP responses consistent with `server/market-research.mjs`. */
export function jsonFromGeminiFailure(apiKey: string, g: GeminiEnvelopeResult): NextResponse | null {
  if (g.ok) return null;

  if (g.step === 'network') {
    const err = g.error as Error | undefined;
    if (err?.name === 'AbortError') {
      return NextResponse.json({ ok: false, error: 'Gemini request timed out', keySent: keySentDebug(apiKey) }, {
        status: 504,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? err ?? 'Network error'),
        keySent: keySentDebug(apiKey),
      },
      { status: 500 }
    );
  }

  if (g.step === 'http') {
    const gemini = summarizeGeminiFailure(g.httpStatus!, g.text || '');
    return NextResponse.json(
      { ok: false, error: 'Gemini request failed', gemini, keySent: keySentDebug(apiKey) },
      { status: 502 }
    );
  }

  if (g.step === 'gemini_json') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Gemini returned non-JSON',
        detail: g.detail,
        keySent: keySentDebug(apiKey),
      },
      { status: 502 }
    );
  }

  if (g.step === 'gemini_obj') {
    const gemini = summarizeGeminiFailure(g.httpStatus || 200, g.text || '');
    return NextResponse.json(
      {
        ok: false,
        error: 'Gemini returned an error object',
        gemini,
        keySent: keySentDebug(apiKey),
      },
      { status: 502 }
    );
  }

  if (g.step === 'extract') {
    return NextResponse.json(
      {
        ok: false,
        error: String(g.error ?? 'Extract failed'),
        gemini: summarizeGeminiFailure(200, g.text || ''),
        keySent: keySentDebug(apiKey),
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { ok: false, error: 'Unexpected Gemini error', keySent: keySentDebug(apiKey) },
    { status: 500 }
  );
}

export async function readJsonBodyLimited(req: Request): Promise<{ ok: true; payload: unknown } | { ok: false; response: NextResponse }> {
  const raw = await req.text();
  if (raw.length > 1_000_000) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Request body too large' }, { status: 413 }),
    };
  }
  try {
    return { ok: true, payload: JSON.parse(raw || '{}') };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

export function requireGeminiApiKey(): string | NextResponse {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'GEMINI_API_KEY is not set on the server. Add it to Vercel environment variables (Preview vs Production) or .env locally.',
      },
      { status: 503 }
    );
  }
  return apiKey.trim();
}
