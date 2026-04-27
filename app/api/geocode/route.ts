import { NextRequest, NextResponse } from 'next/server';

import { GEMINI_FETCH_TIMEOUT_MS } from '../../../lib/server/gemini-api';

export const runtime = 'nodejs';

async function fetchWithAbortMs(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    const text = await r.text();
    return { r, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** GET ?q= — proxies Nominatim (same as `server/market-research.mjs` /api/geocode). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing q' }, { status: 400 });
  }

  const target =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q,
      format: 'json',
      limit: '8',
      addressdetails: '1',
    }).toString();

  try {
    const { r, text } = await fetchWithAbortMs(
      target,
      {
        headers: {
          'User-Agent': 'PennyPath/1.0 (hosted preview; geocode proxy)',
          Accept: 'application/json',
        },
      },
      GEMINI_FETCH_TIMEOUT_MS
    );
    return new NextResponse(text, {
      status: r.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return NextResponse.json({ error: 'Geocode request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 502 });
  }
}
