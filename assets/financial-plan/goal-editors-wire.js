/**
 * Goal 2 (debts) and Goal 3 (savings) editors: save / undo / reset, separate last-saved snapshots.
 */

import { PLAN, PLAN_DEFAULTS, TOGGLE_GOAL2_EDITOR_KEY, TOGGLE_GOAL3_EDITOR_KEY } from './plan-data.js';
import { applyPlanOverrides, savePlanOverrides } from './persistence.js';
import { syncLegacySavingsFromAccounts } from './savings-accounts.js';
import {
  readDebtsEditorIntoPlan,
  cloneDebtsSnapshot,
  setDebtsDraftFromSnapshot,
  addDebtRowDraft,
  removeDebtPayment,
} from './debt-editor.js';
import {
  readSavingsEditorIntoPlan,
  cloneSavingsSnapshot,
  setSavingsDraftFromSnapshot,
  addSavingsRowDraft,
  removeSavingsDeposit,
} from './savings-editor.js';

let lastSavedDebts = null;
let lastSavedSavings = null;

function setSaveNeeds(saveBtnId, needsSave) {
  const saveBtn = document.getElementById(saveBtnId);
  if (!saveBtn) return;
  saveBtn.disabled = !needsSave;
}

function showGoal2Saved() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  st.textContent = 'Saved in this browser';
  clearTimeout(showGoal2Saved._t);
  showGoal2Saved._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function showGoal3Saved() {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  st.textContent = 'Saved in this browser';
  clearTimeout(showGoal3Saved._t);
  showGoal3Saved._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function showGoal2Unsaved() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  st.textContent = 'Unsaved changes';
  setSaveNeeds('btn-save-goal2-debts', true);
}

function showGoal3Unsaved() {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  st.textContent = 'Unsaved changes';
  setSaveNeeds('btn-save-goal3-savings', true);
}

export function wireGoal2DebtEditor(render) {
  const addBtn = document.getElementById('btn-add-debt');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      addDebtRowDraft(showGoal2Unsaved);
    });
  }

  const debtsHost = document.getElementById('debts-editor-list');
  if (debtsHost) {
    function onDebtRowFieldActivity(e) {
      const t = e.target;
      if (!t || !t.closest || !t.matches) return;
      const row = t.closest('.debt-row');
      if (!row || !debtsHost.contains(row)) return;
      if (!t.matches('input, textarea, select')) return;
      showGoal2Unsaved();
    }
    debtsHost.addEventListener('input', onDebtRowFieldActivity);
    debtsHost.addEventListener('change', onDebtRowFieldActivity);
    debtsHost.addEventListener('click', function (e) {
      const t = e.target;
      if (!t || !t.getAttribute) return;
      const action = t.getAttribute('data-action');
      if (action === 'remove') {
        const row = t.closest('.debt-row');
        if (row) row.remove();
        showGoal2Unsaved();
        return;
      }
    });
  }

  const goal2Host = document.getElementById('goal2-debts');
  if (goal2Host) {
    goal2Host.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('.goal2-remove-payment') : null;
      if (!btn) return;
      e.preventDefault();
      const debtId = btn.getAttribute('data-debt-id');
      const paymentId = btn.getAttribute('data-payment-id');
      if (debtId == null || paymentId == null) return;
      removeDebtPayment(debtId, paymentId, showGoal2Unsaved, render);
      savePlanOverrides();
      lastSavedDebts = cloneDebtsSnapshot();
    });
  }

  const saveBtn = document.getElementById('btn-save-goal2-debts');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      readDebtsEditorIntoPlan();
      savePlanOverrides();
      render();
      setSaveNeeds('btn-save-goal2-debts', false);
      showGoal2Saved();
      lastSavedDebts = cloneDebtsSnapshot();
    });
  }

  const undoBtn = document.getElementById('btn-undo-goal2-debts');
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      if (!lastSavedDebts) return;
      setSaveNeeds('btn-save-goal2-debts', false);
      setDebtsDraftFromSnapshot(lastSavedDebts);
      readDebtsEditorIntoPlan();
      render();
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = 'Undid changes (not saved)';
      clearTimeout(wireGoal2DebtEditor._t);
      wireGoal2DebtEditor._t = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2200);
    });
  }

  const resetBtn = document.getElementById('btn-reset-goal2-debts');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      setDebtsDraftFromSnapshot({
        debts: (PLAN_DEFAULTS.debts || []).map(function (d) {
          return {
            id: d.id,
            name: d.name,
            current: d.current,
            paidOff: d.paidOff,
            paymentHistory: [],
          };
        }),
      });
      showGoal2Unsaved();
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = 'Reset draft (click Save to apply)';
      clearTimeout(wireGoal2DebtEditor._t2);
      wireGoal2DebtEditor._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    });
  }

  setSaveNeeds('btn-save-goal2-debts', false);
}

