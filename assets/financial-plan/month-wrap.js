/**
 * Month wrap-up: archive working month, advance workingMonthYm, one-step undo.
 */

import {
  PLAN,
  STORAGE_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
} from './plan-data.js';
import {
  applyPlanOverrides,
  savePlanOverrides,
  isFinancialPlanDemoMode,
} from './persistence.js';
import { syncLegacySavingsFromAccounts } from './savings-accounts.js';
import { buildMonthCheckpointPayload } from './monthly-export.js';
import { getWorkingMonthYm } from './plan-derived.js';
import { monthLabel, yyyyMmFromDate } from './monthly-activity.js';

function checkinStorageKey() {
  return window.CheckInService && window.CheckInService.STORAGE_KEY
    ? window.CheckInService.STORAGE_KEY
    : 'financial-plan-v3-aggressive.checkins';
}

function loadCheckinsList() {
  try {
    if (window.CheckInService && typeof window.CheckInService.list === 'function') {
      return window.CheckInService.list();
    }
  } catch (e) {}
  return [];
}

/** @param {string} ym YYYY-MM */
function nextYyyyYm(ym) {
  const p = String(ym).split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return yyyyMmFromDate(new Date());
  }
  const d = new Date(y, m, 1);
  return yyyyMmFromDate(d);
}

function appendMonthArchive(checkpointObj) {
  try {
    let arr = [];
    const raw = localStorage.getItem(MONTH_WRAP_ARCHIVES_KEY);
    if (raw) arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
    arr.push(checkpointObj);
    while (arr.length > 48) arr.shift();
    localStorage.setItem(MONTH_WRAP_ARCHIVES_KEY, JSON.stringify(arr));
  } catch (e) {}
}

export function hasMonthWrapRollback() {
  try {
    return !!localStorage.getItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {
    return false;
  }
}

/**
 * @param {() => void} [render]
 */
export function wrapUpWorkingMonth(render) {
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before wrapping up a month.');
    return;
  }
  applyPlanOverrides();
  syncLegacySavingsFromAccounts(PLAN);
  const ym = getWorkingMonthYm(PLAN);
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

  const rollback = {
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
  syncLegacySavingsFromAccounts(PLAN);
  if (typeof render === 'function') render();
}

/**
 * @param {() => void} [render]
 */
export function undoLastMonthWrap(render) {
  if (isFinancialPlanDemoMode()) {
    window.alert('Turn off sample data in Settings before undoing.');
    return;
  }
  let raw = null;
  try {
    raw = localStorage.getItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {}
  if (!raw) return;
  let rb;
  try {
    rb = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!rb || typeof rb.balancesRaw !== 'string') return;

  const ok = window.confirm(
    'Undo the last month wrap?\n\n' +
      'Your saved plan and check-ins will be restored to how they were before wrapping up ' +
      (rb.wrappedYm || 'that month') +
      '.'
  );
  if (!ok) return;

  try {
    localStorage.setItem(STORAGE_KEY, rb.balancesRaw);
    localStorage.setItem(checkinStorageKey(), typeof rb.checkinsRaw === 'string' ? rb.checkinsRaw : '[]');
  } catch (e) {
    window.alert('Could not restore saved data.');
    return;
  }
  try {
    localStorage.removeItem(MONTH_WRAP_ROLLBACK_KEY);
  } catch (e) {}

  applyPlanOverrides();
  syncLegacySavingsFromAccounts(PLAN);
  if (typeof render === 'function') render();
}

/**
 * @param {() => void} render
 */
let dashboardMonthSelectWired = false;

/**
 * Month dropdown: persist `dashboardViewMonthYm` and re-render (default log dates follow selection).
 * @param {() => void} render
 */
export function wireDashboardMonthSelector(render) {
  const sel = document.getElementById('dashboard-view-month');
  if (!sel || dashboardMonthSelectWired) return;
  dashboardMonthSelectWired = true;
  sel.addEventListener('change', function () {
    const v = sel.value;
    PLAN.dashboardViewMonthYm = v === '' ? '' : v;
    savePlanOverrides();
    if (typeof render === 'function') render();
  });
}

export function wireMonthWrap(render) {
  const wrapBtn = document.getElementById('btn-month-wrap-up');
  const undoBtn = document.getElementById('btn-month-wrap-undo');

  function refreshUndo() {
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
