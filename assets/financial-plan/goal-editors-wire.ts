/**
 * Goal 2 (debts) and Goal 3 (savings) editors: save / undo / reset, separate last-saved snapshots.
 */

import type { Debt, SavingsAccount } from '../../types/index.js';
import { PLAN, PLAN_DEFAULTS } from './plan-data';
import { applyPlanOverrides, savePlanOverrides } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { formatCurrencyInput, formatMoneyInput, parseMoneyInput, roundMoney } from './utils';
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
  st.textContent = 'Saved';
  clearTimeout((showGoal2Saved as any)._t);
  (showGoal2Saved as any)._t = setTimeout(function () {
    if (st) st.textContent = '';
  }, 1800);
}

function showGoal2SaveFailed() {
  const st = document.getElementById('goal2-save-status');
  if (!st) return;
  st.textContent = 'Save failed — try again';
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

  async function persistGoal2DebtsFromEditor(): Promise<boolean> {
    readDebtsEditorIntoPlan();
    return savePlanOverrides();
  }

  async function finishGoal2Persist(ok: boolean): Promise<void> {
    render({ refreshBalanceEditors: true });
    if (ok) {
      setSaveNeeds('btn-save-goal2-debts', false);
      showGoal2Saved();
      lastSavedDebts = cloneDebtsSnapshot();
    } else {
      showGoal2SaveFailed();
      showGoal2Unsaved();
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
      showGoal2Unsaved();
      // Do not sync/render on Pay field while typing: readDebtsEditorIntoPlan() applies
      // positive payment amounts and clears the input — the debounced input handler would
      // commit partial amounts (e.g. "5" while typing "50") and make the field "disappear".
      if ((t as any).matches && (t as any).matches('input[data-field="payment"]')) return;
      scheduleDebtsDraftSyncToPlanAndRender();
    }
    debtsHost.addEventListener('input', onDebtRowFieldActivity, { signal });
    debtsHost.addEventListener('change', onDebtRowFieldActivity, { signal });
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
        void (async function () {
          const ok = await persistGoal2DebtsFromEditor();
          await finishGoal2Persist(ok);
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
      render({ refreshBalanceEditors: true });
      focusEditingDebtCard(String(debtId));
    }

    function cancelDebtCardInlineEdit(): void {
      if (getEditingDebtCardId() == null) return;
      setEditingDebtCardId(null);
      render({ refreshBalanceEditors: true });
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
        render({ refreshBalanceEditors: true });
        return;
      }
      const nameIn = card.querySelector('input[data-field="name"]') as HTMLInputElement | null;
      const balIn = card.querySelector('input[data-field="current"]') as HTMLInputElement | null;
      const debts = Array.isArray(PLAN.debts) ? (PLAN.debts as Debt[]) : [];
      const target = debts.find(function (d) {
        return String(d.id) === id;
      });
      if (target) {
        const newName = nameIn ? String(nameIn.value || '').trim() : '';
        if (newName) target.name = newName;
        const parsed = balIn ? parseMoneyInput(balIn.value) : null;
        if (parsed != null && parsed >= 0) {
          target.current = roundMoney(parsed);
        } else if (balIn && String(balIn.value || '').trim() === '') {
          target.current = 0;
        }
      }
      setEditingDebtCardId(null);
      void (async function () {
        const ok = await savePlanOverrides();
        await finishGoal2Persist(ok);
      })();
    }

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
      void (async function () {
        const ok = await persistGoal2DebtsFromEditor();
        await finishGoal2Persist(ok);
      })();
    }, { signal });

    goal2Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const action = (t.closest('[data-action]') as HTMLElement | null)?.getAttribute('data-action') || '';
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
      if (t.closest('summary, button, a, input, select, textarea, .goal2-remove-payment')) return;
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
      void (async function () {
        const ok = await persistGoal2DebtsFromEditor();
        await finishGoal2Persist(ok);
        const dlg = document.getElementById('goal2-editor-dialog') as HTMLDialogElement | null;
        try {
          if (dlg && typeof dlg.close === 'function') dlg.close();
        } catch {}
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
}

export function wireGoal3SavingsEditor(render: RenderFn): void {
  const prevAc = (wireGoal3SavingsEditor as any)._ac as AbortController | undefined;
  if (prevAc) prevAc.abort();
  const ac = new AbortController();
  (wireGoal3SavingsEditor as any)._ac = ac;
  const signal = ac.signal;

  setEditingSavingsCardId(null);

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
    savingsHost.addEventListener('input', onSavingsFieldActivity, { signal });
    savingsHost.addEventListener('change', onSavingsFieldActivity, { signal });

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
      render({ refreshBalanceEditors: true });
      focusEditingSavingsCard(String(sid));
    }

    function cancelSavingsCardInlineEdit(): void {
      if (getEditingSavingsCardId() == null) return;
      setEditingSavingsCardId(null);
      render({ refreshBalanceEditors: true });
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
        render({ refreshBalanceEditors: true });
        return;
      }
      const nameIn = card.querySelector('input[data-field="name"]') as HTMLInputElement | null;
      const balIn = card.querySelector('input[data-field="current"]') as HTMLInputElement | null;
      const apyIn = card.querySelector('input[data-field="apyPct"]') as HTMLInputElement | null;
      const accs = Array.isArray((PLAN as any).savingsAccounts)
        ? ((PLAN as any).savingsAccounts as SavingsAccount[])
        : [];
      const target = accs.find(function (a) {
        return String(a.id) === id;
      });
      if (target) {
        const newName = nameIn ? String(nameIn.value || '').trim() : '';
        if (newName) target.name = newName;
        const parsedBal = balIn ? parseMoneyInput(balIn.value) : null;
        if (parsedBal != null) {
          target.current = roundMoney(parsedBal);
        } else if (balIn && String(balIn.value || '').trim() === '') {
          target.current = 0;
        }
        const parsedApy = apyIn ? parseMoneyInput(apyIn.value) : null;
        if (parsedApy != null && parsedApy >= 0) {
          target.apyPct = roundMoney(parsedApy);
        } else if (apyIn && String(apyIn.value || '').trim() === '') {
          target.apyPct = 0;
        }
      }
      setEditingSavingsCardId(null);
      syncLegacySavingsFromAccounts(PLAN);
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
      setSaveNeeds('btn-save-goal3-savings', false);
      showGoal3Saved();
      lastSavedSavings = cloneSavingsSnapshot();
    }

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
    }, { signal });

    goal3Host.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const action = (t.closest('[data-action]') as HTMLElement | null)?.getAttribute('data-action') || '';
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
      if (t.closest('summary, button, a, input, select, textarea, .goal3-remove-deposit')) return;
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
      readSavingsEditorIntoPlan();
      syncLegacySavingsFromAccounts(PLAN);
      void savePlanOverrides();
      render({ refreshBalanceEditors: true });
      setSaveNeeds('btn-save-goal3-savings', false);
      showGoal3Saved();
      lastSavedSavings = cloneSavingsSnapshot();
      const dlg = document.getElementById('goal3-editor-dialog') as HTMLDialogElement | null;
      try {
        if (dlg && typeof dlg.close === 'function') dlg.close();
      } catch {}
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
      }, { signal });
    });

    dlg.addEventListener('close', function () {
      unlockBodyScrollForGoalDialog();
      setExpanded(false);
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
