/**
 * Dialog for editing paycheck amount, paychecks per month, and monthly take-home.
 */

import type { FinancialPlan } from '../../types/index.js';
import { PLAN } from './plan-data';
import { updateBufferRowAmount } from './budget-categories';
import { currencyDigitsOnly, wireMoneyMasks } from './money-input-mask';
import { getLastPlanSaveError, savePlanOverrides } from './persistence';
import {
  applyTakeHomePay,
  draftFromPlan,
  formatPaycheckCount,
  resolveTakeHome,
  type TakeHomeDraft,
  type TakeHomeSource,
} from './takehome-pay';
import { formatCurrencyInput, parseMoneyInput } from './utils';

type RenderFn = (opts?: { refreshBalanceEditors?: boolean }) => void;

function setCurrencyField(el: HTMLInputElement, amt: number): void {
  el.value = formatCurrencyInput(amt);
  el.dataset.moneyDigits = currencyDigitsOnly(el.value);
}

function readMoney(el: HTMLInputElement | null): number {
  if (!el) return 0;
  const n = parseMoneyInput(el.value);
  return n == null ? 0 : Math.max(0, n);
}

function readCount(el: HTMLInputElement | null): number {
  if (!el) return 0;
  const n = parseMoneyInput(el.value);
  return n == null ? 0 : Math.max(0, n);
}

export function wireTakeHomeEditor(render: RenderFn): void {
  const prev = (wireTakeHomeEditor as { _ac?: AbortController })._ac;
  if (prev) prev.abort();
  const ac = new AbortController();
  (wireTakeHomeEditor as { _ac?: AbortController })._ac = ac;
  const signal = ac.signal;

  const dlgEl = document.getElementById('takehome-editor-dialog') as HTMLDialogElement | null;
  const paycheckInput = document.getElementById('takehome-paycheck') as HTMLInputElement | null;
  const countInput = document.getElementById('takehome-count') as HTMLInputElement | null;
  const monthlyInput = document.getElementById('takehome-monthly') as HTMLInputElement | null;
  const statusEl = document.getElementById('takehome-editor-status');
  const saveBtn = document.getElementById('btn-save-takehome') as HTMLButtonElement | null;
  const form = document.getElementById('takehome-editor-form') as HTMLFormElement | null;
  const openBtns = ['btn-edit-takehome', 'btn-edit-takehome-cover']
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean) as HTMLElement[];

  if (!dlgEl || !paycheckInput || !countInput || !monthlyInput || !openBtns.length) return;

  const dlg: HTMLDialogElement = dlgEl;
  const paycheckEl: HTMLInputElement = paycheckInput;
  const countEl: HTMLInputElement = countInput;
  const monthlyEl: HTMLInputElement = monthlyInput;

  wireMoneyMasks(dlg);

  let source: TakeHomeSource = 'paycheck';
  let saving = false;

  function setStatus(msg: string): void {
    if (statusEl) statusEl.textContent = msg;
  }

  function setExpanded(open: boolean): void {
    openBtns.forEach(function (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function writeDraft(draft: TakeHomeDraft, active: HTMLElement | null): void {
    if (paycheckEl && paycheckEl !== active) setCurrencyField(paycheckEl, draft.paycheckAmount);
    if (monthlyEl && monthlyEl !== active) setCurrencyField(monthlyEl, draft.monthlyTakeHome);
    if (countEl && countEl !== active) {
      countEl.value = draft.paychecksPerMonth > 0 ? formatPaycheckCount(draft.paychecksPerMonth) : '';
    }
  }

  function currentDraft(activeSource: TakeHomeSource): TakeHomeDraft {
    return resolveTakeHome({
      paycheckAmount: readMoney(paycheckEl),
      paychecksPerMonth: readCount(countEl),
      monthlyTakeHome: readMoney(monthlyEl),
      source: activeSource,
    });
  }

  function fillFromPlan(): void {
    source = 'paycheck';
    writeDraft(draftFromPlan(PLAN), null);
    setStatus('');
  }

  function syncFrom(active: HTMLElement | null): void {
    writeDraft(currentDraft(source), active);
  }

  function openDialog(): void {
    saving = false;
    if (saveBtn) saveBtn.disabled = false;
    fillFromPlan();
    try {
      if (typeof dlg.showModal !== 'function') return;
      if (!dlg.open) dlg.showModal();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Take-home editor could not open:', err);
      }
      return;
    }
    setExpanded(true);
    paycheckEl.focus();
    paycheckEl.select();
  }

  openBtns.forEach(function (btn) {
    btn.addEventListener(
      'click',
      function () {
        openDialog();
      },
      { signal }
    );
  });

  dlg.addEventListener(
    'close',
    function () {
      setExpanded(false);
      saving = false;
      if (saveBtn) saveBtn.disabled = false;
    },
    { signal }
  );

  dlg.addEventListener(
    'click',
    function (e) {
      if (e.target === dlg) {
        dlg.close();
        return;
      }
      const t = e.target as Node | null;
      const el =
        t && t.nodeType === Node.TEXT_NODE ? (t.parentElement as HTMLElement | null) : (t as HTMLElement | null);
      if (el && typeof el.closest === 'function' && el.closest('[data-close-takehome-dialog]')) {
        dlg.close();
      }
    },
    { signal }
  );

  dlg.addEventListener(
    'input',
    function (e) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t === monthlyEl) source = 'monthly';
      else if (t === paycheckEl) source = 'paycheck';
      else if (t !== countEl) return;
      syncFrom(t);
    },
    { signal }
  );

  dlg.addEventListener(
    'blur',
    function (e) {
      const t = e.target as HTMLElement | null;
      if (t !== paycheckEl && t !== countEl && t !== monthlyEl) return;
      syncFrom(null);
    },
    { capture: true, signal }
  );

  async function save(): Promise<void> {
    if (saving) return;
    saving = true;
    if (saveBtn) saveBtn.disabled = true;
    setStatus('');
    const draft = currentDraft(source);
    writeDraft(draft, null);
    applyTakeHomePay(PLAN as FinancialPlan, draft);
    updateBufferRowAmount(PLAN as FinancialPlan);
    try {
      const ok = await savePlanOverrides();
      render({ refreshBalanceEditors: true });
      if (!ok) {
        const err = getLastPlanSaveError();
        setStatus(err ? 'Saved on this device. Sync failed: ' + err : 'Saved on this device. Sync failed.');
        return;
      }
      dlg.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save take-home pay.';
      setStatus(msg);
    } finally {
      saving = false;
      if (saveBtn && dlg.open) saveBtn.disabled = false;
    }
  }

  if (form) {
    form.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        void save();
      },
      { signal }
    );
  } else if (saveBtn) {
    saveBtn.addEventListener(
      'click',
      function () {
        void save();
      },
      { signal }
    );
  }
}
