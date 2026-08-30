/**
 * Month wrap-up: archive working month, advance workingMonthYm, one-step undo.
 *
 * Converted from `month-wrap.js` with no logic changes, then extended so wrap-up
 * can jump to the current calendar month (or a month the user picks) instead of
 * only stepping forward by one.
 */

import type { CheckInServiceApi, FinancialPlan, IsoDateTimeString, YyyyMm } from '../../types/index.js';
import {
  PLAN,
  STORAGE_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
} from './plan-data';
import { getRepositories } from '../../lib/repositories';
import { applyPlanOverrides, savePlanOverrides, isFinancialPlanDemoMode, getLastPlanSaveError } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { buildMonthCheckpointPayload } from './monthly-export';
import { getWorkingMonthYm } from './plan-derived';
import { monthLabel } from './monthly-activity';
import {
  defaultWrapDestinationYm,
  isYyyyMm,
  listWrapDestinationMonths,
  wrapDestinationOptionLabel,
} from './month-wrap-utils';

function asFinancialPlan(p: unknown): FinancialPlan {
  if (!p || typeof p !== 'object') {
    throw new Error('PLAN is missing');
  }
  const o = p as any;
  if (!o.phase1 || typeof o.phase1 !== 'object') {
    throw new Error('PLAN.phase1 is missing');
  }
  if (!Array.isArray(o.debts)) {
    throw new Error('PLAN.debts is missing');
  }
  if (!Array.isArray(o.savingsAccounts)) {
    throw new Error('PLAN.savingsAccounts is missing');
  }
  return o as FinancialPlan;
}

function getCheckInService(): CheckInServiceApi | null {
  const s = (window as any).CheckInService;
  if (!s || typeof s !== 'object') return null;
  if (typeof s.list !== 'function') return null;
  return s as CheckInServiceApi;
}

function checkinStorageKey(): string {
  const svc = getCheckInService();
  return svc && svc.STORAGE_KEY ? svc.STORAGE_KEY : 'financial-plan-v3-aggressive.checkins';
}

function loadCheckinsList(): unknown[] {
  try {
    const svc = getCheckInService();
    if (svc && typeof svc.list === 'function') {
      return svc.list();
    }
  } catch (e) {}
  return [];
}

function appendMonthArchive(checkpointObj: unknown): void {
  try {
    let arr: unknown[] = [];
    const raw = localStorage.getItem(MONTH_WRAP_ARCHIVES_KEY);
    if (raw) arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
    arr.push(checkpointObj);
    while (arr.length > 48) arr.shift();
    localStorage.setItem(MONTH_WRAP_ARCHIVES_KEY, JSON.stringify(arr));
  } catch (e) {}
}

async function appendMonthArchiveSynced(checkpointObj: unknown): Promise<void> {
  try {
    const repos = getRepositories();
    const arr = await repos.financialPlanStateRepository.getMonthWrapArchives();
    const next = Array.isArray(arr) ? arr.slice() : [];
    next.push(checkpointObj);
    while (next.length > 48) next.shift();
    await repos.financialPlanStateRepository.setMonthWrapArchives(next);
    return;
  } catch (e) {
    appendMonthArchive(checkpointObj);
  }
}

export async function hasMonthWrapRollback(): Promise<boolean> {
  try {
    const repos = getRepositories();
    const rb = await repos.financialPlanStateRepository.getMonthWrapRollback();
    if (rb) return true;
  } catch (e) {
    /* fall through to localStorage */
  }
  try {
    return !!localStorage.getItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e2) {
    return false;
  }
}

export interface MonthWrapRollbackPayload {
  version: 1;
  balancesRaw: string;
  checkinsRaw: string;
  wrappedYm: YyyyMm;
  nextWorkingYm: YyyyMm;
  createdAt: IsoDateTimeString;
}

function isMonthWrapRollbackPayload(u: unknown): u is MonthWrapRollbackPayload {
  if (!u || typeof u !== 'object') return false;
  const o = u as any;
  return (
    o.version === 1 &&
    typeof o.balancesRaw === 'string' &&
    typeof o.checkinsRaw === 'string' &&
    isYyyyMm(o.wrappedYm) &&
    isYyyyMm(o.nextWorkingYm) &&
    typeof o.createdAt === 'string'
  );
}

function persistRollbackLocal(rollback: MonthWrapRollbackPayload): boolean {
  try {
    localStorage.setItem(MONTH_WRAP_ROLLBACK_KEY, JSON.stringify(rollback));
    return true;
  } catch (e) {
    return false;
  }
}

async function persistRollbackRemote(rollback: MonthWrapRollbackPayload): Promise<void> {
  const repos = getRepositories();
  await repos.financialPlanStateRepository.setMonthWrapRollback(rollback as any);
}

/**
 * Native wrap-up dialog: pick the month to start tracking next.
 * Falls back to `window.confirm` when the dialog markup is missing.
 */
