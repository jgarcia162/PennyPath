/**
 * Goal 2 (debts) and Goal 3 (savings) editors: save / undo / reset, separate last-saved snapshots.
 */

import type { Debt, SavingsAccount } from '../../types/index.js';
import { PLAN, PLAN_DEFAULTS } from './plan-data';
import { applyPlanOverrides, getLastPlanSaveError, savePlanOverrides } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { wireMoneyMasks } from './money-input-mask';
import { parseMoneyInput } from './utils';
import {
  getEditingDebtCardId,
  getEditingSavingsCardId,
  setEditingDebtCardId,
  setEditingSavingsCardId,
} from './card-inline-edit-state';
import {
  readDebtsEditorIntoPlan,
  cloneDebtsSnapshot,
  setDebtsDraftFromSnapshot,
  addDebtRowDraft,
  removeDebtLedgerEntry,
  setDebtLedgerStatusById,
  hardRemoveDebtById,
  mergeDebtFromCardElement,
} from './debt-editor';
import {
  readSavingsEditorIntoPlan,
  cloneSavingsSnapshot,
  setSavingsDraftFromSnapshot,
  addSavingsRowDraft,
  removeSavingsLedgerEntry,
  setSavingsLedgerStatusById,
  hardRemoveSavingsById,
  mergeSavingsFromCardElement,
} from './savings-editor';
import { freezeEditorOrders, clearEditorOrderFreeze } from './render-sections';
import type { PlanPageRenderOptions } from './render-page';
import { isLedgerPendingEditorField } from './ledger-utils';
import {
  applyGoal2SaveButtonState,
  applyGoal3SaveButtonState,
  debtsEditorHasConflictingLedgerInputs,
  debtRowHasConflictingLedgerInputs,
  debtRowHasDualLedgerAmounts,
  findDebtRowWithDualLedgerAmounts,
  findSavingsRowWithDualLedgerAmounts,
  savingsEditorHasConflictingLedgerInputs,
  savingsRowHasConflictingLedgerInputs,
  savingsRowHasDualLedgerAmounts,
} from './editor-ledger-save-guard';
import {
  clearDebtLedgerActivityInputs,
  clearDebtLedgerDraftForId,
  clearDebtLedgerDraftStore,
  clearSavingsLedgerActivityInputs,
  clearSavingsLedgerDraftForId,
  clearSavingsLedgerDraftStore,
  syncDebtLedgerDraftFromRow,
  syncSavingsLedgerDraftFromRow,
} from './ledger-editor-draft';

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

let holdDeleteHintEl: HTMLElement | null = null;
let holdDeleteHintHideTimer: ReturnType<typeof setTimeout> | null = null;

/** Prefer the open editor <dialog> so the hint sits in the modal top layer (not under the backdrop). */
function holdDeleteHintHostFor(btn: HTMLElement): HTMLElement {
  const dlg =
    (typeof btn.closest === 'function' ? btn.closest('dialog') : null) ||
    document.getElementById('goal2-editor-dialog') ||
    document.getElementById('goal3-editor-dialog');
  return (dlg as HTMLElement) || document.body;
}

function getHoldDeleteHintEl(host: HTMLElement): HTMLElement {
  if (holdDeleteHintEl && holdDeleteHintEl.isConnected) {
    if (holdDeleteHintEl.parentElement !== host) {
      host.appendChild(holdDeleteHintEl);
    }
    return holdDeleteHintEl;
  }
  const el = document.createElement('div');
  el.className = 'hold-delete-hint';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.hidden = true;
  host.appendChild(el);
  holdDeleteHintEl = el;
  return el;
}

function hideHoldDeleteHint(): void {
  if (holdDeleteHintHideTimer != null) {
    clearTimeout(holdDeleteHintHideTimer);
    holdDeleteHintHideTimer = null;
  }
  const el = holdDeleteHintEl;
  if (!el) return;
  el.classList.remove('is-visible');
  el.hidden = true;
}

