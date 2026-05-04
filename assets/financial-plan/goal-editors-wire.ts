/**
 * Goal 2 (debts) and Goal 3 (savings) editors: save / undo / reset, separate last-saved snapshots.
 */

import type { Debt, SavingsAccount } from '../../types/index.js';
import { PLAN, PLAN_DEFAULTS } from './plan-data';
import { applyPlanOverrides, savePlanOverrides } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { formatCurrencyInput, formatMoneyInput, parseMoneyInput } from './utils';
import {
  readDebtsEditorIntoPlan,
  cloneDebtsSnapshot,
  setDebtsDraftFromSnapshot,
  addDebtRowDraft,
  removeDebtPayment,
  setDebtLedgerStatusById,
  hardRemoveDebtById,
} from './debt-editor';
import {
  readSavingsEditorIntoPlan,
  cloneSavingsSnapshot,
  setSavingsDraftFromSnapshot,
  addSavingsRowDraft,
  removeSavingsDeposit,
  setSavingsLedgerStatusById,
  hardRemoveSavingsById,
} from './savings-editor';

let lastSavedDebts: { debts: Debt[] } | null = null;
let lastSavedSavings: { savingsAccounts: SavingsAccount[] } | null = null;

function wasDebtIdLastSaved(id: string): boolean {
  if (!lastSavedDebts || !lastSavedDebts.debts) return false;
  return lastSavedDebts.debts.some(function (d: Debt) {
    return String(d.id) === String(id);
  });
}

function wasSavingsIdLastSaved(id: string): boolean {
  if (!lastSavedSavings || !lastSavedSavings.savingsAccounts) return false;
  return lastSavedSavings.savingsAccounts.some(function (a: SavingsAccount) {
    return String(a.id) === String(id);
  });
}

function wireMoneyMasks(rootEl: HTMLElement | null): void {
  if (!rootEl) return;
  if ((rootEl as any)._moneyMasksWired) return;
  (rootEl as any)._moneyMasksWired = true;

  function digitsOnly(s: string): string {
    return String(s || '').replace(/[^\d]/g, '');
  }

  function setCaretToEnd(el: HTMLInputElement): void {
    try {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    } catch {}
  }

  function formatCurrencyFromDigits(d: string): string {
    const raw = String(d || '').replace(/^0+(?=\d)/, '');
    if (!raw) return '';
    return formatCurrencyInput(Number(raw) / 100);
  }

  function notifyValueChanged(el: HTMLInputElement): void {
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {}
  }

  rootEl.addEventListener('keydown', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;

    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = (e as KeyboardEvent).key;
    if (
      key === 'Tab' ||
      key === 'Enter' ||
      key === 'Escape' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }

    const prevDigits =
      (t as any).dataset && (t as any).dataset.moneyDigits
        ? String((t as any).dataset.moneyDigits)
        : digitsOnly(t.value);

    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      const nextDigits = prevDigits.slice(0, Math.max(0, prevDigits.length - 1));
      (t as any).dataset.moneyDigits = nextDigits;
      t.value = formatCurrencyFromDigits(nextDigits);
      setCaretToEnd(t);
      notifyValueChanged(t);
      return;
    }

    if (/^\d$/.test(key)) {
      e.preventDefault();
      const nextDigits = (prevDigits + key).slice(0, 18);
      (t as any).dataset.moneyDigits = nextDigits;
      t.value = formatCurrencyFromDigits(nextDigits);
      setCaretToEnd(t);
      notifyValueChanged(t);
      return;
    }

    e.preventDefault();
  });

  rootEl.addEventListener('paste', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;
    e.preventDefault();
    const clip = (e as ClipboardEvent).clipboardData ? (e as ClipboardEvent).clipboardData!.getData('text') : '';
    const d = digitsOnly(clip);
    (t as any).dataset.moneyDigits = d;
    t.value = formatCurrencyFromDigits(d);
    setCaretToEnd(t);
    notifyValueChanged(t);
  });

  rootEl.addEventListener('focusin', function (e) {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.getAttribute('data-money') !== 'currency') return;
    (t as any).dataset.moneyDigits = digitsOnly(t.value);
  });

  rootEl.addEventListener(
    'blur',
    function (e) {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.getAttribute('data-money') !== 'rate') return;
      const n = parseMoneyInput(t.value);
      t.value = n == null ? '' : formatMoneyInput(n);
    },
    true
  );
}

