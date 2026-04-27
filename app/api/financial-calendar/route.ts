import { NextResponse } from 'next/server';

import { keySentDebug, runFinancialCalendar } from '../../../lib/server/gemini-api';
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
    const out = await runFinancialCalendar(parsed.payload as Record<string, unknown>, apiKey);
    if (!out.ok) {
      if ('clientError' in out && out.clientError) {
        return NextResponse.json({ ok: false, error: out.clientError }, { status: 400 });
      }
      if ('envelope' in out && out.envelope) {
        const errResp = jsonFromGeminiFailure(apiKey, out.envelope);
        if (errResp) return errResp;
      }
      if ('error' in out && out.error) {
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
      return NextResponse.json({ ok: false, error: 'Unexpected failure', keySent: keySentDebug(apiKey) }, {
        status: 500,
      });
    }
    return NextResponse.json({
      ok: true,
      data: out.data,
      truncated: out.truncated,
      finishReason: out.finishReason,
    });
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