function showHoldDeleteHint(btn: HTMLElement, message: string, holdMs?: number): void {
  const host = holdDeleteHintHostFor(btn);
  const el = getHoldDeleteHintEl(host);
  el.textContent = message;
  el.hidden = false;
  el.classList.add('is-visible');
  if (holdMs != null && Number.isFinite(holdMs)) {
    el.style.setProperty('--hold-delete-ms', String(holdMs) + 'ms');
  }

  const rect = btn.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const pad = 8;
  // Hint uses position:fixed (viewport coords). Keep it on-screen and point the caret at the button.
  const hintW = el.offsetWidth || 220;
  const hintH = el.offsetHeight || 36;
  const btnCenterX = rect.left + rect.width / 2;
  let left = btnCenterX - hintW / 2;
  const minLeft = Math.max(pad, hostRect.left + pad);
  const maxLeft = Math.min(window.innerWidth - hintW - pad, hostRect.right - hintW - pad);
  if (minLeft <= maxLeft) {
    left = Math.max(minLeft, Math.min(left, maxLeft));
  } else {
    left = Math.max(pad, Math.min(left, window.innerWidth - hintW - pad));
  }
  let top = rect.top - hintH - 10;
  let placeBelow = false;
  const minTop = Math.max(pad, hostRect.top + pad);
  if (top < minTop) {
    top = rect.bottom + 10;
    placeBelow = true;
  }
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
  // Caret tracks the button even when the bubble was clamped horizontally.
  const caretX = Math.max(12, Math.min(btnCenterX - left, hintW - 12));
  el.style.setProperty('--hold-hint-caret-x', Math.round(caretX) + 'px');
  el.classList.toggle('hold-delete-hint--below', placeBelow);

  if (holdDeleteHintHideTimer != null) clearTimeout(holdDeleteHintHideTimer);
  holdDeleteHintHideTimer = setTimeout(function () {
    hideHoldDeleteHint();
  }, 3200);
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
  const holdSec = Math.max(1, Math.round(holdMs / 1000));
  const confirmMessage = (opts && opts.confirmMessage) || 'Delete this item?';
  const onConfirm = (opts && opts.onConfirm) || function () {};
  const hintClick = 'Hold for ' + holdSec + ' second' + (holdSec === 1 ? '' : 's') + ' to remove';
  const hintHolding = 'Keep holding to remove…';

  function getBtnFromEventTarget(t: unknown): HTMLElement | null {
    const el = t as HTMLElement | null;
    if (!el || typeof (el as any).closest !== 'function') return null;
    return el.closest(buttonSelector) as HTMLElement | null;
  }

  function clearHold(btn: HTMLElement | null | undefined, optsClear?: { completed?: boolean }): void {
    if (!btn) return;
    const timer = (btn as any)._holdDeleteTimer as ReturnType<typeof setTimeout> | null | undefined;
    if (timer) clearTimeout(timer);
    (btn as any)._holdDeleteTimer = null;
    (btn as any)._holdDeleteArmedAt = 0;
    // Force fill animation to restart from zero on the next press.
    btn.classList.remove('is-hold-armed');
    void btn.offsetWidth;
    btn.style.removeProperty('--hold-delete-ms');
    if (!optsClear || optsClear.completed !== true) {
      /* early release — hint may still be showing */
    }
  }

  rootEl.addEventListener('pointerdown', function (e) {
    const btn = getBtnFromEventTarget(e.target);
    if (!btn) return;
    // Only arm the hold for primary button / touch.
    if (e.button != null && e.button !== 0) return;
    clearHold(btn);
    btn.style.setProperty('--hold-delete-ms', String(holdMs) + 'ms');
    btn.classList.add('is-hold-armed');
    (btn as any)._holdDeleteArmedAt = Date.now();
    showHoldDeleteHint(btn, hintHolding, holdMs);
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
    (btn as any)._holdDeleteTimer = setTimeout(function () {
      (btn as any)._holdDeleteJustCompleted = true;
      clearHold(btn, { completed: true });
      hideHoldDeleteHint();
      const msg = typeof confirmMessage === 'function' ? confirmMessage(btn) : confirmMessage;
      const ok = window.confirm(String(msg || 'Delete this item?'));
      if (!ok) {
        (btn as any)._holdDeleteJustCompleted = false;
        return;
      }
      onConfirm(btn);
    }, holdMs);
  });

  function onHoldRelease(e: Event): void {
    const btn = getBtnFromEventTarget(e.target);
    if (!btn) return;
    if ((btn as any)._holdDeleteJustCompleted) return;
    const armedAt = Number((btn as any)._holdDeleteArmedAt || 0);
    const heldMs = armedAt ? Date.now() - armedAt : 0;
    const wasArmed = btn.classList.contains('is-hold-armed');
    clearHold(btn);
    // Released early: nudge with the hold hint.
    if (wasArmed && heldMs < holdMs - 40) {
      showHoldDeleteHint(btn, hintClick, holdMs);
    }
  }

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (evt) {
    rootEl.addEventListener(evt, onHoldRelease, true);
  });

  // Prevent accidental “click to delete”; show hold hint on a quick tap.
  rootEl.addEventListener('click', function (e) {
    const btn = getBtnFromEventTarget(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if ((btn as any)._holdDeleteJustCompleted) {
      (btn as any)._holdDeleteJustCompleted = false;
      return;
    }
    showHoldDeleteHint(btn, hintClick, holdMs);
  });
}

function setSaveNeeds(saveBtnId: string, needsSave: boolean): void {
  const saveBtn = document.getElementById(saveBtnId) as HTMLButtonElement | null;
  if (!saveBtn) return;
  saveBtn.dataset.needsSave = needsSave ? '1' : '0';
  if (saveBtnId === 'btn-save-goal2-debts') applyGoal2SaveButtonState();
  else if (saveBtnId === 'btn-save-goal3-savings') applyGoal3SaveButtonState();
}

/** Ignore input/change that fires while editor DOM is torn down/rebuilt during save. */
const PERSIST_ACTIVITY_GUARD_MS = 800;
let goal2IgnoreActivityUntil = 0;
let goal3IgnoreActivityUntil = 0;
let goal2PersistInFlight = false;
let goal3PersistInFlight = false;

function beginGoal2PersistGuard(ms?: number): void {
  goal2IgnoreActivityUntil = Date.now() + (typeof ms === 'number' ? ms : PERSIST_ACTIVITY_GUARD_MS);
}

function beginGoal3PersistGuard(ms?: number): void {
  goal3IgnoreActivityUntil = Date.now() + (typeof ms === 'number' ? ms : PERSIST_ACTIVITY_GUARD_MS);
}

function shouldIgnoreGoal2EditorActivity(): boolean {
  return goal2PersistInFlight || Date.now() < goal2IgnoreActivityUntil;
}

function shouldIgnoreGoal3EditorActivity(): boolean {
  return goal3PersistInFlight || Date.now() < goal3IgnoreActivityUntil;
}

function setEditorSaving(saveBtnId: string, saving: boolean): void {
  const saveBtn = document.getElementById(saveBtnId) as HTMLButtonElement | null;
  if (!saveBtn) return;
  saveBtn.dataset.saving = saving ? '1' : '0';
  if (saveBtnId === 'btn-save-goal2-debts') applyGoal2SaveButtonState();
  else if (saveBtnId === 'btn-save-goal3-savings') applyGoal3SaveButtonState();
}

function startGoal2Persist(): void {
  goal2PersistInFlight = true;
  beginGoal2PersistGuard(60_000);
  setEditorSaving('btn-save-goal2-debts', true);
  showGoal2Saving();
}

function endGoal2Persist(): void {
  beginGoal2PersistGuard();
  setEditorSaving('btn-save-goal2-debts', false);
  goal2PersistInFlight = false;
}

