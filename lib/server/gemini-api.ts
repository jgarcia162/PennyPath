/**
 * Shared Gemini logic for Next.js Route Handlers and parity with `server/market-research.mjs`.
 * Keep in sync when changing prompts or transport in the standalone dev server.
 */

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const MAX_BODY_BYTES = 1_000_000;
/** Default deadline for Gemini :generateContent (full response body). */
export const GEMINI_FETCH_TIMEOUT_MS = 30_000;

const DEFAULT_SLOW_MS = 57_000;

function resolveGeminiSlowFetchTimeoutMs(): number {
  const raw = process.env.GEMINI_SLOW_FETCH_MS ?? process.env.GEMINI_SLOW_FETCH_TIMEOUT_MS;
  const n = raw != null ? Number(String(raw).trim()) : NaN;
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : DEFAULT_SLOW_MS;
}

/** Longer deadline for heavy prompts (financial payoff / bill calendar JSON). Override via GEMINI_SLOW_FETCH_MS. */
export const GEMINI_SLOW_FETCH_TIMEOUT_MS = resolveGeminiSlowFetchTimeoutMs();

export const RESEARCH_SYSTEM_PROMPT = `You are a conservative underwriting assistant for U.S. residential real estate (condo/townhouse) rental analysis.
Given a location, return realistic BALLPARK numbers for planning only — not legal or investment advice.
Respond with a single JSON object (no markdown) with these keys exactly:
- purchasePrice: number (USD, typical entry-level condo/townhouse median-ish for that metro)
- monthlyRent: number (USD, 1BR or small 2BR market rent estimate)
- monthlyHoa: number (USD, typical monthly HOA for similar product)
- propertyTaxRatePercent: number (effective annual rate as percent of value, e.g. 1.2)
- insuranceMonthly: number (USD, landlord policy ballpark; note wind/flood may differ)
- vacancyPercent: number (planning vacancy, e.g. 5 to 8)
- notes: string (2-4 sentences: what you assumed and that user must verify with listings and quotes)

Use recent general market knowledge; if uncertain, prefer conservative (slightly higher expenses).`;

export function keySentDebug(apiKey: string | undefined) {
  const k = String(apiKey || '');
  if (!k) return undefined;
  const out: { length: number; prefix: string; suffix: string; full?: string } = {
    length: k.length,
    prefix: k.slice(0, Math.min(12, k.length)),
    suffix: k.length > 4 ? k.slice(-4) : k,
  };
  const dbg = process.env.DEBUG_API_KEY_IN_ERRORS || process.env.DEBUG_OPENAI_KEY_IN_ERRORS;
  if (dbg === '1' || /^true$/i.test(String(dbg))) {
    out.full = k;
  }
  return out;
}

export function summarizeGeminiFailure(httpStatus: number, bodyText: string) {
  const out: {
    httpStatus: number;
    message: string | null;
    type: string | null;
    code: string | null;
    status: string | null;
    rawSnippet: string;
  } = {
    httpStatus,
    message: null,
    type: null,
    code: null,
    status: null,
    rawSnippet: String(bodyText || '').slice(0, 2500),
  };
  try {
    const j = JSON.parse(bodyText) as { error?: { message?: unknown; status?: unknown; code?: unknown } };
    if (j.error && typeof j.error === 'object') {
      out.message = j.error.message != null ? String(j.error.message) : null;
      out.status = j.error.status != null ? String(j.error.status) : null;
      out.code = j.error.code != null ? String(j.error.code) : null;
      out.type = out.status;
    }
  } catch {
    /* non-JSON body */
  }
  return out;
}

export function extractGeminiText(data: unknown): { text?: string; error?: string } {
  const d = data as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const block = d.promptFeedback && d.promptFeedback.blockReason;
  if (block) {
    return { error: `Prompt blocked: ${block}` };
  }
  const c = d.candidates && d.candidates[0];
  if (!c) {
    return { error: 'No candidates in model response' };
  }
  const finish = c.finishReason;
  if (finish === 'SAFETY') {
    return { error: 'Response blocked by safety filters' };
  }
  if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
    return { error: `Finish reason: ${finish}` };
  }
  const parts = c.content && c.content.parts;
  if (!parts || !parts.length) {
    return { error: 'Empty model content' };
  }
  let text = '';
  for (const p of parts) {
    if (p.text) text += p.text;
  }
  if (!text.trim()) {
    return { error: 'Empty model text' };
  }
  return { text: text.trim() };
}