function wireHoldToConfirm(
  rootEl: HTMLElement | null,
  buttonSelector: string,
  opts: {
    holdMs?: number;
    confirmMessage?: string | ((btn: HTMLElement) => string);
    onConfirm?: (btn: HTMLElement) => void;
  }
): void {
  if (!rootEl) return;
  const holdMs = (opts && Number.isFinite(opts.holdMs) ? opts.holdMs : 2000) || 2000;
  const confirmMessage = (opts && opts.confirmMessage) || 'Delete this item?';
  const onConfirm = (opts && opts.onConfirm) || function () {};

  function getBtnFromEventTarget(t: unknown): HTMLElement | null {
    const el = t as HTMLElement | null;
    if (!el || typeof (el as any).closest !== 'function') return null;
    return el.closest(buttonSelector) as HTMLElement | null;
  }

  function clearHold(btn: any): void {
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
    (btn as any)._holdDeleteTimer = setTimeout(function () {
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

function setSaveNeeds(saveBtnId: string, needsSave: boolean): void {
  const saveBtn = document.getElementById(saveBtnId) as HTMLButtonElement | null;
  if (!saveBtn) return;
  saveBtn.disabled = !needsSave;
}

function showGoal2Saved() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  st.textContent = 'Saved in this browser';
  clearTimeout((showGoal2Saved as any)._t);
  (showGoal2Saved as any)._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function showGoal3Saved() {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  st.textContent = 'Saved in this browser';
  clearTimeout((showGoal3Saved as any)._t);
  (showGoal3Saved as any)._t = setTimeout(function () {
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

type RenderFn = (opts?: { skipDebtsEditor?: boolean; skipSavingsEditor?: boolean; refreshBalanceEditors?: boolean }) => void;

export function wireGoal2DebtEditor(render: RenderFn): void {
  const sortSel = document.getElementById('debts-editor-sort') as HTMLSelectElement | null;
  if (sortSel) {
    sortSel.addEventListener('change', function () {
      readDebtsEditorIntoPlan();
      (PLAN as any).debtsEditorSort = sortSel.value;
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
      lastSavedDebts = cloneDebtsSnapshot();
      setSaveNeeds('btn-save-goal2-debts', false);
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = '';
    });
  }

  const progressSortSel = document.getElementById('debts-progress-sort') as HTMLSelectElement | null;
  if (progressSortSel) {
    progressSortSel.addEventListener('change', function () {
      readDebtsEditorIntoPlan();
      (PLAN as any).debtsProgressSort = progressSortSel.value;
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
      lastSavedDebts = cloneDebtsSnapshot();
      setSaveNeeds('btn-save-goal2-debts', false);
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = '';
    });
  }

  let debtDraftRerenderTimer: number | null = null;
  function scheduleDebtsDraftSyncToPlanAndRender(): void {
    if (debtDraftRerenderTimer != null) clearTimeout(debtDraftRerenderTimer);
    debtDraftRerenderTimer = window.setTimeout(function () {
      readDebtsEditorIntoPlan();
      render({ skipDebtsEditor: true, skipSavingsEditor: true });
    }, 90);
  }

  const addBtn = document.getElementById('btn-add-debt') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      addDebtRowDraft(showGoal2Unsaved);
      readDebtsEditorIntoPlan();
      render({ refreshBalanceEditors: true });
    });
  }

  const debtsHost = document.getElementById('debts-editor-list') as HTMLElement | null;
  wireMoneyMasks(debtsHost);
  const goal2Dialog = document.getElementById('goal2-editor-dialog');
  if (goal2Dialog) {
    goal2Dialog.addEventListener('click', function (e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof (t as any).closest !== 'function') return;
      const segBtn = t.closest('[data-debts-segment]') as HTMLElement | null;
      if (!segBtn || !goal2Dialog.contains(segBtn)) return;
      const seg = segBtn.getAttribute('data-debts-segment');
      if (seg !== 'active' && seg !== 'completed') return;
      readDebtsEditorIntoPlan();
      (PLAN as any).debtsEditorLedgerSegment = seg;
      render({ refreshBalanceEditors: true });
      showGoal2Unsaved();
    });
  }
  if (debtsHost) {
    const debtsHostEl = debtsHost;
    function onDebtRowFieldActivity(e: Event): void {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      const row = t.closest('.debt-row');
      if (!row || !debtsHostEl.contains(row)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      showGoal2Unsaved();
      // Do not sync/render on Pay field while typing: readDebtsEditorIntoPlan() applies
      // positive payment amounts and clears the input — the debounced input handler would
      // commit partial amounts (e.g. "5" while typing "50") and make the field "disappear".
      if ((t as any).matches && (t as any).matches('input[data-field="payment"]')) return;
      scheduleDebtsDraftSyncToPlanAndRender();
    }
    debtsHost.addEventListener('input', onDebtRowFieldActivity);
    debtsHost.addEventListener('change', onDebtRowFieldActivity);
    debtsHost.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.getAttribute !== 'function') return;
      const action = t.getAttribute('data-action');
      if (action === 'restore-active') {
        e.preventDefault();
        const row = t.closest('.debt-row');
        const id = row ? row.getAttribute('data-debt-id') : null;
        if (id == null || String(id).trim() === '') return;
        readDebtsEditorIntoPlan();
        setDebtLedgerStatusById(String(id), 'active');
        showGoal2Unsaved();
        render({ refreshBalanceEditors: true });
        return;
      }
      if (action === 'quick-payment') {
        e.preventDefault();
        // Apply payment(s) from inputs + persist immediately (no bottom Save required).
        readDebtsEditorIntoPlan();
        void savePlanOverrides();
        render({ refreshBalanceEditors: true });
        setSaveNeeds('btn-save-goal2-debts', false);
        showGoal2Saved();
        lastSavedDebts = cloneDebtsSnapshot();
        return;
      }
    });

    // Hold-to-delete debt rows (2s) then confirm → soft-delete (deleted ledger).
    wireHoldToConfirm(debtsHost, 'button[data-action="remove"]', {
      holdMs: 2000,
      confirmMessage: function (btn) {
        const row = btn.closest('.debt-row');
        const nameEl = row ? (row.querySelector('input[data-field="name"]') as HTMLInputElement | null) : null;
        const name = nameEl ? String(nameEl.value || '').trim() : '';
        const seg = debtsHostEl.dataset.debtsSegment || 'active';
        const intro =
          seg === 'completed'
            ? 'Move this paid-off debt to Recently deleted'
            : 'Archive this debt to Recently deleted';
        return (
          intro +
          (name ? ' (“' + name + '”)' : '') +
          '?\n\nYou can restore it later from Recently deleted on the dashboard. Click Save to sync.'
        );
      },
      onConfirm: function (btn) {
        readDebtsEditorIntoPlan();
        const row = btn.closest('.debt-row');
        const id = row ? row.getAttribute('data-debt-id') : null;
        if (id == null || String(id).trim() === '') return;
        if (!wasDebtIdLastSaved(String(id))) {
          hardRemoveDebtById(String(id));
          showGoal2Unsaved();
          render({ refreshBalanceEditors: true });
          return;
        }
        setDebtLedgerStatusById(String(id), 'deleted');
        showGoal2Unsaved();
        render({ refreshBalanceEditors: true });
      },
    });
  }

  const goal2Host = document.getElementById('goal2-debts');
  if (goal2Host) {
    goal2Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest('.goal2-remove-payment') as HTMLElement | null;
      if (!btn) return;
      const debtId = btn.getAttribute('data-debt-id');
      const paymentId = btn.getAttribute('data-payment-id');
      if (debtId == null || paymentId == null) return;
      const ok = window.confirm('Remove this payment record?\n\nThis will add the amount back to the debt balance.');
      if (!ok) return;
      removeDebtPayment(debtId, paymentId, showGoal2Unsaved, function () {
        render({ refreshBalanceEditors: true });
      });
      void savePlanOverrides();
      lastSavedDebts = cloneDebtsSnapshot();
    });
  }

  const saveBtn = document.getElementById('btn-save-goal2-debts');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      readDebtsEditorIntoPlan();
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
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
      render({ refreshBalanceEditors: true });
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = 'Undid changes (not saved)';
      clearTimeout((wireGoal2DebtEditor as any)._t);
      (wireGoal2DebtEditor as any)._t = setTimeout(function () {
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
            aprPct: Number.isFinite((d as any).aprPct) ? Number((d as any).aprPct) : 0,
            deferredAmount: Number.isFinite((d as any).deferredAmount) ? Number((d as any).deferredAmount) : 0,
            deferredExpiresOn: typeof (d as any).deferredExpiresOn === 'string' ? (d as any).deferredExpiresOn : '',
            deferredMonthsRemaining: Number.isFinite((d as any).deferredMonthsRemaining)
              ? Math.max(0, Math.floor(Number((d as any).deferredMonthsRemaining)))
              : 0,
            paymentHistory: [],
          };
        }),
      });
      showGoal2Unsaved();
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = 'Reset draft (click Save to apply)';
      clearTimeout((wireGoal2DebtEditor as any)._t2);
      (wireGoal2DebtEditor as any)._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    });
  }

  setSaveNeeds('btn-save-goal2-debts', false);
}

