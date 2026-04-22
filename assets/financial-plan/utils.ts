/**
 * Shared helpers: parsing, DOM, escaping, dates.
 * No plan state — safe to reuse from other pages or tests.
 *
 * Converted from `utils.js` with no logic changes.
 */

export function parseMoneyInput(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(/,/g, '').replace(/\$/g, '').trim();
  if (s === '') return null;
  // Reject partial parses like "123abc".
  if (!/^[-+]?(?:\d+|\d*\.\d+)$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Coerce stored/API values; keeps 0 valid (e.g. 0% APR). */
export function numOr(raw: unknown, fallback: number): number {
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

/** Round to nearest cent (or hundredth of a percent for rate fields). */
export function roundMoney(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/** Plain string for balance/rate inputs: always 2 decimal places, no float noise. */
export function formatMoneyInput(n: unknown): string {
  return roundMoney(n).toFixed(2);
}

export interface MoneyFormatters {
  money(n: number): string;
  moneyExact(n: number): string;
}

export function createMoneyFormatters(): MoneyFormatters {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  const fmtExact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    money: function (n: number): string {
      return fmt.format(n);
    },
    moneyExact: function (n: number): string {
      return fmtExact.format(n);
    },
  };
}

export function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Inserts raw HTML into the DOM.
 *
 * Callers MUST sanitize any untrusted input before calling (see `escapeHtml`).
 */
export function setHtml(id: string, html: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function toStrPreserveFalsy(v: unknown): string {
  return v == null ? '' : String(v);
}

export function escapeHtml(s: unknown): string {
  return toStrPreserveFalsy(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s: unknown): string {
  // Safe for quoted/unquoted HTML attribute contexts.
  return toStrPreserveFalsy(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cssEscape(s: unknown): string {
  const raw = toStrPreserveFalsy(s);
  try {
    // Prefer standards-compliant escaping when available.
    const esc = (globalThis as any).CSS && typeof (globalThis as any).CSS.escape === 'function'
      ? (globalThis as any).CSS.escape
      : null;
    if (esc) return esc(raw);
  } catch (e) {}
  // Fallback: conservative CSS identifier escaping (good enough for attribute selectors in this app).
  return raw
    .replace(/\0/g, '\uFFFD')
    .replace(/^[0-9-]/, function (m) {
      return '\\' + m;
    })
    .replace(/[^a-zA-Z0-9_-]/g, function (ch) {
      const hex = ch.codePointAt(0)!.toString(16).toUpperCase();
      return '\\' + hex + ' ';
    });
}

export function todayYyyyMmDd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

