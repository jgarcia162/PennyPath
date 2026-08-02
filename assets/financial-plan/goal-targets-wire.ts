/**
 * Goal targets editor (savings goal amounts + optional “goal by” date per row).
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

/** Accept YYYY-MM or YYYY-MM-DD from the Goal by control; store as YYYY-MM. */
function parseGoalByYmFromInput(raw: string): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return '';
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
    const goalByYm = byEl ? parseGoalByYmFromInput(byEl.value) : '';
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

/** Switch to Financial Plan tab, expand the goals editor, and scroll it into view. */
export function openPlanGoalsEditor(): void {
  const tabPlan = document.getElementById('tab-plan') as HTMLElement | null;
  if (tabPlan) tabPlan.click();

  const peg = document.getElementById('plan-goals-editor') as HTMLElement | null;
  if (!peg) return;

  // Next.js wraps Section 02 in a collapsible <details>.
  const sectionDetails = peg.closest('details.section-collapsible') as HTMLDetailsElement | null;
  if (sectionDetails && !sectionDetails.open) sectionDetails.open = true;

  if (peg instanceof HTMLDetailsElement && !peg.open) peg.open = true;

  try {
    peg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    peg.scrollIntoView();
  }

  const firstName = peg.querySelector(
    '#savings-goals-target-editor input[data-field="goal-name"]'
  ) as HTMLInputElement | null;
  if (firstName) {
    try {
      firstName.focus({ preventScroll: true });
    } catch {
      firstName.focus();
    }
  }
}

export function wireGoalTargetsEditor(render: (opts?: { refreshBalanceEditors?: boolean }) => void): void {
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
        // Harvest in-progress edits before rebuild — otherwise a second Add wipes the prior row.
        readSavingsGoalsFromDom();
        ensureSavingsGoals(PLAN);
        PLAN.savingsGoals = PLAN.savingsGoals || [];
        PLAN.savingsGoals.push({
          id: 'goal_' + Date.now().toString(36),
          name: 'New savings goal',
          targetAmount: 0,
          goalByYm: '',
        });
        void savePlanOverrides();
        if (typeof render === 'function') render({ refreshBalanceEditors: true });
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
        readSavingsGoalsFromDom();
        stripGoalIdFromAllAccounts(PLAN, gid);
        PLAN.savingsGoals = (PLAN.savingsGoals || []).filter(function (g) {
          return g && String(g.id) !== String(gid);
        });
        ensureSavingsGoals(PLAN);
        syncJointHysaPlanFieldsFromGoals(PLAN);
        void savePlanOverrides();
        if (typeof render === 'function') render({ refreshBalanceEditors: true });
      }
    });
  }

  const openGoalsBtn = document.getElementById('btn-open-goals-editor') as HTMLButtonElement | null;
  if (openGoalsBtn && !(openGoalsBtn as any)._goalsOpenWired) {
    (openGoalsBtn as any)._goalsOpenWired = true;
    openGoalsBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openPlanGoalsEditor();
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
    if (typeof render === 'function') render({ refreshBalanceEditors: true });
    flashStatus('Saved in this browser');
  });
}
