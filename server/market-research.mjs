/**
 * Dev server: static files + Gemini-backed APIs
 *
 * - POST /api/research — real-estate market JSON
 * - POST /api/financial-payoff — Financial Plan “AI payoff plan” (plain text)
 * - POST /api/financial-calendar — bills + debt payment dates (JSON)
 *
 * Create .env in the project root with: GEMINI_API_KEY=... (wins over shell)
 * Or: export GEMINI_API_KEY=... && npm run research-server
 * Optional: GEMINI_MODEL=gemini-2.5-flash (default)
 * Optional: GEMINI_SLOW_FETCH_MS — longer Gemini deadline for payoff + bill calendar (default 57000 ms)
 *
 * Key: https://aistudio.google.com/apikey
 *
 * Open: http://127.0.0.1:8787/real-estate-plan.html
 *       http://127.0.0.1:8787/financial-plan-v3-aggressive.html
 *
 * CORS: loopback origins are allowed; add comma-separated full origins in CORS_ALLOWED_ORIGINS
 * (e.g. https://user.github.io) for hosted pages. Requests without an Origin header are allowed
 * (e.g. curl); disallowed browser origins get 403.
 *
 * Failed requests include keySent (length + prefix + suffix). Set DEBUG_API_KEY_IN_ERRORS=1
 * in .env to also include the full key in keySent.full (local debugging only).
 */

import http from 'http';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MAX_BODY_BYTES = 1_000_000;
const GEMINI_FETCH_TIMEOUT_MS = 30_000;

const GEMINI_SLOW_FETCH_TIMEOUT_MS = (function resolveSlowGeminiFetchMs() {
  const raw = process.env.GEMINI_SLOW_FETCH_MS ?? process.env.GEMINI_SLOW_FETCH_TIMEOUT_MS;
  const n = raw != null ? Number(String(raw).trim()) : NaN;
  if (Number.isFinite(n) && n >= 1000) return Math.floor(n);
  return 57_000;
})();

function parseTrustedOriginsFromEnv() {
  const set = new Set();
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  for (const part of raw.split(',')) {
    const t = part.trim();
    if (!t) continue;
    try {
      set.add(new URL(t).origin);
    } catch {
      /* skip invalid */
    }
  }
  return set;
}