function startGoal3Persist(): void {
  goal3PersistInFlight = true;
  beginGoal3PersistGuard(60_000);
  setEditorSaving('btn-save-goal3-savings', true);
  showGoal3Saving();
}

function endGoal3Persist(): void {
  beginGoal3PersistGuard();
  setEditorSaving('btn-save-goal3-savings', false);
  goal3PersistInFlight = false;
}

function captureEditorFieldBaseline(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.setAttribute('data-edit-baseline', String(el.value ?? ''));
  }
}

/** True when the field value differs from what it was when focused (real edit). */
function editorFieldChangedFromBaseline(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
    return true;
  }
  if (!el.hasAttribute('data-edit-baseline')) return true;
  const baseline = String(el.getAttribute('data-edit-baseline') ?? '');
  const current = String(el.value ?? '');
  if (current === baseline) return false;
  // Currency/rate masks may reformat display without changing the amount.
  if (el instanceof HTMLInputElement) {
    const moneyKind = el.getAttribute('data-money');
    if (moneyKind === 'currency' || moneyKind === 'rate') {
      const a = parseMoneyInput(baseline);
      const b = parseMoneyInput(current);
      if (a != null && b != null && a === b) return false;
      if ((baseline === '' || a == null) && (current === '' || b == null)) return false;
    }
  }
  return true;
}

function clearGoal2SavedTimeout(): void {
  clearTimeout((showGoal2Saved as any)._t);
}

function clearGoal3SavedTimeout(): void {
  clearTimeout((showGoal3Saved as any)._t);
}

function showGoal2Saving(): void {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  clearGoal2SavedTimeout();
  st.textContent = 'Saving…';
}

function showGoal3Saving(): void {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  clearGoal3SavedTimeout();
  st.textContent = 'Saving…';
}

function showGoal2Saved() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  st.textContent = 'Saved';
  clearGoal2SavedTimeout();
  (showGoal2Saved as any)._t = setTimeout(function () {
    if (st && st.textContent === 'Saved') st.textContent = '';
  }, 1800);
}

function showGoal2SaveFailed() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  clearGoal2SavedTimeout();
  const detail = getLastPlanSaveError();
  st.textContent = detail ? 'Save failed: ' + detail : 'Save failed — try again';
}

function showGoal3Saved() {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  st.textContent = 'Saved';
  clearGoal3SavedTimeout();
  (showGoal3Saved as any)._t = setTimeout(function () {
    if (st && st.textContent === 'Saved') st.textContent = '';
  }, 1800);
}

function showGoal3SaveFailed() {
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  clearGoal3SavedTimeout();
  const detail = getLastPlanSaveError();
  st.textContent = detail ? 'Save failed: ' + detail : 'Save failed — try again';
}

function showGoal2Unsaved(opts?: { force?: boolean }) {
  if (goal2PersistInFlight) return;
  if (!opts?.force && shouldIgnoreGoal2EditorActivity()) return;
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  clearGoal2SavedTimeout();
  st.textContent = 'Unsaved changes';
  setSaveNeeds('btn-save-goal2-debts', true);
}

function showGoal3Unsaved(opts?: { force?: boolean }) {
  if (goal3PersistInFlight) return;
  if (!opts?.force && shouldIgnoreGoal3EditorActivity()) return;
  const st = document.getElementById('goal3-save-status');
  if (!st) return;
  clearGoal3SavedTimeout();
  st.textContent = 'Unsaved changes';
  setSaveNeeds('btn-save-goal3-savings', true);
}

function clearGoal2SaveStatus(): void {
  const st = document.getElementById('goal2-save-status');
  if (st) st.textContent = '';
  setSaveNeeds('btn-save-goal2-debts', false);
}

function clearGoal3SaveStatus(): void {
  const st = document.getElementById('goal3-save-status');
  if (st) st.textContent = '';
  setSaveNeeds('btn-save-goal3-savings', false);
}

/** Mark unsaved only when the focused field's value actually changed. */
function markUnsavedFromEditorField(
  el: HTMLElement,
  which: 'goal2' | 'goal3'
): boolean {
  if (which === 'goal2' ? shouldIgnoreGoal2EditorActivity() : shouldIgnoreGoal3EditorActivity()) {
    return false;
  }
  if (!editorFieldChangedFromBaseline(el)) return false;
  if (which === 'goal2') showGoal2Unsaved({ force: true });
  else showGoal3Unsaved({ force: true });
  return true;
}

type RenderFn = (opts?: PlanPageRenderOptions) => void;

