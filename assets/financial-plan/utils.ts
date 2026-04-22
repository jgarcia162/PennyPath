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
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Coerce stored/API values; keeps 0 valid (e.g. 0% APR). */
export function numOr<TFallback extends number>(raw: unknown, fallback: TFallback): number | TFallback {
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

export function setHtml(id: string, html: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function escapeHtml(s: unknown): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s: unknown): string {
  return String(s || '').replace(/"/g, '&quot;');
}

export function cssEscape(s: unknown): string {
  return String(s || '').replace(/"/g, '\\"');
}

export function todayYyyyMmDd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