function isLoopbackHostname(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

function isTrustedBrowserOrigin(origin) {
  try {
    const u = new URL(origin);
    if (isLoopbackHostname(u.hostname)) return true;
    if (TRUSTED_CORS_EXTRA.has(origin)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * @returns {{ mode: 'allow', origin: string } | { mode: 'no-origin' } | { mode: 'reject' }}
 */
function resolveCorsForApiRequest(req) {
  const raw = req.headers.origin;
  if (raw == null || raw === '') {
    return { mode: 'no-origin' };
  }
  if (raw === 'null') {
    return { mode: 'reject' };
  }
  let o;
  try {
    o = new URL(raw).origin;
  } catch {
    return { mode: 'reject' };
  }
  if (isTrustedBrowserOrigin(o)) {
    return { mode: 'allow', origin: o };
  }
  return { mode: 'reject' };
}

function applyCorsToHeaders(cors, headers) {
  const h = { ...headers };
  if (cors.mode === 'allow' && cors.origin) {
    h['Access-Control-Allow-Origin'] = cors.origin;
    h.Vary = 'Origin';
  }
  return h;
}

async function readRequestBodyWithLimit(req, res, cors) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      res.writeHead(413, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(JSON.stringify({ ok: false, error: 'Request body too large' }));
      try {
        req.destroy();
      } catch {
        /* ignore */
      }
      return null;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Fetch with deadline on the full operation (headers + response body).
 * Timer clears only after `fetch` and `response.text()` complete so a stalled body read still aborts.
 */
async function fetchWithAbortMs(url, fetchInit, ms = GEMINI_FETCH_TIMEOUT_MS) {
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

async function fetchGeminiWithTimeout(url, fetchInit) {
  return fetchWithAbortMs(url, fetchInit, GEMINI_FETCH_TIMEOUT_MS);
}

async function fetchGeminiWithSlowTimeout(url, fetchInit) {
  return fetchWithAbortMs(url, fetchInit, GEMINI_SLOW_FETCH_TIMEOUT_MS);
}

/**
 * Shared Gemini :generateContent transport, response JSON parse, and extractGeminiText.
 * Callers parse structured JSON inside model text (research) or return plain text (financial payoff).
 */
async function geminiGenerateContentEnvelope(model, apiKey, requestBody, fetchTimeoutMs = GEMINI_FETCH_TIMEOUT_MS) {
  const geminiUrl =
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let r;
  let text;
  try {
    const out =
      fetchTimeoutMs === GEMINI_FETCH_TIMEOUT_MS
        ? await fetchGeminiWithTimeout(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          })
        : await fetchGeminiWithSlowTimeout(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
    r = out.r;
    text = out.text;
  } catch (e) {
    return { ok: false, step: 'network', error: e };
  }

  if (!r.ok) {
    return { ok: false, step: 'http', httpStatus: r.status, text };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, step: 'gemini_json', detail: text.slice(0, 800) };
  }

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  if (!isObject || 'error' in data) {
    return { ok: false, step: 'gemini_obj', httpStatus: r.status, text, data };
  }

  const extracted = extractGeminiText(data);
  if (extracted.error) {
    return { ok: false, step: 'extract', error: extracted.error, text };
  }

  const finishReason =
    data.candidates && data.candidates[0] && data.candidates[0].finishReason;
  const truncated = finishReason === 'MAX_TOKENS';

  return {
    ok: true,
    data,
    rawText: text,
    extractedText: extracted.text,
    finishReason: finishReason || null,
    truncated,
  };
}

/** Write JSON error for {@link geminiGenerateContentEnvelope} failure; returns true if a response was sent. */
function sendGeminiEnvelopeError(res, cors, apiKey, g) {
  if (g.ok) return false;
  if (g.step === 'network') {
    const err = g.error;
    if (err && err.name === 'AbortError') {
      res.writeHead(504, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini request timed out',
          keySent: keySentDebug(apiKey),
        })
      );
      return true;
    }
    res.writeHead(500, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
        keySent: keySentDebug(apiKey),
      })
    );
    return true;
  }
  if (g.step === 'http') {
    const gemini = summarizeGeminiFailure(g.httpStatus, g.text);
    res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Gemini request failed',
        gemini,
        keySent: keySentDebug(apiKey),
      })
    );
    return true;
  }
  if (g.step === 'gemini_json') {
    res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Gemini returned non-JSON',
        detail: g.detail,
        keySent: keySentDebug(apiKey),
      })
    );
    return true;
  }
  if (g.step === 'gemini_obj') {
    const gemini = summarizeGeminiFailure(g.httpStatus, g.text);
    res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Gemini returned an error object',
        gemini,
        keySent: keySentDebug(apiKey),
      })
    );
    return true;
  }
  if (g.step === 'extract') {
    res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: g.error,
        gemini: summarizeGeminiFailure(200, g.text),
        keySent: keySentDebug(apiKey),
      })
    );
    return true;
  }
  res.writeHead(500, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
  res.end(
    JSON.stringify({
      ok: false,
      error: 'Unexpected Gemini error',
      keySent: keySentDebug(apiKey),
    })
  );
  return true;
}

/**
 * Parse selected keys from .env file contents (first matching line wins per key).
 */
function parseEnvFile(text) {
  const out = {
    GEMINI_API_KEY: null,
    GEMINI_MODEL: null,
    DEBUG_API_KEY_IN_ERRORS: null,
    CORS_ALLOWED_ORIGINS: null,
  };
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === 'GEMINI_API_KEY' && val) out.GEMINI_API_KEY = val.trim();
    if (key === 'GEMINI_MODEL' && val) out.GEMINI_MODEL = val.trim();
    if (key === 'DEBUG_API_KEY_IN_ERRORS' && val !== '') out.DEBUG_API_KEY_IN_ERRORS = val.trim();
    if (key === 'CORS_ALLOWED_ORIGINS' && val !== '') out.CORS_ALLOWED_ORIGINS = val.trim();
  }
  return out;
}

/** What we sent to Gemini (for debugging failed requests). */
function keySentDebug(apiKey) {
  const k = String(apiKey || '');
  if (!k) return undefined;
  const out = {
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

/**
 * Resolve GEMINI_API_KEY: project .env wins over a pre-set shell variable.
 * GOOGLE_API_KEY is accepted as a fallback (common alias).
 */
function loadEnvFromDotEnv() {
  const envPath = path.join(ROOT, '.env');
  let fileExists = false;
  let fileKey = null;
  try {
    fileExists = fs.existsSync(envPath);
    if (fileExists) {
      const text = fs.readFileSync(envPath, 'utf8');
      const parsed = parseEnvFile(text);
      fileKey = parsed.GEMINI_API_KEY;
      if (parsed.GEMINI_MODEL) process.env.GEMINI_MODEL = parsed.GEMINI_MODEL;
      if (parsed.DEBUG_API_KEY_IN_ERRORS != null) {
        process.env.DEBUG_API_KEY_IN_ERRORS = parsed.DEBUG_API_KEY_IN_ERRORS;
      }
      if (parsed.CORS_ALLOWED_ORIGINS) {
        process.env.CORS_ALLOWED_ORIGINS = parsed.CORS_ALLOWED_ORIGINS;
      }
    }
  } catch {
    /* ignore */
  }

  if (fileKey) {
    process.env.GEMINI_API_KEY = fileKey;
    return { envPath, fileExists, parsed: true, source: 'file' };
  }

  const shellKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (shellKey) {
    process.env.GEMINI_API_KEY = shellKey.trim();
    return { envPath, fileExists, parsed: true, source: 'env' };
  }

  return { envPath, fileExists, parsed: false, source: 'none' };
}

const dotEnvStatus = loadEnvFromDotEnv();
const TRUSTED_CORS_EXTRA = parseTrustedOriginsFromEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? '/index.html' : decoded;
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

async function serveStatic(req, res) {
  const urlPath = req.url || '/';
  const full = safePath(urlPath === '/' ? '/real-estate-plan.html' : urlPath);
  if (!full) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fsPromises.readFile(full);
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(500);
      res.end('Server error');
    }
  }
}

