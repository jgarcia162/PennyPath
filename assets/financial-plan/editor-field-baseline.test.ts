/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import {
  captureEditorFieldBaseline,
  editorFieldChangedFromBaseline,
} from './editor-field-baseline';

describe('editorFieldChangedFromBaseline', () => {
  it('treats checkbox checked as a change even when value stays "on"', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = 'on';
    cb.checked = false;
    captureEditorFieldBaseline(cb);
    cb.checked = true;
    expect(editorFieldChangedFromBaseline(cb)).toBe(true);
  });

  it('does not mark a checkbox as changed when checked is unchanged', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = 'on';
    cb.checked = true;
    captureEditorFieldBaseline(cb);
    expect(editorFieldChangedFromBaseline(cb)).toBe(false);
  });

  it('still treats a text value change as an edit', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Joint HYSA';
    captureEditorFieldBaseline(input);
    input.value = 'Emergency fund';
    expect(editorFieldChangedFromBaseline(input)).toBe(true);
  });

  it('ignores currency mask reformat that does not change the amount', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-money', 'currency');
    input.value = '1000';
    captureEditorFieldBaseline(input);
    input.value = '$1,000.00';
    expect(editorFieldChangedFromBaseline(input)).toBe(false);
  });
});
