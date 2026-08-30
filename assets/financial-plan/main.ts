/**
 * Financial Plan page entry: restore persisted plan data, render UI, wire editors and ancillary features.
 *
 * Script order in `financial-plan-v3-aggressive.html` (all `defer` unless noted):
 * `theme-service.ts` → `site-settings.ts` → `payoff-projection.js` (module) → `checkin-service.ts` → `badges.ts` → this module.
 */

import { PLAN } from './plan-data';
import { render as renderPlanPage, type PlanPageRenderOptions } from './render-page';
import { wireAiPayoffPlan } from './ai-payoff-plan-wire';
import { wireBillPaymentCalendar } from './ai-bill-calendar-wire';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { applyPlanOverrides, isFinancialPlanDemoMode } from './persistence';
import {
  initEditorSnapshots,
  wireGoal2DebtEditor,
  wireGoal3SavingsEditor,
  wireGoalEditorDialogs,
  wireDashboardTrashBin,
} from './goal-editors-wire';
import { wirePlanTabs } from './tabs-wire';
import { wireGoalTargetsEditor } from './goal-targets-wire';
import { wireCheckIns, renderCheckIns } from './checkin-log';
import { wireBadges, renderBadges } from './features.js';
import { applyDemoPlanSnapshot, buildMockCheckins } from './dev-mock-storage';
import { wipeAllUserData } from './wipe-user-data';
import { withAppBusy } from './app-busy';
import { wireMonthWrap, wireDashboardMonthSelector } from './month-wrap';
import { wireBudgetBreakdown } from './budget-breakdown-wire';
import { resetBudgetBreakdownEditMode } from './budget-breakdown-state';
import { getTrialSeed, isTrialSessionActive } from '../../lib/trial/trial-session';

const aiPayoffUi = wireAiPayoffPlan(PLAN);
const billCalUi = wireBillPaymentCalendar(PLAN);

function render(opts?: PlanPageRenderOptions): void {
  renderPlanPage(opts);
  if (aiPayoffUi && aiPayoffUi.refreshAfterPlanChange) {
    aiPayoffUi.refreshAfterPlanChange();
  }
  if (billCalUi && billCalUi.refreshAfterPlanChange) {
    billCalUi.refreshAfterPlanChange();
  }
}

/** Preserve real list() when toggling sample-data mode or after reset. */
let origCheckInList: null | (() => any[]) = null;

function isDeveloperUnlocked(): boolean {
  try {
    return localStorage.getItem('pennypath.developer.unlocked') === '1';
  } catch (e) {
    return false;
  }
}

function syncFinancialPlanDemoBanner(): void {
  const el = document.getElementById('financial-plan-demo-banner');
  // Only show the sample-data banner when developer mode is unlocked (where the toggle exists).
  // Trial / "Take a peek" uses demo mode too, but should not show dev-only instructions.
  if (el) el.hidden = !(isFinancialPlanDemoMode() && isDeveloperUnlocked());
}

function patchCheckInsForDemoMode(): void {
  const svc = (window as any).CheckInService as any;
  if (!svc) return;
  if (!origCheckInList && typeof svc.list === 'function') {
    origCheckInList = svc.list.bind(svc);
  }
  if (!origCheckInList) return;
  if (isFinancialPlanDemoMode()) {
    svc.list = function () {
      const seed = isTrialSessionActive() ? getTrialSeed() : null;
      return buildMockCheckins(seed);
    };
  } else {
    svc.list = origCheckInList;
  }
}

async function loadPlanForMode(): Promise<void> {
  if (isFinancialPlanDemoMode()) {
    const seed = isTrialSessionActive() ? getTrialSeed() : null;
    applyDemoPlanSnapshot(PLAN, { seed });
  } else {
    await applyPlanOverrides();
  }
  syncLegacySavingsFromAccounts(PLAN);
}

/**
 * Goals at a glance: avoid native <details> so grid height transitions can run (closed slot is display:none).
 */
function wireDashboardGoalsAtGlance(): void {
  const root = document.getElementById('dashboard-goals-at-glance');
  const btn = document.getElementById('dashboard-goals-toggle');
  if (!root || !btn) return;
  const panel = document.getElementById('dashboard-goals-panel');
  function syncOpenStateToAria(): void {
    if (!root || !btn) return;
    const open = root.classList.contains('dashboard-goals-details--open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  syncOpenStateToAria();
  btn.addEventListener('click', function () {
    root.classList.toggle('dashboard-goals-details--open');
    syncOpenStateToAria();
  });
}

let wipeAllButtonWired = false;

function wireWipeAllButton(): void {
  const btn = document.getElementById('btn-wipe-all-data') as HTMLButtonElement | null;
  if (!btn) return;
  if (wipeAllButtonWired) return;
  wipeAllButtonWired = true;
  btn.addEventListener('click', function () {
    const ok = window.confirm(
      'Reset everything for this Financial Plan?\n\n' +
        'This permanently removes all debts (including Recently deleted), savings accounts, goals, budget amounts, payment and deposit logs, check-ins, wrap-up history, AI caches, and milestone (badge) progress. Your theme choice is kept. This cannot be undone.\n\n' +
        'Real Estate data is not affected.'
    );
    if (!ok) return;
    btn.disabled = true;
    void (async function () {
      try {
        await withAppBusy('Resetting…', async function () {
          await wipeAllUserData();
          document.body.classList.remove('financial-plan-demo-mode');
          const svc = (window as any).CheckInService as any;
          if (origCheckInList && svc) {
            svc.list = origCheckInList;
          }
          resetBudgetBreakdownEditMode();
          syncLegacySavingsFromAccounts(PLAN);
          render({
            refreshBalanceEditors: true,
            refreshGoal2DebtsCards: true,
            refreshGoal3SavingsCards: true,
          });
          initEditorSnapshots();
          renderCheckIns();
          void renderBadges();
        });
      } finally {
        btn.disabled = false;
      }
    })();
  });
}

async function init(): Promise<void> {
  resetBudgetBreakdownEditMode();
  if (isFinancialPlanDemoMode()) {
    document.body.classList.add('financial-plan-demo-mode');
  }
  patchCheckInsForDemoMode();
  await loadPlanForMode();
  syncFinancialPlanDemoBanner();
  render();
  initEditorSnapshots();
  wireGoal2DebtEditor(render);
  wireGoal3SavingsEditor(render);
  wireDashboardTrashBin(render);
  wireGoalEditorDialogs();
  wirePlanTabs();
  wireGoalTargetsEditor(render);
  wireCheckIns();
  wireBadges();
  void renderBadges();
  wireWipeAllButton();
  wireMonthWrap(render);
  wireDashboardMonthSelector(render);
  wireDashboardGoalsAtGlance();
  wireBudgetBreakdown(render);
}

/**
 * Next.js loads this module once per document and caches it. Client navigations back to
 * `/dashboard` must call this explicitly — the module top-level does not run again.
 */
export async function bootFinancialPlanPage(): Promise<void> {
  await init();
}
