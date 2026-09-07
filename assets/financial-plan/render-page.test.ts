/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PLAN } from './plan-data';
import { render } from './render-page';
import { persistRenderOptions } from './plan-render-policy';
import { ID_GOAL_HYSA } from './savings-goals';

function mountPlanShell(): void {
  document.body.innerHTML =
    '<div class="status-card positive" id="status-hysa-card">' +
    '<div id="status-hysa"></div>' +
    '<div id="status-hysa-note"></div>' +
    '</div>' +
    '<div class="goal-card primary" id="goal-hysa-card">' +
    '<div id="goal-hysa-amt"></div>' +
    '<div id="goal-hysa-when"></div>' +
    '</div>' +
    '<div id="status-personal"></div>' +
    '<div id="status-personal-note"></div>' +
    '<div id="status-debt-rounded"></div>' +
    '<div id="status-debt-note"></div>' +
    '<div id="status-takehome"></div>' +
    '<div id="status-takehome-note"></div>' +
    '<dialog id="goal2-editor-dialog" open><div id="debts-editor-list">KEEP-ME</div></dialog>' +
    '<div id="savings-goals-target-editor"></div>';
  const dlg = document.getElementById('goal2-editor-dialog') as HTMLDialogElement;
  if (typeof dlg.open !== 'boolean') {
    Object.defineProperty(dlg, 'open', { configurable: true, get: () => true });
  }
}

describe('render joint account + non-intrusive persist', () => {
  beforeEach(() => {
    mountPlanShell();
    (PLAN as any).savingsAccounts = [
      {
        id: 's_joint_custom',
        name: 'Family HYSA',
        current: 3250.5,
        apyPct: 4,
        goalIds: [ID_GOAL_HYSA],
        countTowardsGoal: true,
        depositHistory: [],
      },
    ];
    (PLAN as any).debts = [];
    (PLAN as any).hysaBalance = 0;
    (PLAN as any).savingsGoals = [{ id: ID_GOAL_HYSA, name: 'Joint HYSA', targetAmount: 10000, goalByYm: '' }];
  });

  it('updates Joint Account Balance from accounts linked to Joint HYSA', () => {
    render();
    expect(document.getElementById('status-hysa')!.textContent).toContain('3,251');
    expect(PLAN.hysaBalance).toBe(3250.5);
    expect((document.getElementById('status-hysa-card') as HTMLElement).hidden).toBe(false);
    expect((document.getElementById('goal-hysa-card') as HTMLElement).hidden).toBe(false);
  });

  it('hides Joint Account and Goal 1 when there is no Joint HYSA goal', () => {
    (PLAN as any).savingsGoals = [];
    render();
    expect((document.getElementById('status-hysa-card') as HTMLElement).hidden).toBe(true);
    expect((document.getElementById('goal-hysa-card') as HTMLElement).hidden).toBe(true);
  });

  it('does not wipe an open debts editor after persistRenderOptions()', () => {
    const list = document.getElementById('debts-editor-list')!;
    list.textContent = 'KEEP-ME';
    render(persistRenderOptions());
    expect(document.getElementById('debts-editor-list')!.textContent).toBe('KEEP-ME');
  });
});
