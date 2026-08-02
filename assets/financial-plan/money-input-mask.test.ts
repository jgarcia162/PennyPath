/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { wireMoneyMasks, formatCurrencyFromDigitCents } from './money-input-mask';

function mountEditorCurrencyField(hostId: string, initialValue: string): HTMLInputElement {
  document.body.innerHTML =
    '<dialog id="goal-editor-dialog">' +
    '<div id="' +
    hostId +
    '">' +
    '<input type="text" data-field="current" data-money="currency" value="' +
    initialValue +
    '">' +
    '</div>' +
    '</dialog>';
  const dialog = document.getElementById('goal-editor-dialog') as HTMLElement;
  wireMoneyMasks(dialog);
  return dialog.querySelector('input[data-money="currency"]') as HTMLInputElement;
}

function typeKey(el: HTMLInputElement, key: string): void {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}

describe('wireMoneyMasks in debt/savings editor windows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('select-all then type replaces balance in debts editor (does not append)', () => {
    const input = mountEditorCurrencyField('debts-editor-list', '$180.41');
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.setSelectionRange(0, input.value.length);

    // Bug repro: appending 585 onto 18041 produced $180,415.85
    for (const key of ['5', '8', '5', '5', '5']) typeKey(input, key);

    expect(input.value).toBe('$585.55');
    expect(input.value).not.toBe('$180,415.85');
  });

  it('select-all then type replaces balance in savings editor (does not append)', () => {
    const input = mountEditorCurrencyField('savings-editor-list', '$1,804.15');
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.setSelectionRange(0, input.value.length);

    for (const key of ['5', '8', '5', '5', '5']) typeKey(input, key);

    expect(input.value).toBe(formatCurrencyFromDigitCents('58555'));
    expect(input.value).toBe('$585.55');
  });

  it('select-all + Backspace clears the editor balance field', () => {
    const input = mountEditorCurrencyField('debts-editor-list', '$180.41');
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.setSelectionRange(0, input.value.length);

    typeKey(input, 'Backspace');
    expect(input.value).toBe('');
  });

  it('without selection, digits still append in cents mode', () => {
    const input = mountEditorCurrencyField('debts-editor-list', '$1.00');
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    // caret at end, no selection
    input.setSelectionRange(input.value.length, input.value.length);

    typeKey(input, '5');
    expect(input.value).toBe('$10.05');
  });
});
