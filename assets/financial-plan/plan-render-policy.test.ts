/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { persistRenderOptions, isNativeDialogOpen } from './plan-render-policy';
import { setEditingDebtCardId, setEditingSavingsCardId } from './card-inline-edit-state';

function mountDialog(id: string, open: boolean): HTMLDialogElement {
  const dlg = document.createElement('dialog');
  dlg.id = id;
  document.body.appendChild(dlg);
  if (open) dlg.setAttribute('open', '');
  Object.defineProperty(dlg, 'open', { configurable: true, get: () => dlg.hasAttribute('open') });
  return dlg;
}

describe('persistRenderOptions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setEditingDebtCardId(null);
    setEditingSavingsCardId(null);
  });

  afterEach(() => {
    setEditingDebtCardId(null);
    setEditingSavingsCardId(null);
  });

  it('skips open debt and savings editor tables after Save (default)', () => {
    mountDialog('goal2-editor-dialog', true);
    mountDialog('goal3-editor-dialog', true);
    const opts = persistRenderOptions();
    expect(opts.skipDebtsEditor).toBe(true);
    expect(opts.skipSavingsEditor).toBe(true);
    expect(opts.skipGoalsTargetEditor).toBe(true);
    expect(opts.refreshBalanceEditors).toBeUndefined();
  });

  it('rebuilds open editors when rebuildOpenEditors is true (ledger Add)', () => {
    mountDialog('goal2-editor-dialog', true);
    const opts = persistRenderOptions({ rebuildOpenEditors: true, preserveLedgerActivityDrafts: false });
    expect(opts.skipDebtsEditor).toBe(false);
    expect(opts.preserveLedgerActivityDrafts).toBe(false);
  });

  it('does not skip editors when the matching dialog is closed', () => {
    mountDialog('goal2-editor-dialog', false);
    const opts = persistRenderOptions();
    expect(opts.skipDebtsEditor).toBe(false);
    expect(isNativeDialogOpen('goal2-editor-dialog')).toBe(false);
  });

  it('refreshes dashboard cards unless a card is in inline-edit', () => {
    expect(persistRenderOptions().refreshGoal2DebtsCards).toBe(true);
    setEditingDebtCardId('d1');
    expect(persistRenderOptions().refreshGoal2DebtsCards).toBe(false);
    expect(persistRenderOptions({ refreshGoal2DebtsCards: true }).refreshGoal2DebtsCards).toBe(true);
    expect(persistRenderOptions().skipSecondaryRefresh).toBe(true);
    setEditingDebtCardId(null);
    expect(persistRenderOptions().skipSecondaryRefresh).toBe(false);
  });
});
