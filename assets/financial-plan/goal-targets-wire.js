/**
 * Goal targets editor (savings goal amounts + optional “goal by” month per row).
 * Keeps edits in the shared PLAN object and persists them.
 */

import { PLAN } from './plan-data';
import { savePlanOverrides } from './persistence';
import {
  ensureSavingsGoals,
  syncJointHysaPlanFieldsFromGoals,
  normalizeSavingsGoalRow,
  stripGoalIdFromAllAccounts,
  ID_GOAL_HYSA,
} from './savings-goals.js';
import { numOr } from './utils';

function parseMoneyInput(val) {
  const n = Number(String(val || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function flashStatus(msg) {
  const st = document.getElementById('goal-targets-save-status');
  if (!st) return;
  st.textContent = msg || '';
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function readSavingsGoalsFromDom() {
  const host = document.getElementById('savings-goals-target-editor');
  if (!host) return;
  const rows = host.querySelectorAll('.savings-goal-target-row');
  const next = [];
  rows.forEach(function (row) {
    const id = row.getAttribute('data-goal-id');
    if (!id) return;
    const nameEl = row.querySelector('input[data-field="goal-name"]');
    const amtEl = row.querySelector('input[data-field="goal-amount"]');
    const byEl = row.querySelector('input[data-field="goal-by"]');
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

export function wireGoalTargetsEditor(render) {
  const saveBtn = document.getElementById('btn-save-goal-targets');
  const host = document.getElementById('savings-goals-target-editor');
  if (!saveBtn || !host) return;

  const peg = document.getElementById('plan-goals-editor');
  if (peg && !peg._savingsGoalsUiWired) {
    peg._savingsGoalsUiWired = true;
    peg.addEventListener('click', function (e) {
      const t = e.target;
      if (t && t.id === 'btn-add-savings-goal') {
        e.preventDefault();
        ensureSavingsGoals(PLAN);
        PLAN.savingsGoals = PLAN.savingsGoals || [];
        PLAN.savingsGoals.push({
          id: 'goal_' + Date.now().toString(36),
          name: 'New savings goal',
          targetAmount: 0,
          goalByYm: '',
        });
        savePlanOverrides();
        if (typeof render === 'function') render();
        return;
      }
      const rm = t && t.closest ? t.closest('[data-action="remove-savings-goal"]') : null;
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
        savePlanOverrides();
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

    savePlanOverrides();
    if (typeof render === 'function') render();
    flashStatus('Saved in this browser');
  });
}