export function wireGoal2DebtEditor(render: RenderFn): void {
  // This module can be initialized multiple times (Next.js client navigation back to /dashboard).
  // Abort previous listeners so we don't double-bind actions (double add rows, scroll-lock stuck, etc).
  const prevAc = (wireGoal2DebtEditor as any)._ac as AbortController | undefined;
  if (prevAc) prevAc.abort();
  const ac = new AbortController();
  (wireGoal2DebtEditor as any)._ac = ac;
  const signal = ac.signal;

  // Stale inline-edit state from a previous mount would re-render a card in edit mode
  // before the user has even interacted — drop it on rebind.
  setEditingDebtCardId(null);

  async function saveGoal2DebtsFromEditor(opts?: { applyPendingLedger?: boolean }): Promise<boolean> {
    readDebtsEditorIntoPlan({ applyPendingLedger: opts?.applyPendingLedger === true });
    return savePlanOverrides();
  }

  async function finishGoal2Persist(
    ok: boolean,
    opts?: {
      preserveLedgerActivityDrafts?: boolean;
      refreshGoal2DebtsCards?: boolean;
      refreshGoal3SavingsCards?: boolean;
    }
  ): Promise<void> {
    beginGoal2PersistGuard();
    if (debtDraftRerenderTimer != null) {
      clearTimeout(debtDraftRerenderTimer);
      debtDraftRerenderTimer = null;
    }
    render({
      refreshBalanceEditors: true,
      refreshGoal2DebtsCards:
        opts?.refreshGoal2DebtsCards === true || getEditingDebtCardId() == null,
      refreshGoal3SavingsCards:
        opts?.refreshGoal3SavingsCards === true || getEditingSavingsCardId() == null,
      preserveLedgerActivityDrafts: opts?.preserveLedgerActivityDrafts !== false,
    });
    applyGoal2SaveButtonState();
    if (ok) {
      setSaveNeeds('btn-save-goal2-debts', false);
      showGoal2Saved();
      lastSavedDebts = cloneDebtsSnapshot();
    } else {
      showGoal2SaveFailed();
      setSaveNeeds('btn-save-goal2-debts', true);
    }
  }

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
    }, { signal });
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
    }, { signal });
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
      // Always add debts to the Active ledger segment.
      // If the editor is currently showing Paid off, switch segments first so
      // readDebtsEditorIntoPlan() doesn't stamp ledgerStatus=completed onto drafts.
      if ((PLAN as any).debtsEditorLedgerSegment !== 'active') {
        (PLAN as any).debtsEditorLedgerSegment = 'active';
        render({ refreshBalanceEditors: true });
      }
      addDebtRowDraft(showGoal2Unsaved);
      readDebtsEditorIntoPlan();
      render({ refreshBalanceEditors: true });
    }, { signal });
  }

  const debtsHost = document.getElementById('debts-editor-list') as HTMLElement | null;
  const goal2Dialog = document.getElementById('goal2-editor-dialog') as HTMLElement | null;
  // Prefer the dialog root so every currency field in the Debts editor window is covered.
  wireMoneyMasks(goal2Dialog || debtsHost);
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
    }, { signal });
  }
  if (debtsHost) {
    const debtsHostEl = debtsHost;
    function onDebtRowFieldActivity(e: Event): void {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      const row = t.closest('.debt-row');
      if (!row || !debtsHostEl.contains(row)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      // Activity fields: never draft-sync or mark Save; commit only via Add (not Save).
      if (isLedgerPendingEditorField(t)) {
        syncDebtLedgerDraftFromRow(row);
        applyGoal2SaveButtonState();
        return;
      }
      if (!markUnsavedFromEditorField(t, 'goal2')) return;
      scheduleDebtsDraftSyncToPlanAndRender();
    }
    debtsHost.addEventListener('focusin', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      if (!t.closest('.debt-row') || !debtsHostEl.contains(t)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      captureEditorFieldBaseline(t);
    }, { signal });
    debtsHost.addEventListener('input', onDebtRowFieldActivity, { signal });
    debtsHost.addEventListener('change', onDebtRowFieldActivity, { signal });
    debtsHost.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const actionEl = t.closest('[data-action]') as HTMLElement | null;
      const action = actionEl ? actionEl.getAttribute('data-action') : null;
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
      if (action === 'quick-ledger-entry') {
        e.preventDefault();
        if (debtsEditorHasConflictingLedgerInputs() || findDebtRowWithDualLedgerAmounts()) {
          window.alert(
            'Enter only a payment or a charge amount (not both), then tap Add again.'
          );
          applyGoal2SaveButtonState();
          return;
        }
        void (async function () {
          startGoal2Persist();
          try {
            if (debtDraftRerenderTimer != null) {
              clearTimeout(debtDraftRerenderTimer);
              debtDraftRerenderTimer = null;
            }
            readDebtsEditorIntoPlan({ applyPendingLedger: true });
            clearDebtLedgerDraftStore();
            clearDebtLedgerActivityInputs(debtsHostEl);
            const ok = await savePlanOverrides();
            clearDebtLedgerDraftStore();
            clearDebtLedgerActivityInputs(debtsHostEl);
            await finishGoal2Persist(ok, { preserveLedgerActivityDrafts: false });
          } finally {
            endGoal2Persist();
          }
        })();
        return;
      }
    }, { signal });

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
    wireMoneyMasks(goal2Host);

    function focusEditingDebtCard(debtId: string): void {
      function run(): void {
        const host = document.getElementById('goal2-debts');
        if (!host) return;
        const idEsc =
          typeof CSS !== 'undefined' && CSS.escape
            ? CSS.escape(debtId)
            : debtId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const card = host.querySelector(
          '.goal2-debt--editing[data-debt-id="' + idEsc + '"]'
        ) as HTMLElement | null;
        if (!card) return;
        const input = card.querySelector('input.card-inline-edit-name') as HTMLInputElement | null;
        if (input && typeof input.focus === 'function') {
          input.focus();
          try {
            input.select();
          } catch {}
        }
      }
      queueMicrotask(function () {
        requestAnimationFrame(run);
      });
    }

    function enterDebtCardInlineEdit(debtId: string): void {
      if (getEditingDebtCardId() === String(debtId)) {
        focusEditingDebtCard(String(debtId));
        return;
      }
      setEditingDebtCardId(String(debtId));
      render({ refreshBalanceEditors: true, refreshGoal2DebtsCards: true });
      focusEditingDebtCard(String(debtId));
      applyGoal2SaveButtonState();
    }

    function cancelDebtCardInlineEdit(): void {
      if (getEditingDebtCardId() == null) return;
      setEditingDebtCardId(null);
      render({ refreshBalanceEditors: true, refreshGoal2DebtsCards: true });
    }

    function commitDebtCardInlineEdit(): void {
      const id = getEditingDebtCardId();
      if (!id) return;
      const host = document.getElementById('goal2-debts');
      const idEsc =
        typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(id)
          : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const card = host
        ? (host.querySelector('.goal2-debt--editing[data-debt-id="' + idEsc + '"]') as HTMLElement | null)
        : null;
      if (!card) {
        setEditingDebtCardId(null);
        render({ refreshBalanceEditors: true, refreshGoal2DebtsCards: true });
        return;
      }
      if (debtRowHasConflictingLedgerInputs(card) || debtRowHasDualLedgerAmounts(card)) {
        window.alert(
          'Enter only a payment or a charge amount (not both), then tap Save or Add again.'
        );
        applyGoal2SaveButtonState();
        return;
      }
      mergeDebtFromCardElement(card, { applyPendingLedger: true });
      clearDebtLedgerDraftForId(String(id));
      setEditingDebtCardId(null);
      render({ refreshBalanceEditors: true, refreshGoal2DebtsCards: true });
      void (async function () {
        startGoal2Persist();
        try {
          const ok = await savePlanOverrides();
          await finishGoal2Persist(ok);
        } finally {
          endGoal2Persist();
        }
      })();
    }

    function openDebtCardRecentActivity(debtId: string): void {
      const host = document.getElementById('goal2-debts');
      if (!host) return;
      const idEsc =
        typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(debtId)
          : debtId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const det = host.querySelector(
        '.goal2-debt[data-debt-id="' + idEsc + '"] .goal2-debt-payments'
      ) as HTMLDetailsElement | null;
      if (det) det.open = true;
    }

    function applyDebtCardLedgerQuickAdd(card: HTMLElement): void {
      if (debtRowHasConflictingLedgerInputs(card) || debtRowHasDualLedgerAmounts(card)) {
        window.alert(
          'Enter only a payment or a charge amount (not both), then tap Add again.'
        );
        applyGoal2SaveButtonState();
        return;
      }
      const debtId = card.getAttribute('data-debt-id');
      mergeDebtFromCardElement(card, { applyPendingLedger: true });
      clearDebtLedgerActivityInputs(card);
      if (debtId) clearDebtLedgerDraftForId(String(debtId));
      void (async function () {
        startGoal2Persist();
        try {
          const ok = await savePlanOverrides();
          await finishGoal2Persist(ok, { refreshGoal2DebtsCards: true });
          if (debtId) openDebtCardRecentActivity(String(debtId));
        } finally {
          endGoal2Persist();
        }
      })();
    }

    goal2Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest('.goal2-remove-ledger-entry, .goal2-remove-payment') as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const debtId = btn.getAttribute('data-debt-id');
      const entryId = btn.getAttribute('data-ledger-id') || btn.getAttribute('data-payment-id');
      if (debtId == null || entryId == null || String(entryId).trim() === '') return;
      const ok = window.confirm('Remove this activity record?\n\nThe balance will be adjusted.');
      if (!ok) return;
      const removed = removeDebtLedgerEntry(debtId, entryId, showGoal2Unsaved, function () {
        render({ refreshBalanceEditors: true, refreshGoal2DebtsCards: true });
      });
      if (!removed) return;
      // Persist PLAN as-is — do not re-read the debts editor (that can overwrite card edits).
      void (async function () {
        startGoal2Persist();
        try {
          const saved = await savePlanOverrides();
          await finishGoal2Persist(saved, { refreshGoal2DebtsCards: true });
        } finally {
          endGoal2Persist();
        }
      })();
    }, { signal });

    goal2Host.addEventListener('input', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const card = t.closest('.goal2-debt--editing');
      if (!card) return;
      if (isLedgerPendingEditorField(t)) {
        syncDebtLedgerDraftFromRow(card);
        applyGoal2SaveButtonState();
      }
    }, { signal });

    goal2Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const action = (t.closest('[data-action]') as HTMLElement | null)?.getAttribute('data-action') || '';
      if (action === 'quick-ledger-entry') {
        const card = t.closest('.goal2-debt--editing') as HTMLElement | null;
        if (card) {
          e.preventDefault();
          applyDebtCardLedgerQuickAdd(card);
          return;
        }
      }
      if (action === 'inline-save-debt') {
        e.preventDefault();
        commitDebtCardInlineEdit();
        return;
      }
      if (action === 'inline-cancel-debt') {
        e.preventDefault();
        cancelDebtCardInlineEdit();
        return;
      }

      const debtEl = t.closest('.goal2-debt') as HTMLElement | null;
      if (!debtEl) return;

      // Ignore clicks on interactive children (details toggles, remove buttons, inputs).
      if (
        t.closest(
          'summary, button, a, input, select, textarea, .goal2-remove-ledger-entry, .goal2-remove-payment, .btn-quick-ledger-entry'
        )
      )
        return;
      // Already editing this card — let focus/typing happen.
      if (debtEl.classList.contains('goal2-debt--editing')) return;

      const debtId = debtEl.getAttribute('data-debt-id');
      if (!debtId) return;
      e.preventDefault();
      enterDebtCardInlineEdit(String(debtId));
    }, { signal });

    goal2Host.addEventListener('keydown', function (e) {
      const ke = e as KeyboardEvent;
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;

      if (ke.key === 'Escape' && getEditingDebtCardId() != null) {
        const card = t.closest('.goal2-debt--editing');
        if (card) {
          ke.preventDefault();
          cancelDebtCardInlineEdit();
        }
        return;
      }
      if (ke.key === 'Enter' && getEditingDebtCardId() != null) {
        const card = t.closest('.goal2-debt--editing');
        const tag = (t.tagName || '').toLowerCase();
        if (card && (tag === 'input' || tag === 'button')) {
          ke.preventDefault();
          commitDebtCardInlineEdit();
        }
        return;
      }
      if (ke.key !== 'Enter' && ke.key !== ' ') return;
      if (t.closest('input, textarea, select, button')) return;
      const debtEl = t.closest('.goal2-debt') as HTMLElement | null;
      if (!debtEl) return;
      if (debtEl.classList.contains('goal2-debt--editing')) return;
      const debtId = debtEl.getAttribute('data-debt-id');
      if (!debtId) return;
      e.preventDefault();
      enterDebtCardInlineEdit(String(debtId));
    }, { signal });
  }

  const saveBtn = document.getElementById('btn-save-goal2-debts');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      if (debtsEditorHasConflictingLedgerInputs()) return;
      if (goal2PersistInFlight) return;
      void (async function () {
        startGoal2Persist();
        try {
          const ok = await saveGoal2DebtsFromEditor();
          await finishGoal2Persist(ok);
        } finally {
          endGoal2Persist();
        }
      })();
    }, { signal });
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
    }, { signal });
  }

  const resetBtn = document.getElementById('btn-reset-goal2-debts');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      // Reset draft should not wipe existing debt rows.
      // Prefer restoring the last-saved snapshot; fall back to defaults only if we never bootstrapped.
      if (lastSavedDebts) {
        setDebtsDraftFromSnapshot(lastSavedDebts);
      } else {
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
      }
      showGoal2Unsaved();
      const st = document.getElementById('goal2-save-status');
      if (st) st.textContent = 'Reset draft (click Save to apply)';
      clearTimeout((wireGoal2DebtEditor as any)._t2);
      (wireGoal2DebtEditor as any)._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    }, { signal });
  }

  setSaveNeeds('btn-save-goal2-debts', false);
  applyGoal2SaveButtonState();
}

