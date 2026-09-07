/**
 * Linking a savings account to a goal from the editor row checkboxes.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SavingsAccount } from '../../types/index.js';
import { PLAN } from './plan-data';
import { derived } from './plan-derived';
import { renderSavingsEditor } from './render-sections';
import { readSavingsEditorIntoPlan } from './savings-editor';
import { ID_GOAL_HYSA } from './savings-goals';
import { wireGoal3SavingsEditor } from './goal-editors-wire';

const TEST_ACCOUNT: SavingsAccount = {
  id: 'test-acct',
  name: 'Test HYSA',
  current: 1000,
  apyPct: 3.25,
  goalIds: [],
  countTowardsGoal: false,
  depositHistory: [],
};

describe('savings editor goal linking', () => {
  beforeEach(() => {
    (PLAN as any).savingsAccounts = [{ ...TEST_ACCOUNT, depositHistory: [] }];
    (PLAN as any).savingsGoals = [
      { id: ID_GOAL_HYSA, name: 'Joint HYSA', targetAmount: 10000, goalByYm: '' },
    ];
    document.body.innerHTML =
      '<div id="savings-editor-list"></div>' +
      '<span id="goal3-save-status"></span>' +
      '<button id="btn-save-goal3-savings" type="button" data-needs-save="0"></button>';
    renderSavingsEditor(derived(PLAN));
  });

  it('reads checked goal checkboxes into PLAN.goalIds', () => {
    const cb = document.querySelector(
      '#savings-editor-list input[data-field="goalId"][data-goal-id="' + ID_GOAL_HYSA + '"]'
    ) as HTMLInputElement | null;
    expect(cb).toBeTruthy();
    expect(cb!.checked).toBe(false);

    cb!.checked = true;
    readSavingsEditorIntoPlan();

    const acc = ((PLAN as any).savingsAccounts as SavingsAccount[])[0];
    expect(acc.goalIds).toEqual([ID_GOAL_HYSA]);
    expect(acc.countTowardsGoal).toBe(true);
  });

  it('enables Save when a goal checkbox is toggled', () => {
    wireGoal3SavingsEditor(function () {});
    const saveBtn = document.getElementById('btn-save-goal3-savings') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const cb = document.querySelector(
      '#savings-editor-list input[data-field="goalId"][data-goal-id="' + ID_GOAL_HYSA + '"]'
    ) as HTMLInputElement;
    cb.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    expect(saveBtn.dataset.needsSave).toBe('1');
    expect(saveBtn.disabled).toBe(false);
    expect(document.getElementById('goal3-save-status')?.textContent).toBe('Unsaved changes');
  });
});