export function wireGoal3SavingsEditor(render: RenderFn): void {
  let savingsDraftRerenderTimer: number | null = null;
  function scheduleSavingsDraftSyncToPlanAndRender(): void {
    if (savingsDraftRerenderTimer != null) clearTimeout(savingsDraftRerenderTimer);
    savingsDraftRerenderTimer = window.setTimeout(function () {
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      render({ skipDebtsEditor: true, skipSavingsEditor: true });
    }, 90);
  }

  const savingsHost = document.getElementById('savings-editor-list') as HTMLElement | null;
  wireMoneyMasks(savingsHost);
  if (savingsHost) {
    const savingsHostEl = savingsHost;
    function onSavingsFieldActivity(e: Event): void {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      const row = t.closest('.savings-row');
      if (!row || !savingsHostEl.contains(row)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      showGoal3Unsaved();
      // Same as debt Pay field: readSavingsEditorIntoPlan applies positive deposits and clears the input.
      if ((t as any).matches && (t as any).matches('input[data-field="deposit"]')) return;
      scheduleSavingsDraftSyncToPlanAndRender();
    }
    savingsHost.addEventListener('input', onSavingsFieldActivity);
    savingsHost.addEventListener('change', onSavingsFieldActivity);

    savingsHost.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.getAttribute !== 'function') return;
      const action = t.getAttribute('data-action');
      if (action === 'quick-deposit') {
        e.preventDefault();
        readSavingsEditorIntoPlan();
        syncLegacySavingsFromAccounts(PLAN);
        void savePlanOverrides();
        render({ refreshBalanceEditors: true });
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
        const nameEl = row ? (row.querySelector('input[data-field="name"]') as HTMLInputElement | null) : null;
        const name = nameEl ? String(nameEl.value || '').trim() : '';
        return 'Delete this savings account' + (name ? ' (“' + name + '”)' : '') + '?\n\nThis removes the row from the draft. Click Save to persist.';
      },
      onConfirm: function (btn) {
        readSavingsEditorIntoPlan();
        const row = btn.closest('.savings-row');
        const id = row ? row.getAttribute('data-savings-id') : null;
        if (id == null || String(id).trim() === '') return;
        if (!wasSavingsIdLastSaved(String(id))) {
          hardRemoveSavingsById(String(id));
          syncLegacySavingsFromAccounts(PLAN);
          showGoal3Unsaved();
          render({ refreshBalanceEditors: true });
          return;
        }
        setSavingsLedgerStatusById(String(id), 'deleted');
        syncLegacySavingsFromAccounts(PLAN);
        showGoal3Unsaved();
        render({ refreshBalanceEditors: true });
      },
    });
  }

  const addBtn = document.getElementById('btn-add-savings') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      addSavingsRowDraft(showGoal3Unsaved);
    });
  }

  const goal3Host = document.getElementById('goal3-savings') as HTMLElement | null;
  if (goal3Host) {
    goal3Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest('.goal3-remove-deposit') as HTMLElement | null;
      if (!btn) return;
      const sid = btn.getAttribute('data-savings-id');
      const depId = btn.getAttribute('data-deposit-id');
      if (sid == null || depId == null) return;
      const ok = window.confirm('Remove this deposit record?\n\nThis will subtract the amount from the account balance.');
      if (!ok) return;
      removeSavingsDeposit(sid, depId, showGoal3Unsaved, function () {
        render({ refreshBalanceEditors: true });
      });
      syncLegacySavingsFromAccounts(PLAN);
      void savePlanOverrides();
      lastSavedSavings = cloneSavingsSnapshot();
    });
  }

  const saveBtn = document.getElementById('btn-save-goal3-savings') as HTMLButtonElement | null;
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
      setSaveNeeds('btn-save-goal3-savings', false);
      showGoal3Saved();
      lastSavedSavings = cloneSavingsSnapshot();
    });
  }

  const undoBtn = document.getElementById('btn-undo-goal3-savings') as HTMLButtonElement | null;
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      if (!lastSavedSavings) return;
      setSaveNeeds('btn-save-goal3-savings', false);
      setSavingsDraftFromSnapshot(lastSavedSavings);
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      render({ refreshBalanceEditors: true });
      const st = document.getElementById('goal3-save-status');
      if (st) st.textContent = 'Undid changes (not saved)';
      clearTimeout((wireGoal3SavingsEditor as any)._t);
      (wireGoal3SavingsEditor as any)._t = setTimeout(function () {
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
      clearTimeout((wireGoal3SavingsEditor as any)._t2);
      (wireGoal3SavingsEditor as any)._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    });
  }

  setSaveNeeds('btn-save-goal3-savings', false);
}

