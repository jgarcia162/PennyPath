/**
 * Snapshot a focused editor field so input/change can tell a real edit from
 * mask reformat / no-op. Checkboxes and radios must use checked, not value
 * (value stays "on" when the box is toggled).
 */

import { parseMoneyInput } from './utils';

export function editorFieldSnapshot(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): string {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return el.checked ? '1' : '0';
  }
  return String(el.value ?? '');
}

export function captureEditorFieldBaseline(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.setAttribute('data-edit-baseline', editorFieldSnapshot(el));
  }
}

/** True when the field value differs from what it was when focused (real edit). */
export function editorFieldChangedFromBaseline(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
    return true;
  }
  if (!el.hasAttribute('data-edit-baseline')) return true;
  const baseline = String(el.getAttribute('data-edit-baseline') ?? '');
  const current = editorFieldSnapshot(el);
  if (current === baseline) return false;
  if (el instanceof HTMLInputElement) {
    const moneyKind = el.getAttribute('data-money');
    if (moneyKind === 'currency' || moneyKind === 'rate') {
      const a = parseMoneyInput(baseline);
      const b = parseMoneyInput(current);
      if (a != null && b != null && a === b) return false;
      if ((baseline === '' || a == null) && (current === '' || b == null)) return false;
    }
  }
  return true;
}