async function fetchWithAbortMs(url: string, fetchInit: RequestInit, ms: number = GEMINI_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...fetchInit, signal: controller.signal });
    const text = await r.text();
    return { r, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type GeminiEnvelopeResult =
  | {
      ok: true;
      data: unknown;
      rawText: string;
      extractedText: string;
      finishReason: string | null;
      truncated: boolean;
    }
  | {
      ok: false;
      step: string;
      error?: unknown;
      httpStatus?: number;
      text?: string;
      detail?: string;
      data?: unknown;
    };

export async function geminiGenerateContentEnvelope(
  model: string,
  apiKey: string,
  requestBody: unknown,
  fetchTimeoutMs: number = GEMINI_FETCH_TIMEOUT_MS
): Promise<GeminiEnvelopeResult> {
  const geminiUrl = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let r: Response;
  let text: string;
  try {
    const out = await fetchWithAbortMs(
      geminiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      fetchTimeoutMs
    );
    r = out.r;
    text = out.text;
  } catch (e) {
    return { ok: false, step: 'network', error: e };
  }

  if (!r.ok) {
    return { ok: false, step: 'http', httpStatus: r.status, text };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, step: 'gemini_json', detail: text.slice(0, 800) };
  }

  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { ok: false, step: 'gemini_obj', httpStatus: r.status, text, data };
  }

  const extracted = extractGeminiText(data);
  if (extracted.error) {
    return { ok: false, step: 'extract', error: extracted.error, text };
  }

  const finishReason =
    (data as { candidates?: Array<{ finishReason?: string }> }).candidates?.[0]?.finishReason;
  const truncated = finishReason === 'MAX_TOKENS';

  return {
    ok: true,
    data,
    rawText: text,
    extractedText: extracted.text!,
    finishReason: finishReason || null,
    truncated,
  };
}

export function resolveModel() {
  return (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
}

export async function runResearch(body: Record<string, unknown>, apiKey: string) {
  const placeLabel = String(body.placeLabel || '').trim() || 'Unknown';
  const lat = body.lat != null ? Number(body.lat) : null;
  const lon = body.lon != null ? Number(body.lon) : null;
  const user = `Location: ${placeLabel}${
    Number.isFinite(lat) && Number.isFinite(lon) ? ` (lat ${lat}, lon ${lon})` : ''
  }.

Return the JSON object only.`;

  const model = resolveModel();
  const researchBody = {
    systemInstruction: {
      parts: [{ text: RESEARCH_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: user }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const g = await geminiGenerateContentEnvelope(model, apiKey, researchBody);
  if (!g.ok) return { ok: false as const, envelope: g, apiKey };

  let parsed: unknown;
  try {
    parsed = JSON.parse(g.extractedText);
  } catch {
    return {
      ok: false as const,
      error: 'Model returned non-JSON',
      detail: String(g.extractedText).slice(0, 300),
      apiKey,
    };
  }
  return { ok: true as const, data: parsed };
}

export async function runFinancialPayoff(body: Record<string, unknown>, apiKey: string) {
  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return { ok: false as const, clientError: 'Missing prompt' as const };
  }
  const model = resolveModel();
  const payoffBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
    },
  };

  const g = await geminiGenerateContentEnvelope(model, apiKey, payoffBody, GEMINI_SLOW_FETCH_TIMEOUT_MS);
  if (!g.ok) return { ok: false as const, envelope: g, apiKey };
  return {
    ok: true as const,
    text: g.extractedText,
    truncated: g.truncated,
    finishReason: g.finishReason,
  };
}

export async function runFinancialCalendar(body: Record<string, unknown>, apiKey: string) {
  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return { ok: false as const, clientError: 'Missing prompt' as const };
  }
  const model = resolveModel();
  const calBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const g = await geminiGenerateContentEnvelope(model, apiKey, calBody, GEMINI_SLOW_FETCH_TIMEOUT_MS);
  if (!g.ok) return { ok: false as const, envelope: g, apiKey };

  const raw = g.extractedText;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      ok: false as const,
      error: 'Model returned non-JSON calendar payload',
      detail: String(raw).slice(0, 400),
      apiKey,
    };
  }
  return {
    ok: true as const,
    data,
    truncated: g.truncated,
    finishReason: g.finishReason,
  };
}