/** Body scroll lock while a goal editor dialog is open (wheel/touch on backdrop). */
let bodyScrollLockDepth = 0;
let bodyScrollLockY = 0;

/**
 * After removing `body { position: fixed; top: -scrollY }`, the viewport is at 0 until we
 * `scrollTo` the saved Y. Global `html { scroll-behavior: smooth }` would animate that
 * restore (snap to top, then smooth scroll down). Force an instant jump.
 */
function restoreViewportScrollY(y: number): void {
  const root = document.documentElement;
  const prevInline = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  try {
    window.scrollTo({ left: 0, top: y, behavior: 'auto' });
  } finally {
    if (prevInline) {
      root.style.scrollBehavior = prevInline;
    } else {
      root.style.removeProperty('scroll-behavior');
    }
  }
}

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
  restoreViewportScrollY(bodyScrollLockY);
}

/** Centered modal editors (native `<dialog>` + `showModal`). */
export function wireGoalEditorDialogs(): void {
  ['goal2-editor-dialog', 'goal3-editor-dialog'].forEach(function (id) {
    const d = document.getElementById(id) as HTMLDialogElement | null;
    if (d && typeof d.close === 'function') d.close();
  });

  function bindDialog(dialogId: string, btnIds: string | string[]): void {
    const dlg = document.getElementById(dialogId) as HTMLDialogElement | null;
    const ids = Array.isArray(btnIds) ? btnIds : [btnIds];
    const btns = ids
      .map(function (id) {
        return document.getElementById(id) as HTMLElement | null;
      })
      .filter(Boolean) as HTMLElement[];
    if (!dlg || !btns.length) return;

    function setExpanded(open: boolean): void {
      btns.forEach(function (b) {
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    btns.forEach(function (btn) {
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
        setExpanded(true);
      });
    });

    dlg.addEventListener('close', function () {
      unlockBodyScrollForGoalDialog();
      setExpanded(false);
    });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) {
        dlg.close();
        return;
      }
      const t = e.target as Node | null;
      const el =
        t && (t as any).nodeType === Node.TEXT_NODE ? (t as any).parentElement : (t as any as HTMLElement | null);
      if (el && typeof el.closest === 'function' && el.closest('[data-close-goal-dialog]')) {
        dlg.close();
      }
    });
  }

  bindDialog('goal2-editor-dialog', ['btn-toggle-goal2-editor', 'btn-open-debts-editor']);
  bindDialog('goal3-editor-dialog', ['btn-toggle-goal3-editor', 'btn-open-savings-editor']);
}

export function initEditorSnapshots() {
  lastSavedDebts = cloneDebtsSnapshot();
  lastSavedSavings = cloneSavingsSnapshot();
}

/** Restore debt/savings rows from the dashboard “Recently deleted” bin. */
export function wireDashboardTrashBin(render: RenderFn): void {
  document.addEventListener('click', function (e: MouseEvent) {
    const t = e.target as HTMLElement | null;
    if (!t || typeof t.closest !== 'function') return;
    const btn = t.closest('[data-action="restore-trash-item"]') as HTMLElement | null;
    if (!btn) return;
    const kind = btn.getAttribute('data-trash-kind');
    const id = btn.getAttribute('data-trash-id');
    if (!id) return;
    e.preventDefault();
    if (kind === 'savings') {
      setSavingsLedgerStatusById(id, 'active');
      syncLegacySavingsFromAccounts(PLAN);
      showGoal3Unsaved();
    } else {
      setDebtLedgerStatusById(id, 'active');
      showGoal2Unsaved();
    }
    void savePlanOverrides();
    render({ refreshBalanceEditors: true });
  });
}

export { applyPlanOverrides, cloneDebtsSnapshot, cloneSavingsSnapshot };
