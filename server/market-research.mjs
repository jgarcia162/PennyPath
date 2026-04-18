/**
 * Dev server: static files + Gemini-backed APIs
 *
 * - POST /api/research — real-estate market JSON
 * - POST /api/financial-payoff — Financial Plan “AI payoff plan” (plain text)
 *
 * Create .env in the project root with: GEMINI_API_KEY=... (wins over shell)
 * Or: export GEMINI_API_KEY=... && npm run research-server
 * Optional: GEMINI_MODEL=gemini-2.5-flash (default)
 *
 * Key: https://aistudio.google.com/apikey
 *
 * Open: http://127.0.0.1:8787/real-estate-plan.html
 *       http://127.0.0.1:8787/financial-plan-v3-aggressive.html
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

/**
 * Parse selected keys from .env file contents (first matching line wins per key).
 */
function parseEnvFile(text) {
  const out = {
    GEMINI_API_KEY: null,
    GEMINI_MODEL: null,
    DEBUG_API_KEY_IN_ERRORS: null,
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
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const q = url.searchParams.get('q') || '';
  if (!q.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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
    const r = await fetch(target, {
      headers: {
        'User-Agent': 'FinancialPlan/1.0 (local dev; contact: none)',
        Accept: 'application/json',
      },
    });
    const text = await r.text();
    res.writeHead(r.ok ? 200 : 502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}

async function handleResearch(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(
      JSON.stringify({
        error: 'GEMINI_API_KEY is not set. Add it to .env or export it and restart the server. See https://aistudio.google.com/apikey',
      })
    );
    return;
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  let body = '';
  for await (const chunk of req) body += chunk;
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const placeLabel = String(payload.placeLabel || '').trim() || 'Unknown';
  const lat = payload.lat != null ? Number(payload.lat) : null;
  const lon = payload.lon != null ? Number(payload.lon) : null;
  const user = `Location: ${placeLabel}${Number.isFinite(lat) && Number.isFinite(lon) ? ` (lat ${lat}, lon ${lon})` : ''}.

Return the JSON object only.`;

  const geminiUrl =
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      const gemini = summarizeGeminiFailure(r.status, text);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini request failed',
          gemini,
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini returned non-JSON',
          detail: text.slice(0, 800),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    if (data.error) {
      const gemini = summarizeGeminiFailure(r.status, text);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini returned an error object',
          gemini,
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    const extracted = extractGeminiText(data);
    if (extracted.error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: extracted.error,
          gemini: summarizeGeminiFailure(200, text),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    const content = extracted.text;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ ok: true, data: parsed }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(
      JSON.stringify({
        ok: false,
        error:
          'GEMINI_API_KEY is not set on the server. Add it to .env next to package.json and restart npm run research-server.',
      })
    );
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
    return;
  }

  const prompt = String(payload.prompt || '').trim();
  if (!prompt) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: 'Missing prompt' }));
    return;
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const geminiUrl =
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 8192,
        },
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      const gemini = summarizeGeminiFailure(r.status, text);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini request failed',
          gemini,
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini returned non-JSON',
          detail: text.slice(0, 800),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    if (data.error) {
      const gemini = summarizeGeminiFailure(r.status, text);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Gemini returned an error object',
          gemini,
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    const extracted = extractGeminiText(data);
    if (extracted.error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(
        JSON.stringify({
          ok: false,
          error: extracted.error,
          gemini: summarizeGeminiFailure(200, text),
          keySent: keySentDebug(apiKey),
        })
      );
      return;
    }

    const finishReason =
      data.candidates && data.candidates[0] && data.candidates[0].finishReason;
    const truncated = finishReason === 'MAX_TOKENS';

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        ok: true,
        text: extracted.text,
        truncated,
        finishReason: finishReason || null,
      })
    );
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && u === '/api/research') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    handleResearch(req, res);
    return;
  }

  if (req.method === 'POST' && u === '/api/financial-payoff') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    handleFinancialPayoff(req, res);
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
  console.log(`  POST /api/research  ·  POST /api/financial-payoff`);
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
