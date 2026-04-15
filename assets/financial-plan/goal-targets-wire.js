/**
 * Goal targets editor (Goal 1 timeline + amount).
 * Keeps edits in the shared PLAN object and persists them.
 */

import { PLAN } from './plan-data.js';
import { savePlanOverrides } from './persistence.js';

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

export function wireGoalTargetsEditor(render) {
  const saveBtn = document.getElementById('btn-save-goal-targets');
  const amt = document.getElementById('goal-hysa-target-input');
  const by = document.getElementById('goal-hysa-by-input');
  if (!saveBtn || !amt || !by) return;

  syncInputsFromPlan();

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

    savePlanOverrides();
    if (typeof render === 'function') render();
    flashStatus('Saved in this browser');
  });
}

