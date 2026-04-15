/**
 * Internal tabs for `financial-plan-v3-aggressive.html`.
 * - Top-level: Financial Plan vs Dashboard
 * - Dashboard: Debts vs Savings
 */

function setSelected(tabEl, selected) {
  if (!tabEl) return;
  tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
  tabEl.tabIndex = selected ? 0 : -1;
}

function setPanelVisible(panelEl, visible) {
  if (!panelEl) return;
  panelEl.hidden = !visible;
}

function activatePair(tabs) {
  const { tabA, tabB, panelA, panelB } = tabs;
  setSelected(tabA, true);
  setSelected(tabB, false);
  setPanelVisible(panelA, true);
  setPanelVisible(panelB, false);
}

function activatePairB(tabs) {
  const { tabA, tabB, panelA, panelB } = tabs;
  setSelected(tabA, false);
  setSelected(tabB, true);
  setPanelVisible(panelA, false);
  setPanelVisible(panelB, true);
}

export function wirePlanTabs() {
  const tabPlan = document.getElementById('tab-plan');
  const tabDash = document.getElementById('tab-dashboard');
  const panelPlan = document.getElementById('panel-plan');
  const panelDash = document.getElementById('panel-dashboard');

  const tabDebts = document.getElementById('tab-dashboard-debts');
  const tabSavings = document.getElementById('tab-dashboard-savings');
  const panelDebts = document.getElementById('panel-dashboard-debts');
  const panelSavings = document.getElementById('panel-dashboard-savings');

  if (!tabPlan || !tabDash || !panelPlan || !panelDash) return;

  const top = { tabA: tabPlan, tabB: tabDash, panelA: panelPlan, panelB: panelDash };
  const dash = { tabA: tabDebts, tabB: tabSavings, panelA: panelDebts, panelB: panelSavings };

  // Default state (in case markup changes later).
  activatePair(top);
  if (tabDebts && tabSavings && panelDebts && panelSavings) {
    activatePair(dash);
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

  if (tabDebts && tabSavings && panelDebts && panelSavings) {
    tabDebts.addEventListener('click', function () {
      activatePair(dash);
      try {
        history.replaceState(null, '', '#dashboard/debts');
      } catch (e) {}
    });
    tabSavings.addEventListener('click', function () {
      activatePairB(dash);
      try {
        history.replaceState(null, '', '#dashboard/savings');
      } catch (e) {}
    });
  }

  // Buttons on Goal 2/3 now mean “open Dashboard”.
  const openDashBtns = document.querySelectorAll('[data-open-dashboard]');
  if (openDashBtns && openDashBtns.length) {
    openDashBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activatePairB(top);
        const which = btn.getAttribute('data-open-dashboard');
        if (!tabDebts || !tabSavings || !panelDebts || !panelSavings) return;
        if (which === 'savings') activatePairB(dash);
        else activatePair(dash);
        try {
          const hash = which === 'savings' ? '#dashboard/savings' : '#dashboard/debts';
          history.replaceState(null, '', hash);
        } catch (e) {}
      });
    });
  }

  // Deep links via hash.
  try {
    const h = String(location.hash || '');
    if (h.startsWith('#dashboard')) {
      activatePairB(top);
      if (h.indexOf('/savings') !== -1 && tabDebts && tabSavings && panelDebts && panelSavings) {
        activatePairB(dash);
      }
    }
  } catch (e) {}
}