export function wireGoal3SavingsEditor(render: RenderFn): void {
  const prevAc = (wireGoal3SavingsEditor as any)._ac as AbortController | undefined;
  if (prevAc) prevAc.abort();
  const ac = new AbortController();
  (wireGoal3SavingsEditor as any)._ac = ac;
  const signal = ac.signal;

  setEditingSavingsCardId(null);

  async function finishGoal3Persist(
    ok: boolean,
    opts?: {
      preserveLedgerActivityDrafts?: boolean;
      refreshGoal2DebtsCards?: boolean;
      refreshGoal3SavingsCards?: boolean;
    }
  ): Promise<void> {
    beginGoal3PersistGuard();
    cancelSavingsDraftSyncTimer();
    render({
      refreshBalanceEditors: true,
      refreshGoal2DebtsCards:
        opts?.refreshGoal2DebtsCards === true || getEditingDebtCardId() == null,
      refreshGoal3SavingsCards:
        opts?.refreshGoal3SavingsCards === true || getEditingSavingsCardId() == null,
      preserveLedgerActivityDrafts: opts?.preserveLedgerActivityDrafts !== false,
    });
    applyGoal3SaveButtonState();
    if (ok) {
      setSaveNeeds('btn-save-goal3-savings', false);
      showGoal3Saved();
      lastSavedSavings = cloneSavingsSnapshot();
    } else {
      showGoal3SaveFailed();
      setSaveNeeds('btn-save-goal3-savings', true);
    }
  }

  let savingsDraftRerenderTimer: number | null = null;
  function cancelSavingsDraftSyncTimer(): void {
    if (savingsDraftRerenderTimer != null) {
      clearTimeout(savingsDraftRerenderTimer);
      savingsDraftRerenderTimer = null;
    }
  }
  function scheduleSavingsDraftSyncToPlanAndRender(): void {
    if (savingsDraftRerenderTimer != null) clearTimeout(savingsDraftRerenderTimer);
    savingsDraftRerenderTimer = window.setTimeout(function () {
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      render({ skipDebtsEditor: true, skipSavingsEditor: true });
    }, 90);
  }

  const savingsHost = document.getElementById('savings-editor-list') as HTMLElement | null;
  const goal3Dialog = document.getElementById('goal3-editor-dialog') as HTMLElement | null;
  // Prefer the dialog root so every currency field in the Savings editor window is covered.
  wireMoneyMasks(goal3Dialog || savingsHost);
  if (savingsHost) {
    const savingsHostEl = savingsHost;
    function onSavingsFieldActivity(e: Event): void {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      const row = t.closest('.savings-row');
      if (!row || !savingsHostEl.contains(row)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      if (isLedgerPendingEditorField(t)) {
        syncSavingsLedgerDraftFromRow(row);
        applyGoal3SaveButtonState();
        return;
      }
      if (!markUnsavedFromEditorField(t, 'goal3')) return;
      scheduleSavingsDraftSyncToPlanAndRender();
    }
    savingsHost.addEventListener('focusin', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || typeof (t as any).matches !== 'function') return;
      if (!t.closest('.savings-row') || !savingsHostEl.contains(t)) return;
      if (!(t as any).matches('input, textarea, select')) return;
      captureEditorFieldBaseline(t);
    }, { signal });
    savingsHost.addEventListener('input', onSavingsFieldActivity, { signal });
    savingsHost.addEventListener('change', onSavingsFieldActivity, { signal });

    savingsHost.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const actionEl = t.closest('[data-action]') as HTMLElement | null;
      const action = actionEl ? actionEl.getAttribute('data-action') : null;
      if (action === 'quick-savings-ledger-entry') {
        e.preventDefault();
        if (savingsEditorHasConflictingLedgerInputs() || findSavingsRowWithDualLedgerAmounts()) {
          window.alert(
            'Enter only a deposit or a withdrawal amount (not both), then tap Add again.'
          );
          applyGoal3SaveButtonState();
          return;
        }
        void (async function () {
          startGoal3Persist();
          try {
            cancelSavingsDraftSyncTimer();
            readSavingsEditorIntoPlan({ applyPendingLedger: true });
            clearSavingsLedgerDraftStore();
            clearSavingsLedgerActivityInputs(savingsHostEl);
            syncLegacySavingsFromAccounts(PLAN);
            const ok = await savePlanOverrides();
            clearSavingsLedgerDraftStore();
            clearSavingsLedgerActivityInputs(savingsHostEl);
            await finishGoal3Persist(ok, { preserveLedgerActivityDrafts: false });
          } finally {
            endGoal3Persist();
          }
        })();
        return;
      }
    }, { signal });

    // Hold-to-delete savings rows (2s) then confirm.
    wireHoldToConfirm(savingsHost, 'button[data-action="remove"]', {
      holdMs: 2000,
      confirmMessage: function (btn) {
        const row = btn.closest('.savings-row');
        const nameEl = row ? (row.querySelector('input[data-field="name"]') as HTMLInputElement | null) : null;
        const name = nameEl ? String(nameEl.value || '').trim() : '';
        const id = row ? row.getAttribute('data-savings-id') : null;
        if (id && wasSavingsIdLastSaved(String(id))) {
          return (
            'Move this savings account' +
            (name ? ' (“' + name + '”)' : '') +
            ' to Recently deleted?\n\nYou can restore it later from Recently deleted on the dashboard. Click Save to sync.'
          );
        }
        return (
          'Delete this savings account' +
          (name ? ' (“' + name + '”)' : '') +
          '?\n\nThis removes the row from the draft. Click Save to persist.'
        );
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
    }, { signal });
  }

  const goal3Host = document.getElementById('goal3-savings') as HTMLElement | null;
  if (goal3Host) {
    wireMoneyMasks(goal3Host);

    function focusEditingSavingsCard(sid: string): void {
      function run(): void {
        const host = document.getElementById('goal3-savings');
        if (!host) return;
        const idEsc =
          typeof CSS !== 'undefined' && CSS.escape
            ? CSS.escape(sid)
            : sid.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const card = host.querySelector(
          '.goal3-savings-account--editing[data-savings-id="' + idEsc + '"]'
        ) as HTMLElement | null;
        if (!card) return;
        const input = card.querySelector('input.card-inline-edit-name') as HTMLInputElement | null;
        if (input && typeof input.focus === 'function') {
          input.focus();
          try {
            input.select();
          } catch {}
        }
      }
      queueMicrotask(function () {
        requestAnimationFrame(run);
      });
    }

    function enterSavingsCardInlineEdit(sid: string): void {
      if (getEditingSavingsCardId() === String(sid)) {
        focusEditingSavingsCard(String(sid));
        return;
      }
      setEditingSavingsCardId(String(sid));
      render({ refreshBalanceEditors: true, refreshGoal3SavingsCards: true });
      focusEditingSavingsCard(String(sid));
      applyGoal3SaveButtonState();
    }

    function cancelSavingsCardInlineEdit(): void {
      if (getEditingSavingsCardId() == null) return;
      setEditingSavingsCardId(null);
      render({ refreshBalanceEditors: true, refreshGoal3SavingsCards: true });
    }

    function commitSavingsCardInlineEdit(): void {
      const id = getEditingSavingsCardId();
      if (!id) return;
      const host = document.getElementById('goal3-savings');
      const idEsc =
        typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(id)
          : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const card = host
        ? (host.querySelector(
            '.goal3-savings-account--editing[data-savings-id="' + idEsc + '"]'
          ) as HTMLElement | null)
        : null;
      if (!card) {
        setEditingSavingsCardId(null);
        render({ refreshBalanceEditors: true, refreshGoal3SavingsCards: true });
        return;
      }
      if (savingsRowHasConflictingLedgerInputs(card) || savingsRowHasDualLedgerAmounts(card)) {
        window.alert(
          'Enter only a deposit or a withdrawal amount (not both), then tap Save or Add again.'
        );
        applyGoal3SaveButtonState();
        return;
      }
      mergeSavingsFromCardElement(card, { applyPendingLedger: true });
      clearSavingsLedgerDraftForId(String(id));
      setEditingSavingsCardId(null);
      render({ refreshBalanceEditors: true, refreshGoal3SavingsCards: true });
      void (async function () {
        startGoal3Persist();
        try {
          const ok = await savePlanOverrides();
          await finishGoal3Persist(ok);
        } finally {
          endGoal3Persist();
        }
      })();
    }

    function openSavingsCardRecentActivity(savingsId: string): void {
      const host = document.getElementById('goal3-savings');
      if (!host) return;
      const idEsc =
        typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(savingsId)
          : savingsId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const det = host.querySelector(
        '.goal3-savings-account[data-savings-id="' + idEsc + '"] .goal3-savings-deposits'
      ) as HTMLDetailsElement | null;
      if (det) det.open = true;
    }

    function applySavingsCardLedgerQuickAdd(card: HTMLElement): void {
      if (savingsRowHasConflictingLedgerInputs(card) || savingsRowHasDualLedgerAmounts(card)) {
        window.alert(
          'Enter only a deposit or a withdrawal amount (not both), then tap Add again.'
        );
        applyGoal3SaveButtonState();
        return;
      }
      const savingsId = card.getAttribute('data-savings-id');
      mergeSavingsFromCardElement(card, { applyPendingLedger: true });
      clearSavingsLedgerActivityInputs(card);
      if (savingsId) clearSavingsLedgerDraftForId(String(savingsId));
      void (async function () {
        startGoal3Persist();
        try {
          const ok = await savePlanOverrides();
          await finishGoal3Persist(ok, { refreshGoal3SavingsCards: true });
          if (savingsId) openSavingsCardRecentActivity(String(savingsId));
        } finally {
          endGoal3Persist();
        }
      })();
    }

    goal3Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest('.goal3-remove-ledger-entry, .goal3-remove-deposit') as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const sid = btn.getAttribute('data-savings-id');
      const entryId = btn.getAttribute('data-ledger-id') || btn.getAttribute('data-deposit-id');
      if (sid == null || entryId == null || String(entryId).trim() === '') return;
      const ok = window.confirm('Remove this activity record?\n\nThe balance will be adjusted.');
      if (!ok) return;
      const removed = removeSavingsLedgerEntry(sid, entryId, showGoal3Unsaved, function () {
        render({ refreshBalanceEditors: true, refreshGoal3SavingsCards: true });
      });
      if (!removed) return;
      syncLegacySavingsFromAccounts(PLAN);
      void (async function () {
        startGoal3Persist();
        try {
          const saved = await savePlanOverrides();
          await finishGoal3Persist(saved, { refreshGoal3SavingsCards: true });
        } finally {
          endGoal3Persist();
        }
      })();
    }, { signal });

    goal3Host.addEventListener('input', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const card = t.closest('.goal3-savings-account--editing');
      if (!card) return;
      if (isLedgerPendingEditorField(t)) {
        syncSavingsLedgerDraftFromRow(card);
        applyGoal3SaveButtonState();
      }
    }, { signal });

    goal3Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const action = (t.closest('[data-action]') as HTMLElement | null)?.getAttribute('data-action') || '';
      if (action === 'quick-savings-ledger-entry') {
        const card = t.closest('.goal3-savings-account--editing') as HTMLElement | null;
        if (card) {
          e.preventDefault();
          applySavingsCardLedgerQuickAdd(card);
          return;
        }
      }
      if (action === 'inline-save-savings') {
        e.preventDefault();
        commitSavingsCardInlineEdit();
        return;
      }
      if (action === 'inline-cancel-savings') {
        e.preventDefault();
        cancelSavingsCardInlineEdit();
        return;
      }

      const accountEl = t.closest('.goal3-savings-account') as HTMLElement | null;
      if (!accountEl) return;

      // Ignore clicks on interactive children (details toggles, remove buttons, inputs).
      if (
        t.closest(
          'summary, button, a, input, select, textarea, .goal3-remove-ledger-entry, .goal3-remove-deposit, .btn-quick-savings-ledger-entry'
        )
      )
        return;
      if (accountEl.classList.contains('goal3-savings-account--editing')) return;

      const sid = accountEl.getAttribute('data-savings-id');
      if (!sid) return;
      e.preventDefault();
      enterSavingsCardInlineEdit(String(sid));
    }, { signal });

    goal3Host.addEventListener('keydown', function (e) {
      const ke = e as KeyboardEvent;
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;

      if (ke.key === 'Escape' && getEditingSavingsCardId() != null) {
        const card = t.closest('.goal3-savings-account--editing');
        if (card) {
          ke.preventDefault();
          cancelSavingsCardInlineEdit();
        }
        return;
      }
      if (ke.key === 'Enter' && getEditingSavingsCardId() != null) {
        const card = t.closest('.goal3-savings-account--editing');
        const tag = (t.tagName || '').toLowerCase();
        if (card && (tag === 'input' || tag === 'button')) {
          ke.preventDefault();
          commitSavingsCardInlineEdit();
        }
        return;
      }
      if (ke.key !== 'Enter' && ke.key !== ' ') return;
      if (t.closest('input, textarea, select, button')) return;
      const accountEl = t.closest('.goal3-savings-account') as HTMLElement | null;
      if (!accountEl) return;
      if (accountEl.classList.contains('goal3-savings-account--editing')) return;
      const sid = accountEl.getAttribute('data-savings-id');
      if (!sid) return;
      e.preventDefault();
      enterSavingsCardInlineEdit(String(sid));
    }, { signal });
  }

  const saveBtn = document.getElementById('btn-save-goal3-savings') as HTMLButtonElement | null;
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      if (savingsEditorHasConflictingLedgerInputs()) return;
      if (goal3PersistInFlight) return;
      void (async function () {
        startGoal3Persist();
        try {
          cancelSavingsDraftSyncTimer();
          readSavingsEditorIntoPlan();
          syncLegacySavingsFromAccounts(PLAN);
          const ok = await savePlanOverrides();
          await finishGoal3Persist(ok);
        } finally {
          endGoal3Persist();
        }
      })();
    }, { signal });
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
    }, { signal });
  }

  const resetBtn = document.getElementById('btn-reset-goal3-savings');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      // Reset draft should restore the initial snapshot (e.g. trial seed) rather than zeroing balances.
      if (lastSavedSavings) {
        setSavingsDraftFromSnapshot(lastSavedSavings);
      } else {
        setSavingsDraftFromSnapshot({ savingsAccounts: JSON.parse(JSON.stringify(PLAN_DEFAULTS.savingsAccounts || [])) });
      }
      showGoal3Unsaved();
      const st = document.getElementById('goal3-save-status');
      if (st) st.textContent = 'Reset draft (click Save to apply)';
      clearTimeout((wireGoal3SavingsEditor as any)._t2);
      (wireGoal3SavingsEditor as any)._t2 = setTimeout(function () {
        if (st) st.textContent = '';
      }, 2400);
    }, { signal });
  }

  setSaveNeeds('btn-save-goal3-savings', false);
  applyGoal3SaveButtonState();
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
  const prevAc = (wireGoalEditorDialogs as any)._ac as AbortController | undefined;
  if (prevAc) prevAc.abort();
  const ac = new AbortController();
  (wireGoalEditorDialogs as any)._ac = ac;
  const signal = ac.signal;

  ['goal2-editor-dialog', 'goal3-editor-dialog'].forEach(function (id) {
    const d = document.getElementById(id) as HTMLDialogElement | null;
    if (d && typeof d.close === 'function') d.close();
  });
  // If a dialog was opened multiple times due to double-bound listeners, scroll lock can get stuck.
  // Always reset on rewire.
  bodyScrollLockDepth = 0;
  try {
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
  } catch {}

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
        freezeEditorOrders(PLAN);
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
        if (dialogId === 'goal2-editor-dialog') clearGoal2SaveStatus();
        else if (dialogId === 'goal3-editor-dialog') clearGoal3SaveStatus();
      }, { signal });
    });

    dlg.addEventListener('close', function () {
      clearEditorOrderFreeze();
      unlockBodyScrollForGoalDialog();
      setExpanded(false);
      if (dialogId === 'goal2-editor-dialog') clearGoal2SaveStatus();
      else if (dialogId === 'goal3-editor-dialog') clearGoal3SaveStatus();
    }, { signal });

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
    }, { signal });
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
    void savePlanOverrides().then(function () {
      if (kind === 'savings') {
        lastSavedSavings = cloneSavingsSnapshot();
      } else {
        lastSavedDebts = cloneDebtsSnapshot();
      }
      render({ refreshBalanceEditors: true });
    });
  });
}

export { applyPlanOverrides, cloneDebtsSnapshot, cloneSavingsSnapshot };
