/**
 * Internal tabs for `financial-plan-v3-aggressive.html`.
 * - Top-level: Financial Plan vs Dashboard
 * - Dashboard: Debts vs Savings
 */

function setSelected(tabEl: HTMLElement | null, selected: boolean): void {
  if (!tabEl) return;
  tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
  tabEl.tabIndex = selected ? 0 : -1;
}

function setPanelVisible(panelEl: HTMLElement | null, visible: boolean): void {
  if (!panelEl) return;
  panelEl.hidden = !visible;
}

function activatePair(tabs: { tabA: HTMLElement; tabB: HTMLElement; panelA: HTMLElement; panelB: HTMLElement }): void {
  const { tabA, tabB, panelA, panelB } = tabs;
  setSelected(tabA, true);
  setSelected(tabB, false);
  setPanelVisible(panelA, true);
  setPanelVisible(panelB, false);
}

function activatePairB(tabs: { tabA: HTMLElement; tabB: HTMLElement; panelA: HTMLElement; panelB: HTMLElement }): void {
  const { tabA, tabB, panelA, panelB } = tabs;
  setSelected(tabA, false);
  setSelected(tabB, true);
  setPanelVisible(panelA, false);
  setPanelVisible(panelB, true);
}

export function wirePlanTabs(): void {
  const tabPlan = document.getElementById('tab-plan') as HTMLElement | null;
  const tabDash = document.getElementById('tab-dashboard') as HTMLElement | null;
  const panelPlan = document.getElementById('panel-plan') as HTMLElement | null;
  const panelDash = document.getElementById('panel-dashboard') as HTMLElement | null;

  const tabDebts = document.getElementById('tab-dashboard-debts') as HTMLElement | null;
  const tabSavings = document.getElementById('tab-dashboard-savings') as HTMLElement | null;
  const panelDebts = document.getElementById('panel-dashboard-debts') as HTMLElement | null;
  const panelSavings = document.getElementById('panel-dashboard-savings') as HTMLElement | null;

  if (!tabPlan || !tabDash || !panelPlan || !panelDash) return;

  const top = { tabA: tabPlan, tabB: tabDash, panelA: panelPlan, panelB: panelDash };
  const dash =
    tabDebts && tabSavings && panelDebts && panelSavings
      ? { tabA: tabDebts, tabB: tabSavings, panelA: panelDebts, panelB: panelSavings }
      : null;

  function activateDash(which: string, opts?: { updateHash?: boolean }): void {
    const w = which === 'savings' ? 'savings' : 'debts';
    if (!dash) return;
    if (w === 'savings') activatePairB(dash);
    else activatePair(dash);
    if (panelDash) panelDash.dataset.dashboardView = w;
    if (opts && opts.updateHash) {
      try {
        history.replaceState(null, '', w === 'savings' ? '#dashboard/savings' : '#dashboard/debts');
      } catch (e) {}
    }
  }

  // Default state (in case markup changes later).
  activatePair(top);
  if (dash) {
    activateDash('debts', { updateHash: false });
  }

  tabPlan.addEventListener('click', function () {
    activatePair(top);
    try {
      history.replaceState(null, '', '#plan');
    } catch (e) {}
  });
  tabDash.addEventListener('click', function () {
    activatePairB(top);
    try {
      history.replaceState(null, '', '#dashboard');
    } catch (e) {}
  });

  if (dash) {
    const tabDebtsEl = dash.tabA;
    const tabSavingsEl = dash.tabB;
    tabDebtsEl.addEventListener('click', function () {
      activateDash('debts', { updateHash: true });
    });
    tabSavingsEl.addEventListener('click', function () {
      activateDash('savings', { updateHash: true });
    });
  }

  // Buttons with data-open-dashboard (goal cards, plan hints) open Dashboard + subtab.
  const openDashBtns = document.querySelectorAll('[data-open-dashboard]');
  if (openDashBtns && openDashBtns.length) {
    openDashBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activatePairB(top);
        const which = (btn as HTMLElement).getAttribute('data-open-dashboard');
        activateDash(which === 'savings' ? 'savings' : 'debts', { updateHash: true });
      });
    });
  }

  // Deep links via hash.
  try {
    const h = String(location.hash || '');
    if (h.startsWith('#dashboard')) {
      activatePairB(top);
      if (h.indexOf('/savings') !== -1) activateDash('savings');
      else activateDash('debts');
    }
  } catch (e) {}
}
