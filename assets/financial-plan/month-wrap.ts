/**
 * Month wrap-up: archive working month, advance workingMonthYm, one-step undo.
 *
 * Converted from `month-wrap.js` with no logic changes.
 */

import type { CheckInServiceApi, FinancialPlan, IsoDateTimeString, YyyyMm } from '../../types/index.js';
import {
  PLAN,
  STORAGE_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
} from './plan-data';
import { applyPlanOverrides, savePlanOverrides, isFinancialPlanDemoMode } from './persistence';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { buildMonthCheckpointPayload } from './monthly-export';
import { getWorkingMonthYm } from './plan-derived';
import { monthLabel, yyyyMmFromDate } from './monthly-activity';

function isYyyyMm(s: unknown): s is YyyyMm {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

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

/** @param ym YYYY-MM */
function nextYyyyYm(ym: string): YyyyMm {
  const p = String(ym).split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return yyyyMmFromDate(new Date()) as YyyyMm;
  }
  const d = new Date(y, m, 1);
  return yyyyMmFromDate(d) as YyyyMm;
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

export function hasMonthWrapRollback(): boolean {
  try {
    return !!localStorage.getItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {
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

/**
 * @param render Optional re-render callback
 */
export function wrapUpWorkingMonth(render?: () => void): void {
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before wrapping up a month.');
    return;
  }
  applyPlanOverrides();
  const plan = asFinancialPlan(PLAN);
  syncLegacySavingsFromAccounts(plan);
  const ym = getWorkingMonthYm(plan) as YyyyMm;
  const nextYm = nextYyyyYm(ym);
  const ok = window.confirm(
    'Wrap up ' +
      monthLabel(ym) +
      '?\n\n' +
      '• A saved snapshot for ' +
      ym +
      ' is stored in this browser (month-wrap archives).\n' +
      '• “This month” debt progress will move to ' +
      monthLabel(nextYm) +
      ' (payments in that month count toward the bar).\n' +
      '• You can undo once if this was a mistake.'
  );
  if (!ok) return;

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
  try {
    localStorage.setItem(MONTH_WRAP_ROLLBACK_KEY, JSON.stringify(rollback));
  } catch (e) {
    window.alert('Could not save undo data. Month wrap cancelled.');
    return;
  }

  appendMonthArchive(checkpoint);
  PLAN.workingMonthYm = nextYm;
  PLAN.dashboardViewMonthYm = '';
  savePlanOverrides();
  syncLegacySavingsFromAccounts(plan);
  if (typeof render === 'function') render();
}

/**
 * @param render Optional re-render callback
 */
export function undoLastMonthWrap(render?: () => void): void {
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before undoing.');
    return;
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

  applyPlanOverrides();
  const plan = asFinancialPlan(PLAN);
  syncLegacySavingsFromAccounts(plan);
  if (typeof render === 'function') render();
}

let dashboardMonthSelectWired = false;

/**
 * Month dropdown: persist `dashboardViewMonthYm` and re-render (default log dates follow selection).
 * @param render
 */
export function wireDashboardMonthSelector(render: () => void): void {
  const sel = document.getElementById('dashboard-view-month') as HTMLSelectElement | null;
  if (!sel || dashboardMonthSelectWired) return;
  dashboardMonthSelectWired = true;
  sel.addEventListener('change', function () {
    const v = sel.value;
    PLAN.dashboardViewMonthYm = v === '' ? '' : (v as any);
    savePlanOverrides();
    if (typeof render === 'function') render();
  });
}

export function wireMonthWrap(render: () => void): void {
  const wrapBtn = document.getElementById('btn-month-wrap-up') as HTMLButtonElement | null;
  const undoBtn = document.getElementById('btn-month-wrap-undo') as HTMLButtonElement | null;

  function refreshUndo(): void {
    if (undoBtn) undoBtn.disabled = !hasMonthWrapRollback();
  }

  if (wrapBtn) {
    wrapBtn.addEventListener('click', function () {
      wrapUpWorkingMonth(function () {
        render();
        refreshUndo();
      });
    });
  }
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      undoLastMonthWrap(function () {
        render();
        refreshUndo();
      });
    });
  }
  refreshUndo();
}