function promptWrapDestination(wrappedYm: YyyyMm, defaultYm: YyyyMm): Promise<YyyyMm | null> {
  const dlg = document.getElementById('month-wrap-dialog') as HTMLDialogElement | null;
  const sel = document.getElementById('month-wrap-destination') as HTMLSelectElement | null;
  const title = document.getElementById('month-wrap-dialog-title');
  const hint = document.getElementById('month-wrap-dialog-hint');
  const now = new Date();
  const options = listWrapDestinationMonths(wrappedYm, now);
  const dest = options.indexOf(defaultYm) >= 0 ? defaultYm : options[0] || defaultYm;

  if (!dlg || typeof dlg.showModal !== 'function' || !sel) {
    const ok = window.confirm(
      'Wrap up ' +
        monthLabel(wrappedYm) +
        '?\n\n' +
        '• A saved snapshot for ' +
        wrappedYm +
        ' is stored on your account when signed in (otherwise in this browser).\n' +
        '• “This month” debt progress will move to ' +
        monthLabel(dest) +
        ' (payments in that month count toward the bar).\n' +
        '• You can undo once if this was a mistake.'
    );
    return Promise.resolve(ok ? dest : null);
  }

  const dialogEl: HTMLDialogElement = dlg;
  const selectEl: HTMLSelectElement = sel;

  if (title) title.textContent = 'Wrap up ' + monthLabel(wrappedYm) + '?';
  if (hint) {
    hint.textContent =
      'A snapshot of ' +
      monthLabel(wrappedYm) +
      ' is stored on your account when signed in (otherwise in this browser). Then the working month and monthly bar move to the month you pick. You can undo once if this was a mistake.';
  }

  selectEl.innerHTML = '';
  options.forEach(function (ym) {
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = wrapDestinationOptionLabel(ym, now);
    selectEl.appendChild(opt);
  });
  selectEl.value = dest;

  return new Promise(function (resolve) {
    let settled = false;
    function finish(value: YyyyMm | null): void {
      if (settled) return;
      settled = true;
      dialogEl.removeEventListener('close', onClose);
      confirmBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      if (dialogEl.open) dialogEl.close();
      resolve(value);
    }
    function onConfirm(ev: Event): void {
      ev.preventDefault();
      const v = selectEl.value;
      finish(isYyyyMm(v) && v > wrappedYm ? v : dest);
    }
    function onCancel(ev: Event): void {
      ev.preventDefault();
      finish(null);
    }
    function onClose(): void {
      finish(null);
    }
    const confirmBtn = document.getElementById('btn-month-wrap-confirm');
    const cancelBtn = document.getElementById('btn-month-wrap-cancel');
    const closeBtn = document.getElementById('btn-month-wrap-dialog-close');
    confirmBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    dialogEl.addEventListener('close', onClose);
    try {
      dialogEl.showModal();
    } catch (e) {
      const ok = window.confirm(
        'Wrap up ' + monthLabel(wrappedYm) + ' and start tracking ' + monthLabel(dest) + '?'
      );
      finish(ok ? dest : null);
    }
  });
}

let wrapInFlight = false;

/**
 * @param render Optional re-render callback
 */
export async function wrapUpWorkingMonth(render?: () => void): Promise<void> {
  if (wrapInFlight) return;
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before wrapping up a month.');
    return;
  }

  const plan = asFinancialPlan(PLAN);
  syncLegacySavingsFromAccounts(plan);
  const ym = getWorkingMonthYm(plan) as YyyyMm;
  const suggested = defaultWrapDestinationYm(ym);
  const nextYm = await promptWrapDestination(ym, suggested);
  if (!nextYm) return;

  wrapInFlight = true;
  const wrapBtn = document.getElementById('btn-month-wrap-up') as HTMLButtonElement | null;
  if (wrapBtn) wrapBtn.disabled = true;

  try {
    const checkins = loadCheckinsList();
    const checkpoint = buildMonthCheckpointPayload(PLAN, checkins, ym);
    if (!checkpoint) {
      window.alert('Could not build a month snapshot. Save your plan and try again.');
      return;
    }

    let balancesRaw = '';
    let checkinsRaw = '[]';
    try {
      balancesRaw = localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {}
    try {
      checkinsRaw = localStorage.getItem(checkinStorageKey()) || '[]';
    } catch (e) {}

    const rollback: MonthWrapRollbackPayload = {
      version: 1,
      balancesRaw: balancesRaw,
      checkinsRaw: checkinsRaw,
      wrappedYm: ym,
      nextWorkingYm: nextYm,
      createdAt: new Date().toISOString(),
    };
    if (!persistRollbackLocal(rollback)) {
      window.alert('Could not save undo data. Month wrap cancelled.');
      return;
    }

    PLAN.workingMonthYm = nextYm;
    PLAN.dashboardViewMonthYm = '';
    if (typeof render === 'function') (render as (o?: { refreshBalanceEditors?: boolean }) => void)({ refreshBalanceEditors: true });

    await persistRollbackRemote(rollback).catch(function () {
      /* local undo snapshot already saved */
    });
    await Promise.all([appendMonthArchiveSynced(checkpoint), savePlanOverrides()]);
    syncLegacySavingsFromAccounts(plan);
    if (typeof render === 'function') (render as (o?: { refreshBalanceEditors?: boolean }) => void)({ refreshBalanceEditors: true });
    const saveErr = getLastPlanSaveError();
    if (saveErr) {
      window.alert(
        'The working month is now ' +
          monthLabel(nextYm) +
          ' in this browser, but saving to your account failed. Stay on this page and try again in a moment if the month reverts after a refresh.\n\n' +
          saveErr
      );
    }
  } finally {
    wrapInFlight = false;
    if (wrapBtn) wrapBtn.disabled = false;
  }
}

