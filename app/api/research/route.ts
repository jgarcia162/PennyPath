import { NextResponse } from 'next/server';

import { keySentDebug, runResearch } from '../../../lib/server/gemini-api';
import {
  jsonFromGeminiFailure,
  readJsonBodyLimited,
  requireGeminiApiKey,
} from '../../../lib/server/gemini-http-response';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const apiKeyOrErr = requireGeminiApiKey();
  if (apiKeyOrErr instanceof NextResponse) return apiKeyOrErr;
  const apiKey = apiKeyOrErr;

  const parsed = await readJsonBodyLimited(req);
  if (!parsed.ok) return parsed.response;

  try {
    const out = await runResearch(parsed.payload as Record<string, unknown>, apiKey);
    if (!out.ok) {
      if ('envelope' in out && out.envelope) {
        const errResp = jsonFromGeminiFailure(apiKey, out.envelope);
        if (errResp) return errResp;
      }
      return NextResponse.json(
        {
          ok: false,
          error: out.error,
          detail: 'detail' in out ? out.detail : undefined,
          keySent: keySentDebug(apiKey),
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, data: out.data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e instanceof Error ? e.message : e),
        keySent: keySentDebug(apiKey),
      },
      { status: 500 }
    );
  }
}
