/**
 * Goal targets editor (savings goal amounts + optional “goal by” month per row).
 * Keeps edits in the shared PLAN object and persists them.
 */

import type { SavingsGoal } from '../../types/index.js';
import { PLAN } from './plan-data';
import { savePlanOverrides } from './persistence';
import {
  ensureSavingsGoals,
  syncJointHysaPlanFieldsFromGoals,
  normalizeSavingsGoalRow,
  stripGoalIdFromAllAccounts,
  ID_GOAL_HYSA,
} from './savings-goals';
import { numOr } from './utils';

function parseMoneyInput(val: unknown): number | null {
  const n = Number(String(val || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function flashStatus(msg: string): void {
  const st = document.getElementById('goal-targets-save-status') as HTMLElement | null;
  if (!st) return;
  st.textContent = msg || '';
  clearTimeout((flashStatus as any)._t);
  (flashStatus as any)._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function readSavingsGoalsFromDom(): void {
  const host = document.getElementById('savings-goals-target-editor') as HTMLElement | null;
  if (!host) return;
  const rows = host.querySelectorAll('.savings-goal-target-row');
  const next: SavingsGoal[] = [];
  rows.forEach(function (row) {
    const id = row.getAttribute('data-goal-id');
    if (!id) return;
    const nameEl = row.querySelector('input[data-field="goal-name"]') as HTMLInputElement | null;
    const amtEl = row.querySelector('input[data-field="goal-amount"]') as HTMLInputElement | null;
    const byEl = row.querySelector('input[data-field="goal-by"]') as HTMLInputElement | null;
    const name = nameEl ? String(nameEl.value || '').trim() : '';
    const amt = amtEl ? parseMoneyInput(amtEl.value) : null;
    let goalByYm = '';
    if (byEl && typeof byEl.value === 'string' && /^\d{4}-\d{2}$/.test(byEl.value.trim())) {
      goalByYm = byEl.value.trim();
    }
    const rowObj = normalizeSavingsGoalRow({
      id: id,
      name: name || 'Savings goal',
      targetAmount: amt != null && amt >= 0 ? amt : 0,
      goalByYm: goalByYm,
    });
    if (rowObj) next.push(rowObj);
  });
  if (next.length) PLAN.savingsGoals = next;
}

export function wireGoalTargetsEditor(render: () => void): void {
  const saveBtn = document.getElementById('btn-save-goal-targets') as HTMLButtonElement | null;
  const host = document.getElementById('savings-goals-target-editor') as HTMLElement | null;
  if (!saveBtn || !host) return;

  const peg = document.getElementById('plan-goals-editor') as HTMLElement | null;
  if (peg && !(peg as any)._savingsGoalsUiWired) {
    (peg as any)._savingsGoalsUiWired = true;
    peg.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (t && (t as any).id === 'btn-add-savings-goal') {
        e.preventDefault();
        ensureSavingsGoals(PLAN);
        PLAN.savingsGoals = PLAN.savingsGoals || [];
        PLAN.savingsGoals.push({
          id: 'goal_' + Date.now().toString(36),
          name: 'New savings goal',
          targetAmount: 0,
          goalByYm: '',
        });
        void savePlanOverrides();
        if (typeof render === 'function') render();
        return;
      }
      const rm =
        t && (t as any).closest ? ((t as any).closest('[data-action="remove-savings-goal"]') as HTMLElement | null) : null;
      if (rm) {
        e.preventDefault();
        const gid = rm.getAttribute('data-goal-id');
        if (!gid || gid === ID_GOAL_HYSA) {
          window.alert('Remove other goals from the list. The Joint HYSA target stays tied to Goal 1 above.');
          return;
        }
        const ok = window.confirm('Remove this savings goal? It will be unchecked on all accounts.');
        if (!ok) return;
        stripGoalIdFromAllAccounts(PLAN, gid);
        PLAN.savingsGoals = (PLAN.savingsGoals || []).filter(function (g) {
          return g && String(g.id) !== String(gid);
        });
        ensureSavingsGoals(PLAN);
        syncJointHysaPlanFieldsFromGoals(PLAN);
        void savePlanOverrides();
        if (typeof render === 'function') render();
      }
    });
  }

  saveBtn.addEventListener('click', function () {
    readSavingsGoalsFromDom();
    ensureSavingsGoals(PLAN);
    const hysaG = (PLAN.savingsGoals || []).find(function (g) {
      return g && g.id === ID_GOAL_HYSA;
    });
    const money = hysaG ? numOr(hysaG.targetAmount, 0) : 0;
    if (money <= 0) {
      flashStatus('Set a positive target amount for Joint HYSA in the table.');
      return;
    }

    syncJointHysaPlanFieldsFromGoals(PLAN);

    void savePlanOverrides();
    if (typeof render === 'function') render();
    flashStatus('Saved in this browser');
  });
}
