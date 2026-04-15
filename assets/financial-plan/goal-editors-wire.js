/**
 * Goal 2 (debts) and Goal 3 (savings) editors: save / undo / reset, separate last-saved snapshots.
 */

import { PLAN, PLAN_DEFAULTS } from './plan-data.js';
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

function wireHoldToConfirm(rootEl, buttonSelector, opts) {
  if (!rootEl) return;
  const holdMs = (opts && Number.isFinite(opts.holdMs) ? opts.holdMs : 2000) || 2000;
  const confirmMessage = (opts && opts.confirmMessage) || 'Delete this item?';
  const onConfirm = (opts && opts.onConfirm) || function () {};

  function getBtnFromEventTarget(t) {
    if (!t || !t.closest) return null;
    return t.closest(buttonSelector);
  }

  function clearHold(btn) {
    if (!btn) return;
    const timer = btn._holdDeleteTimer;
    if (timer) clearTimeout(timer);
    btn._holdDeleteTimer = null;
    btn.classList.remove('is-hold-armed');
  }

  rootEl.addEventListener('pointerdown', function (e) {
    const btn = getBtnFromEventTarget(e.target);
    if (!btn) return;
    // Only arm the hold for primary button / touch.
    if (e.button != null && e.button !== 0) return;
    clearHold(btn);
    btn.classList.add('is-hold-armed');
    btn._holdDeleteTimer = setTimeout(function () {
      clearHold(btn);
      const msg = typeof confirmMessage === 'function' ? confirmMessage(btn) : confirmMessage;
      const ok = window.confirm(String(msg || 'Delete this item?'));
      if (!ok) return;
      onConfirm(btn);
    }, holdMs);
  });

  ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(function (evt) {
    rootEl.addEventListener(
      evt,
      function (e) {
        const btn = getBtnFromEventTarget(e.target);
        if (btn) clearHold(btn);
      },
      true
    );
  });

  // Prevent accidental “click to delete”.
  rootEl.addEventListener('click', function (e) {
    const btn = getBtnFromEventTarget(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
  });
}

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
  const sortSel = document.getElementById('debts-editor-sort');
  if (sortSel) {
    sortSel.addEventListener('change', function () {
      readDebtsEditorIntoPlan();
      PLAN.debtsEditorSort = sortSel.value;
      savePlanOverrides();
      render();
      lastSavedDebts = cloneDebtsSnapshot();
      setSaveNeeds('btn-save-goal2-debts', false);
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = '';
    });
  }

  const progressSortSel = document.getElementById('debts-progress-sort');
  if (progressSortSel) {
    progressSortSel.addEventListener('change', function () {
      readDebtsEditorIntoPlan();
      PLAN.debtsProgressSort = progressSortSel.value;
      savePlanOverrides();
      render();
      lastSavedDebts = cloneDebtsSnapshot();
      setSaveNeeds('btn-save-goal2-debts', false);
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = '';
    });
  }

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
      if (action === 'quick-payment') {
        e.preventDefault();
        // Apply payment(s) from inputs + persist immediately (no bottom Save required).
        readDebtsEditorIntoPlan();
        savePlanOverrides();
        render();
        setSaveNeeds('btn-save-goal2-debts', false);
        showGoal2Saved();
        lastSavedDebts = cloneDebtsSnapshot();
        return;
      }
    });

    // Hold-to-delete debt rows (2s) then confirm.
    wireHoldToConfirm(debtsHost, 'button[data-action="remove"]', {
      holdMs: 2000,
      confirmMessage: function (btn) {
        const row = btn.closest('.debt-row');
        const nameEl = row ? row.querySelector('input[data-field="name"]') : null;
        const name = nameEl ? String(nameEl.value || '').trim() : '';
        return 'Delete this debt' + (name ? ' (“' + name + '”)' : '') + '?\n\nThis removes the row from the draft. Click Save to persist.';
      },
      onConfirm: function (btn) {
        const row = btn.closest('.debt-row');
        if (row) row.remove();
        showGoal2Unsaved();
      },
    });
  }

  const goal2Host = document.getElementById('goal2-debts');
  if (goal2Host) {
    wireHoldToConfirm(goal2Host, '.goal2-remove-payment', {
      holdMs: 2000,
      confirmMessage: 'Remove this payment record?\n\nThis will add the amount back to the debt balance.',
      onConfirm: function (btn) {
        const debtId = btn.getAttribute('data-debt-id');
        const paymentId = btn.getAttribute('data-payment-id');
        if (debtId == null || paymentId == null) return;
        removeDebtPayment(debtId, paymentId, showGoal2Unsaved, render);
        savePlanOverrides();
        lastSavedDebts = cloneDebtsSnapshot();
      },
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
      const action = t.getAttribute('data-action');
      if (action === 'quick-deposit') {
        e.preventDefault();
        readSavingsEditorIntoPlan();
        syncLegacySavingsFromAccounts(PLAN);
        savePlanOverrides();
        render();
        setSaveNeeds('btn-save-goal3-savings', false);
        showGoal3Saved();
        lastSavedSavings = cloneSavingsSnapshot();
        return;
      }
    });

    // Hold-to-delete savings rows (2s) then confirm.
    wireHoldToConfirm(savingsHost, 'button[data-action="remove"]', {
      holdMs: 2000,
      confirmMessage: function (btn) {
        const row = btn.closest('.savings-row');
        const nameEl = row ? row.querySelector('input[data-field="name"]') : null;
        const name = nameEl ? String(nameEl.value || '').trim() : '';
        return 'Delete this savings account' + (name ? ' (“' + name + '”)' : '') + '?\n\nThis removes the row from the draft. Click Save to persist.';
      },
      onConfirm: function (btn) {
        const row = btn.closest('.savings-row');
        if (row) row.remove();
        showGoal3Unsaved();
      },
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
    wireHoldToConfirm(goal3Host, '.goal3-remove-deposit', {
      holdMs: 2000,
      confirmMessage: 'Remove this deposit record?\n\nThis will subtract the amount from the account balance.',
      onConfirm: function (btn) {
        const sid = btn.getAttribute('data-savings-id');
        const depId = btn.getAttribute('data-deposit-id');
        if (sid == null || depId == null) return;
        removeSavingsDeposit(sid, depId, showGoal3Unsaved, render);
        syncLegacySavingsFromAccounts(PLAN);
        savePlanOverrides();
        lastSavedSavings = cloneSavingsSnapshot();
      },
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

/** Body scroll lock while a goal editor dialog is open (wheel/touch on backdrop). */
let bodyScrollLockDepth = 0;
let bodyScrollLockY = 0;

function lockBodyScrollForGoalDialog() {
  if (bodyScrollLockDepth === 0) {
    bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + bodyScrollLockY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  bodyScrollLockDepth++;
}

function unlockBodyScrollForGoalDialog() {
  bodyScrollLockDepth = Math.max(0, bodyScrollLockDepth - 1);
  if (bodyScrollLockDepth > 0) return;
  document.documentElement.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, bodyScrollLockY);
}

/** Centered modal editors (native `<dialog>` + `showModal`). */
export function wireGoalEditorDialogs() {
  ['goal2-editor-dialog', 'goal3-editor-dialog'].forEach(function (id) {
    const d = document.getElementById(id);
    if (d && typeof d.close === 'function') d.close();
  });

  function bindDialog(dialogId, btnId) {
    const dlg = document.getElementById(dialogId);
    const btn = document.getElementById(btnId);
    if (!dlg || !btn) return;

    btn.addEventListener('click', function () {
      try {
        if (typeof dlg.showModal !== 'function') return;
        dlg.showModal();
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Goal editor dialog could not open:', err);
        }
        return;
      }
      lockBodyScrollForGoalDialog();
      btn.setAttribute('aria-expanded', 'true');
    });

    dlg.addEventListener('close', function () {
      unlockBodyScrollForGoalDialog();
      btn.setAttribute('aria-expanded', 'false');
    });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) {
        dlg.close();
        return;
      }
      const t = e.target;
      const el = t && t.nodeType === Node.TEXT_NODE ? t.parentElement : t;
      if (el && typeof el.closest === 'function' && el.closest('[data-close-goal-dialog]')) {
        dlg.close();
      }
    });
  }

  bindDialog('goal2-editor-dialog', 'btn-toggle-goal2-editor');
  bindDialog('goal3-editor-dialog', 'btn-toggle-goal3-editor');
}

export function initEditorSnapshots() {
  lastSavedDebts = cloneDebtsSnapshot();
  lastSavedSavings = cloneSavingsSnapshot();
}

export { applyPlanOverrides, cloneDebtsSnapshot, cloneSavingsSnapshot };