const SYSTEM_PROMPT = `You are a conservative underwriting assistant for U.S. residential real estate (condo/townhouse) rental analysis.
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

/**
 * Gemini errors: { "error": { "code": 400, "message": "...", "status": "INVALID_ARGUMENT" } }
 * https://ai.google.dev/gemini-api/docs/troubleshooting
 */
function summarizeGeminiFailure(httpStatus, bodyText) {
  const out = {
    httpStatus,
    message: null,
    type: null,
    code: null,
    status: null,
    rawSnippet: String(bodyText || '').slice(0, 2500),
  };
  try {
    const j = JSON.parse(bodyText);
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

function extractGeminiText(data) {
  const block = data.promptFeedback && data.promptFeedback.blockReason;
  if (block) {
    return { error: `Prompt blocked: ${block}` };
  }
  const c = data.candidates && data.candidates[0];
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

async function handleGeocode(req, res) {
  const cors = resolveCorsForApiRequest(req);
  if (cors.mode === 'reject') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
    return;
  }

  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const q = url.searchParams.get('q') || '';
  if (!q.trim()) {
    res.writeHead(
      400,
      applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' })
    );
    res.end(JSON.stringify({ error: 'Missing q' }));
    return;
  }
  const target =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: q.trim(),
      format: 'json',
      limit: '8',
      addressdetails: '1',
    }).toString();

  try {
    const { r, text } = await fetchWithAbortMs(
      target,
      {
        headers: {
          'User-Agent': 'FinancialPlan/1.0 (local dev; contact: none)',
          Accept: 'application/json',
        },
      },
      GEMINI_FETCH_TIMEOUT_MS
    );
    res.writeHead(
      r.ok ? 200 : 502,
      applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' })
    );
    res.end(text);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      res.writeHead(
        504,
        applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' })
      );
      res.end(JSON.stringify({ error: 'Geocode request timed out' }));
      return;
    }
    res.writeHead(
      502,
      applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' })
    );
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}

async function handleResearch(req, res) {
  const cors = resolveCorsForApiRequest(req);
  if (cors.mode === 'reject') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        error: 'GEMINI_API_KEY is not set. Add it to .env or export it and restart the server. See https://aistudio.google.com/apikey',
      })
    );
    return;
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  const bodyRaw = await readRequestBodyWithLimit(req, res, cors);
  if (bodyRaw === null) return;

  let payload;
  try {
    payload = JSON.parse(bodyRaw || '{}');
  } catch {
    res.writeHead(400, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const placeLabel = String(payload.placeLabel || '').trim() || 'Unknown';
  const lat = payload.lat != null ? Number(payload.lat) : null;
  const lon = payload.lon != null ? Number(payload.lon) : null;
  const user = `Location: ${placeLabel}${Number.isFinite(lat) && Number.isFinite(lon) ? ` (lat ${lat}, lon ${lon})` : ''}.

