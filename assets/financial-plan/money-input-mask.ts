/**
 * Cents-based currency input mask (data-money="currency").
 */

import { formatCurrencyInput, formatMoneyInput, parseMoneyInput } from './utils';

export function currencyDigitsOnly(s: string): string {
  return String(s || '').replace(/[^\d]/g, '');
}

/** Format accumulated digit cents as a currency input string. */
export function formatCurrencyFromDigitCents(d: string): string {
  const raw = String(d || '').replace(/^0+(?=\d)/, '');
  if (!raw) return '';
  return formatCurrencyInput(Number(raw) / 100);
}

/**
 * Next digit buffer after a keypress.
 * When replaceAll is true (text selected), typing/backspace replaces the whole amount
 * instead of appending/removing one trailing digit.
 */
export function nextCurrencyDigits(
  prevDigits: string,
  key: string,
  replaceAll: boolean
): string | null {
  if (key === 'Backspace' || key === 'Delete') {
    if (replaceAll) return '';
    return prevDigits.slice(0, Math.max(0, prevDigits.length - 1));
  }
  if (/^\d$/.test(key)) {
    const base = replaceAll ? '' : prevDigits;
    return (base + key).slice(0, 18);
  }
  return null;
}

export function inputHasTextSelection(el: HTMLInputElement): boolean {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start == null || end == null) return false;
  return start !== end;
}

/**
 * Wire delegated currency (and rate blur) masks on a root.
 * Safe to call once per element; covers debt/savings editor dialogs and dashboard cards.
 */
export function wireMoneyMasks(rootEl: HTMLElement | null): void {
  if (!rootEl) return;
  if ((rootEl as any)._moneyMasksWired) return;
  (rootEl as any)._moneyMasksWired = true;

  function setCaretToEnd(el: HTMLInputElement): void {
    try {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    } catch {}
  }

  function notifyValueChanged(el: HTMLInputElement): void {
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {}
  }

  rootEl.addEventListener('keydown', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;

    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = (e as KeyboardEvent).key;
    if (
      key === 'Tab' ||
      key === 'Enter' ||
      key === 'Escape' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }

    const prevDigits =
      t.dataset && t.dataset.moneyDigits
        ? String(t.dataset.moneyDigits)
        : currencyDigitsOnly(t.value);
    // Select-all (or any highlight) must replace the amount — otherwise typing
    // "585" onto "$180.41" becomes "$180,415.85".
    const replaceAll = inputHasTextSelection(t);
    const nextDigits = nextCurrencyDigits(prevDigits, key, replaceAll);
    if (nextDigits == null) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    t.dataset.moneyDigits = nextDigits;
    t.value = formatCurrencyFromDigitCents(nextDigits);
    setCaretToEnd(t);
    notifyValueChanged(t);
  });

  rootEl.addEventListener('paste', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;
    e.preventDefault();
    const clip = e.clipboardData ? e.clipboardData.getData('text') : '';
    const d = currencyDigitsOnly(clip);
    t.dataset.moneyDigits = d;
    t.value = formatCurrencyFromDigitCents(d);
    setCaretToEnd(t);
    notifyValueChanged(t);
  });

  rootEl.addEventListener('focusin', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;
    t.dataset.moneyDigits = currencyDigitsOnly(t.value);
  });

  rootEl.addEventListener(
    'blur',
    function (e) {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.getAttribute('data-money') !== 'rate') return;
      const n = parseMoneyInput(t.value);
      t.value = n == null ? '' : formatMoneyInput(n);
    },
    true
  );
}