export function wireGoal3SavingsEditor(render) {
  const savingsHost = document.getElementById('savings-editor-list');
  if (savingsHost) {
    function onSavingsFieldActivity(e) {
      const t = e.target;
      if (!t || !t.closest || !t.matches) return;
      const row = t.closest('.savings-row');
      if (!row || !savingsHost.contains(row)) return;
      if (!t.matches('input, textarea, select')) return;
      showGoal3Unsaved();
    }
    savingsHost.addEventListener('input', onSavingsFieldActivity);
    savingsHost.addEventListener('change', onSavingsFieldActivity);
    savingsHost.addEventListener('click', function (e) {
      const t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-action') === 'remove') {
        const row = t.closest('.savings-row');
        if (row) row.remove();
        showGoal3Unsaved();
      }
    });
  }

  const addBtn = document.getElementById('btn-add-savings');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      addSavingsRowDraft(showGoal3Unsaved);
    });
  }

  const goal3Host = document.getElementById('goal3-savings');
  if (goal3Host) {
    goal3Host.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('.goal3-remove-deposit') : null;
      if (!btn) return;
      e.preventDefault();
      const sid = btn.getAttribute('data-savings-id');
      const depId = btn.getAttribute('data-deposit-id');
      if (sid == null || depId == null) return;
      removeSavingsDeposit(sid, depId, showGoal3Unsaved, render);
      syncLegacySavingsFromAccounts(PLAN);
      savePlanOverrides();
      lastSavedSavings = cloneSavingsSnapshot();
    });
  }

  const saveBtn = document.getElementById('btn-save-goal3-savings');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      savePlanOverrides();
      render();
      setSaveNeeds('btn-save-goal3-savings', false);
      showGoal3Saved();
      lastSavedSavings = cloneSavingsSnapshot();
    });
  }

  const undoBtn = document.getElementById('btn-undo-goal3-savings');
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      if (!lastSavedSavings) return;
      setSaveNeeds('btn-save-goal3-savings', false);
      setSavingsDraftFromSnapshot(lastSavedSavings);
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      render();
      const st = document.getElementById('goal3-save-status');
      if (st) st.textContent = 'Undid changes (not saved)';
      clearTimeout(wireGoal3SavingsEditor._t);
      wireGoal3SavingsEditor._t = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2200);
    });
  }

  const resetBtn = document.getElementById('btn-reset-goal3-savings');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      setSavingsDraftFromSnapshot({ savingsAccounts: JSON.parse(JSON.stringify(PLAN_DEFAULTS.savingsAccounts || [])) });
      showGoal3Unsaved();
      const st = document.getElementById('goal3-save-status');
      if (st) st.textContent = 'Reset draft (click Save to apply)';
      clearTimeout(wireGoal3SavingsEditor._t2);
      wireGoal3SavingsEditor._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    });
  }

  setSaveNeeds('btn-save-goal3-savings', false);
}

export function wireGoalEditorToggles() {
  function bindToggle(btnId, panelId, storageKey, cardHeadId, panelHeaderId) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    const cardHead = document.getElementById(cardHeadId);
    const panelHeader = document.getElementById(panelHeaderId);
    if (!btn || !panel || !cardHead || !panelHeader) return;

    const labelEdit = 'Edit';
    const labelHide = 'Hide';

    function apply(open) {
      panel.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        panelHeader.appendChild(btn);
        btn.textContent = labelHide;
      } else {
        cardHead.appendChild(btn);
        btn.textContent = labelEdit;
      }
      try {
        localStorage.setItem(storageKey, open ? '1' : '0');
      } catch (e) {}
    }

    let startOpen = false;
    try {
      startOpen = localStorage.getItem(storageKey) === '1';
    } catch (e) {}
    apply(startOpen);

    btn.addEventListener('click', function () {
      apply(!panel.classList.contains('is-open'));
    });
  }

  bindToggle(
    'btn-toggle-goal2-editor',
    'goal2-editor-panel',
    TOGGLE_GOAL2_EDITOR_KEY,
    'goal2-card-head',
    'goal2-editor-panel-header'
  );
  bindToggle(
    'btn-toggle-goal3-editor',
    'goal3-editor-panel',
    TOGGLE_GOAL3_EDITOR_KEY,
    'goal3-card-head',
    'goal3-editor-panel-header'
  );
}

export function initEditorSnapshots() {
  lastSavedDebts = cloneDebtsSnapshot();
  lastSavedSavings = cloneSavingsSnapshot();
}

export { applyPlanOverrides, cloneDebtsSnapshot, cloneSavingsSnapshot };
