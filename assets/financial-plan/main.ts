/**
 * Financial Plan page entry: restore persisted plan data, render UI, wire editors and ancillary features.
 *
 * Script order in `financial-plan-v3-aggressive.html` (all `defer` unless noted):
 * `theme-service.ts` → `site-settings.ts` → `payoff-projection.js` (module) → `checkin-service.ts` → `badges.ts` → this module.
 */

import { PLAN } from './plan-data';
import { render as renderPlanPage } from './render-page';
import { wireAiPayoffPlan } from './ai-payoff-plan-wire';
import { wireBillPaymentCalendar } from './ai-bill-calendar-wire';
import { syncLegacySavingsFromAccounts } from './savings-accounts';
import { applyPlanOverrides, isFinancialPlanDemoMode } from './persistence';
import {
  initEditorSnapshots,
  wireGoal2DebtEditor,
  wireGoal3SavingsEditor,
} from './goal-editors-wire';
import { wirePlanTabs } from './tabs-wire';
import { wireGoalTargetsEditor } from './goal-targets-wire';
import { wireCheckIns } from './checkin-log';
import { wireBadges, renderBadges } from './features.js';
import { applyDemoPlanSnapshot, buildMockCheckins } from './dev-mock-storage';
import { wipeAllUserData } from './wipe-user-data.js';
import { wireMonthWrap, wireDashboardMonthSelector } from './month-wrap';
import { getTrialSeed, isTrialSessionActive } from '../../lib/trial/trial-session';

const aiPayoffUi = wireAiPayoffPlan(PLAN);
const billCalUi = wireBillPaymentCalendar(PLAN);

function render(opts?: { skipDebtsEditor?: boolean }): void {
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
  btn.addEventListener('click', function () {
    const open = root.classList.toggle('dashboard-goals-details--open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
  if (panel) panel.setAttribute('aria-hidden', 'false');
}

function wireWipeAllButton(): void {
  const btn = document.getElementById('btn-wipe-all-data') as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener('click', function () {
    const ok = window.confirm(
      'Reset everything for this Financial Plan?\n\n' +
        'This removes all saved balances, debts, savings accounts, payment/deposit logs, check-ins, and milestone (badge) progress in this browser. Your theme choice is kept. This cannot be undone.\n\n' +
        'Real Estate data is not affected.'
    );
    if (!ok) return;
    wipeAllUserData();
    document.body.classList.remove('financial-plan-demo-mode');
    const svc = (window as any).CheckInService as any;
    if (origCheckInList && svc) {
      svc.list = origCheckInList;
    }
    void applyPlanOverrides();
    syncLegacySavingsFromAccounts(PLAN);
    render();
    initEditorSnapshots();
    renderBadges();
  });
}

async function init(): Promise<void> {
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
  wirePlanTabs();
  wireGoalTargetsEditor(render);
  wireCheckIns();
  wireBadges();
  renderBadges();
  wireWipeAllButton();
  wireMonthWrap(render);
  wireDashboardMonthSelector(render);
  wireDashboardGoalsAtGlance();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    void init();
  });
} else {
  void init();
}