/**
 * @param render Optional re-render callback
 */
export async function undoLastMonthWrap(render?: () => void): Promise<void> {
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before undoing.');
    return;
  }
  try {
    const repos = getRepositories();
    const rb = await repos.financialPlanStateRepository.getMonthWrapRollback();
    if (rb) {
      const parsed = rb as unknown;
      if (!isMonthWrapRollbackPayload(parsed)) return;
      const rollback = parsed as MonthWrapRollbackPayload;

      const ok = window.confirm(
        'Undo the last month wrap?\n\n' +
          'Your saved plan and check-ins will be restored to how they were before wrapping up ' +
          (rollback.wrappedYm || 'that month') +
          '.'
      );
      if (!ok) return;

      try {
        localStorage.setItem(STORAGE_KEY, rollback.balancesRaw);
        localStorage.setItem(
          checkinStorageKey(),
          typeof rollback.checkinsRaw === 'string' ? rollback.checkinsRaw : '[]'
        );
      } catch (e) {
        window.alert('Could not restore saved data.');
        return;
      }

      try {
        await repos.financialPlanStateRepository.clearMonthWrapRollback();
      } catch (e) {}

      await applyPlanOverrides();
      const plan = asFinancialPlan(PLAN);
      syncLegacySavingsFromAccounts(plan);
      if (typeof render === 'function') (render as (o?: { refreshBalanceEditors?: boolean }) => void)({ refreshBalanceEditors: true });
      return;
    }
  } catch (e) {
    // fall through to legacy localStorage
  }

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {}
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!isMonthWrapRollbackPayload(parsed)) return;
  const rb: MonthWrapRollbackPayload = parsed;

  const ok = window.confirm(
    'Undo the last month wrap?\n\n' +
      'Your saved plan and check-ins will be restored to how they were before wrapping up ' +
      (rb.wrappedYm || 'that month') +
      '.'
  );
  if (!ok) return;

  try {
    localStorage.setItem(STORAGE_KEY, rb.balancesRaw);
    localStorage.setItem(
      checkinStorageKey(),
      typeof rb.checkinsRaw === 'string' ? rb.checkinsRaw : '[]'
    );
  } catch (e) {
    window.alert('Could not restore saved data.');
    return;
  }
  try {
    localStorage.removeItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {}

  await applyPlanOverrides();
  const plan = asFinancialPlan(PLAN);
  syncLegacySavingsFromAccounts(plan);
  if (typeof render === 'function') (render as (o?: { refreshBalanceEditors?: boolean }) => void)({ refreshBalanceEditors: true });
}

let dashboardMonthSelectWired = false;
let monthWrapWired = false;

/**
 * Month dropdown: persist `dashboardViewMonthYm` and re-render (default log dates follow selection).
 * @param render
 */
export function wireDashboardMonthSelector(render: (opts?: { refreshBalanceEditors?: boolean }) => void): void {
  const sel = document.getElementById('dashboard-view-month') as HTMLSelectElement | null;
  if (!sel || dashboardMonthSelectWired) return;
  dashboardMonthSelectWired = true;
  sel.addEventListener('change', function () {
    const v = sel.value;
    PLAN.dashboardViewMonthYm = v === '' ? '' : (v as any);
    void savePlanOverrides();
    if (typeof render === 'function') (render as (o?: { refreshBalanceEditors?: boolean }) => void)({ refreshBalanceEditors: true });
  });
}

export function wireMonthWrap(render: (opts?: { refreshBalanceEditors?: boolean }) => void): void {
  const wrapBtn = document.getElementById('btn-month-wrap-up') as HTMLButtonElement | null;
  const undoBtn = document.getElementById('btn-month-wrap-undo') as HTMLButtonElement | null;

  function refreshUndo(): void {
    if (!undoBtn) return;
    void hasMonthWrapRollback().then(function (has) {
      undoBtn.disabled = !has;
    });
  }

  if (monthWrapWired) {
    refreshUndo();
    return;
  }
  monthWrapWired = true;

  if (wrapBtn) {
    wrapBtn.addEventListener('click', function () {
      void wrapUpWorkingMonth(function () {
        render({ refreshBalanceEditors: true });
        refreshUndo();
      });
    });
  }
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      void undoLastMonthWrap(function () {
        render({ refreshBalanceEditors: true });
        refreshUndo();
      });
    });
  }
  refreshUndo();
}
