/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankFinancialPlan, PLAN } from './plan-data';
import * as persistence from './persistence';
import { wireTakeHomeEditor } from './takehome-editor-wire';

function mountEditor(): void {
  document.body.innerHTML =
    '<button type="button" id="btn-edit-takehome" aria-expanded="false">Edit</button>' +
    '<button type="button" id="btn-edit-takehome-cover" aria-expanded="false">Edit</button>' +
    '<dialog id="takehome-editor-dialog">' +
    '<form id="takehome-editor-form">' +
    '<input id="takehome-paycheck" data-money="currency" />' +
    '<input id="takehome-count" />' +
    '<input id="takehome-monthly" data-money="currency" />' +
    '<p id="takehome-editor-status"></p>' +
    '<button type="submit" id="btn-save-takehome">Save</button>' +
    '<button type="button" data-close-takehome-dialog>Cancel</button>' +
    '</form>' +
    '</dialog>';
  const dlg = document.getElementById('takehome-editor-dialog') as HTMLDialogElement;
  if (typeof dlg.showModal !== 'function') {
    dlg.showModal = function showModal() {
      dlg.setAttribute('open', '');
    };
    dlg.close = function close() {
      dlg.removeAttribute('open');
      dlg.dispatchEvent(new Event('close'));
    };
  }
}

describe('take-home editor', () => {
  beforeEach(() => {
    Object.assign(PLAN, createBlankFinancialPlan());
    PLAN.paycheckAmount = 2000;
    PLAN.paychecksPerMonth = 2;
    PLAN.monthlyTakeHome = 4000;
    mountEditor();
    vi.spyOn(persistence, 'savePlanOverrides').mockResolvedValue(true);
  });

  it('opens with the saved paycheck and updates monthly take-home on save', async () => {
    const render = vi.fn();
    wireTakeHomeEditor(render);
    document.getElementById('btn-edit-takehome')!.click();

    const dlg = document.getElementById('takehome-editor-dialog') as HTMLDialogElement;
    expect(dlg.hasAttribute('open') || dlg.open).toBe(true);
    expect((document.getElementById('takehome-paycheck') as HTMLInputElement).value).toContain('2,000');
    expect((document.getElementById('takehome-count') as HTMLInputElement).value).toBe('2');
    expect((document.getElementById('takehome-monthly') as HTMLInputElement).value).toContain('4,000');

    const count = document.getElementById('takehome-count') as HTMLInputElement;
    count.value = '3';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    expect((document.getElementById('takehome-monthly') as HTMLInputElement).value).toContain('6,000');

    (document.getElementById('takehome-editor-form') as HTMLFormElement).requestSubmit();
    await vi.waitFor(() => {
      expect(persistence.savePlanOverrides).toHaveBeenCalled();
    });
    expect(PLAN.paycheckAmount).toBe(2000);
    expect(PLAN.paychecksPerMonth).toBe(3);
    expect(PLAN.monthlyTakeHome).toBe(6000);
    expect(render).toHaveBeenCalled();
    expect(dlg.hasAttribute('open') || dlg.open).toBe(false);
  });
});
