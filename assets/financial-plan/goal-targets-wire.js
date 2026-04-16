/**
 * Goal targets editor (Goal 1 timeline + amount).
 * Keeps edits in the shared PLAN object and persists them.
 */

import { PLAN } from './plan-data.js';
import { savePlanOverrides } from './persistence.js';
import {
  ensureSavingsGoals,
  syncGoalHysaFromGoals,
  normalizeSavingsGoalRow,
  stripGoalIdFromAllAccounts,
  ID_GOAL_HYSA,
} from './savings-goals.js';

function parseMoneyInput(val) {
  const n = Number(String(val || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function monthInputToLabel(yyyyMm) {
  const parts = String(yyyyMm || '').split('-');
  if (parts.length < 2) return null;
  const y = parts[0];
  const m = Number(parts[1]);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = names[m - 1];
  if (!mon) return null;
  return mon + ' ' + y;
}

function syncInputsFromPlan() {
  const amt = document.getElementById('goal-hysa-target-input');
  const by = document.getElementById('goal-hysa-by-input');
  if (amt) amt.value = String(Number.isFinite(PLAN.goalHysa) ? PLAN.goalHysa : '');
  if (by && PLAN.hysaGoalByYm) by.value = String(PLAN.hysaGoalByYm);
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
    const name = nameEl ? String(nameEl.value || '').trim() : '';
    const amt = amtEl ? parseMoneyInput(amtEl.value) : null;
    const rowObj = normalizeSavingsGoalRow({
      id: id,
      name: name || 'Savings goal',
      targetAmount: amt != null && amt >= 0 ? amt : 0,
    });
    if (rowObj) next.push(rowObj);
  });
  if (next.length) PLAN.savingsGoals = next;
}

export function wireGoalTargetsEditor(render) {
  const saveBtn = document.getElementById('btn-save-goal-targets');
  const amt = document.getElementById('goal-hysa-target-input');
  const by = document.getElementById('goal-hysa-by-input');
  if (!saveBtn || !amt || !by) return;

  syncInputsFromPlan();

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
        syncGoalHysaFromGoals(PLAN);
        savePlanOverrides();
        if (typeof render === 'function') render();
      }
    });
  }

  saveBtn.addEventListener('click', function () {
    const money = parseMoneyInput(amt.value);
    const byVal = String(by.value || '');
    if (money == null || money <= 0) {
      flashStatus('Enter a valid HYSA goal amount.');
      return;
    }
    const byLabel = monthInputToLabel(byVal);
    if (!byLabel) {
      flashStatus('Pick a valid “by” month.');
      return;
    }

    PLAN.goalHysa = Math.round(money);
    PLAN.hysaGoalByYm = byVal;
    PLAN.hysaGoalBy = byLabel;
    if (!PLAN.labels) PLAN.labels = {};
    PLAN.labels.hysaGoalByShort = byLabel;
    PLAN.labels.goalHysaWhen = 'By ' + byLabel;

    readSavingsGoalsFromDom();
    ensureSavingsGoals(PLAN);
    const hysaG = (PLAN.savingsGoals || []).find(function (g) {
      return g && g.id === ID_GOAL_HYSA;
    });
    if (hysaG) {
      hysaG.targetAmount = PLAN.goalHysa;
    }
    syncGoalHysaFromGoals(PLAN);

    savePlanOverrides();
    if (typeof render === 'function') render();
    flashStatus('Saved in this browser');
  });
}

