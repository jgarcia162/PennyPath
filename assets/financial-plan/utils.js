/**
 * Shared helpers: parsing, DOM, escaping, dates.
 * No plan state — safe to reuse from other pages or tests.
 */

export function parseMoneyInput(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/,/g, '').replace(/\$/g, '').trim();
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Coerce stored/API values; keeps 0 valid (e.g. 0% APR). */
export function numOr(raw, fallback) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

/** Round to nearest cent (or hundredth of a percent for rate fields). */
export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/** Plain string for balance/rate inputs: always 2 decimal places, no float noise. */
export function formatMoneyInput(n) {
  return roundMoney(n).toFixed(2);
}

export function createMoneyFormatters() {
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtExact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    money: function (n) {
      return fmt.format(n);
    },
    moneyExact: function (n) {
      return fmtExact.format(n);
    },
  };
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}

export function cssEscape(s) {
  return String(s || '').replace(/"/g, '\\"');
}

export function todayYyyyMmDd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}