Return the JSON object only.`;

  const researchBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
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

  try {
    const g = await geminiGenerateContentEnvelope(model, apiKey, researchBody);
    if (sendGeminiEnvelopeError(res, cors, apiKey, g)) return;

    const content = g.extractedText;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Model returned non-JSON',
          detail: String(content).slice(0, 300),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }
    res.writeHead(200, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ ok: true, data: parsed }));
  } catch (e) {
    res.writeHead(500, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: String(e.message || e),
        keySent: keySentDebug(apiKey),
      })
    );
  }
}

/**
 * Financial Plan: debt payoff narrative (markdown-ish text). Same GEMINI_API_KEY as /api/research.
 */
async function handleFinancialPayoff(req, res) {
  const cors = resolveCorsForApiRequest(req);
  if (cors.mode === 'reject') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error:
          'GEMINI_API_KEY is not set on the server. Add it to .env next to package.json and restart npm run research-server.',
      })
    );
    return;
  }

  const bodyRaw = await readRequestBodyWithLimit(req, res, cors);
  if (bodyRaw === null) return;

  let payload;
  try {
    payload = JSON.parse(bodyRaw || '{}');
  } catch {
    res.writeHead(400, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
    return;
  }

  const prompt = String(payload.prompt || '').trim();
  if (!prompt) {
    res.writeHead(400, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ ok: false, error: 'Missing prompt' }));
    return;
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const payoffBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
    },
  };

  try {
    const g = await geminiGenerateContentEnvelope(model, apiKey, payoffBody, GEMINI_SLOW_FETCH_TIMEOUT_MS);
    if (sendGeminiEnvelopeError(res, cors, apiKey, g)) return;

    res.writeHead(200, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: true,
        text: g.extractedText,
        truncated: g.truncated,
        finishReason: g.finishReason,
      })
    );
  } catch (e) {
    res.writeHead(500, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: String(e.message || e),
        keySent: keySentDebug(apiKey),
      })
    );
  }
}

/**
 * Financial Plan: bill due dates + suggested debt payment dates (JSON only).
 */
async function handleFinancialCalendar(req, res) {
  const cors = resolveCorsForApiRequest(req);
  if (cors.mode === 'reject') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error:
          'GEMINI_API_KEY is not set on the server. Add it to .env next to package.json and restart npm run research-server.',
      })
    );
    return;
  }

  const bodyRaw = await readRequestBodyWithLimit(req, res, cors);
  if (bodyRaw === null) return;

  let payload;
  try {
    payload = JSON.parse(bodyRaw || '{}');
  } catch {
    res.writeHead(400, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
    return;
  }

  const prompt = String(payload.prompt || '').trim();
  if (!prompt) {
    res.writeHead(400, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ ok: false, error: 'Missing prompt' }));
    return;
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const calBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  try {
    const g = await geminiGenerateContentEnvelope(model, apiKey, calBody, GEMINI_SLOW_FETCH_TIMEOUT_MS);
    if (sendGeminiEnvelopeError(res, cors, apiKey, g)) return;

    const raw = g.extractedText;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      res.writeHead(502, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Model returned non-JSON calendar payload',
          detail: String(raw).slice(0, 400),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    res.writeHead(200, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: true,
        data: data,
        truncated: g.truncated,
        finishReason: g.finishReason,
      })
    );
  } catch (e) {
    res.writeHead(500, applyCorsToHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        ok: false,
        error: String(e.message || e),
        keySent: keySentDebug(apiKey),
      })
    );
  }
}

const server = http.createServer((req, res) => {
  const u = req.url || '';

  if (req.method === 'OPTIONS' && u.startsWith('/api/')) {
    const cors = resolveCorsForApiRequest(req);
    if (cors.mode === 'reject') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
      return;
    }
    const headers = applyCorsToHeaders(cors, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === 'POST' && u === '/api/research') {
    handleResearch(req, res);
    return;
  }

  if (req.method === 'POST' && u === '/api/financial-payoff') {
    handleFinancialPayoff(req, res);
    return;
  }

  if (req.method === 'POST' && u === '/api/financial-calendar') {
    handleFinancialCalendar(req, res);
    return;
  }

  if (req.method === 'GET' && u.startsWith('/api/geocode')) {
    handleGeocode(req, res);
    return;
  }

  if (req.method === 'GET' && u === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, gemini: !!process.env.GEMINI_API_KEY }));
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dev server: http://127.0.0.1:${PORT}/real-estate-plan.html`);
  console.log(`          http://127.0.0.1:${PORT}/financial-plan-v3-aggressive.html`);
  console.log(`  POST /api/research  ·  POST /api/financial-payoff  ·  POST /api/financial-calendar`);
  console.log(`Expected .env path: ${dotEnvStatus.envPath}`);
  console.log(`  .env file exists: ${dotEnvStatus.fileExists}`);
  if (process.env.GEMINI_API_KEY) {
    const k = process.env.GEMINI_API_KEY;
    const src = dotEnvStatus.source === 'file' ? 'from .env file' : 'from environment (export)';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    console.log(`Gemini: GEMINI_API_KEY ${src} (length ${k.length}, starts with ${k.slice(0, 7)}…)`);
    console.log(`  Model: ${model}`);
  } else {
    console.log('Gemini: GEMINI_API_KEY missing — AI fill disabled.');
    if (dotEnvStatus.fileExists && !dotEnvStatus.parsed) {
      console.log('  Hint: .env exists but GEMINI_API_KEY was not read. Use one line: GEMINI_API_KEY=... (no spaces around =).');
    } else if (!dotEnvStatus.fileExists) {
      console.log('  Hint: create .env in the project folder (next to package.json) or get a key at https://aistudio.google.com/apikey');
    }
  }
});
