/**
 * Financial Plan page entry: restore persisted plan data, render UI, wire editors and ancillary features.
 *
 * Script order in `financial-plan-v3-aggressive.html` (all `defer` unless noted):
 * `theme-service.js` → `site-settings.js` → `payoff-projection.js` (module) → `checkin-service.js` → `badges.js` → this module.
 */

import { PLAN } from './plan-data.js';
import { render } from './render-page.js';
import { syncLegacySavingsFromAccounts } from './savings-accounts.js';
import {
  applyPlanOverrides,
  isFinancialPlanDemoMode,
} from './persistence.js';
import {
  initEditorSnapshots,
  wireGoal2DebtEditor,
  wireGoal3SavingsEditor,
} from './goal-editors-wire.js';
import { wirePlanTabs } from './tabs-wire.js';
import { wireGoalTargetsEditor } from './goal-targets-wire.js';
import { wireCheckIns } from './checkin-log.js';
import { wireBadges, renderBadges } from './features.js';
import { applyDemoPlanSnapshot, buildMockCheckins } from './dev-mock-storage.js';
import { wipeAllUserData } from './wipe-user-data.js';

/** Preserve real list() when toggling sample-data mode or after reset. */
let origCheckInList = null;

function syncFinancialPlanDemoBanner() {
  const el = document.getElementById('financial-plan-demo-banner');
  if (el) el.hidden = !isFinancialPlanDemoMode();
}

function patchCheckInsForDemoMode() {
  if (!window.CheckInService) return;
  if (!origCheckInList && window.CheckInService.list) {
    origCheckInList = window.CheckInService.list.bind(window.CheckInService);
  }
  if (!origCheckInList) return;
  if (isFinancialPlanDemoMode()) {
    window.CheckInService.list = function () {
      return buildMockCheckins();
    };
  } else {
    window.CheckInService.list = origCheckInList;
  }
}

function loadPlanForMode() {
  if (isFinancialPlanDemoMode()) {
    applyDemoPlanSnapshot(PLAN);
  } else {
    applyPlanOverrides();
  }
  syncLegacySavingsFromAccounts(PLAN);
}

function wireWipeAllButton() {
  const btn = document.getElementById('btn-wipe-all-data');
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
    if (origCheckInList && window.CheckInService) {
      window.CheckInService.list = origCheckInList;
    }
    applyPlanOverrides();
    syncLegacySavingsFromAccounts(PLAN);
    render();
    initEditorSnapshots();
    renderBadges();
  });
}

function init() {
  if (isFinancialPlanDemoMode()) {
    document.body.classList.add('financial-plan-demo-mode');
  }
  patchCheckInsForDemoMode();
  loadPlanForMode();
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
