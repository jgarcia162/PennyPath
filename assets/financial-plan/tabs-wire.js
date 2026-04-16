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
  const tabDebtsEdge = document.getElementById('tab-dashboard-debts-edge');
  const tabSavingsEdge = document.getElementById('tab-dashboard-savings-edge');

  if (!tabPlan || !tabDash || !panelPlan || !panelDash) return;

  const top = { tabA: tabPlan, tabB: tabDash, panelA: panelPlan, panelB: panelDash };
  const dash = { tabA: tabDebts, tabB: tabSavings, panelA: panelDebts, panelB: panelSavings };

  function setToolwinCollapsed(name, collapsed) {
    const key = 'financial-plan.dashboard.toolwin.' + String(name || 'tool') + '.collapsed';
    const win = document.querySelector('.toolwin[data-toolwin="' + String(name || '') + '"]');
    if (!win) return;
    win.classList.toggle('is-collapsed', !!collapsed);
    win.setAttribute('data-collapsed', collapsed ? '1' : '0');
    const btn = win.querySelector('[data-toolwin-toggle]');
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute(
        'aria-label',
        collapsed ? 'Expand ' + name + ' editor' : 'Collapse ' + name + ' editor'
      );
    }
    try {
      localStorage.setItem(key, collapsed ? '1' : '0');
    } catch (e) {}
  }

  function syncDashEdgeTabs(which) {
    if (!tabDebtsEdge || !tabSavingsEdge) return;
    const isSavings = which === 'savings';
    setSelected(tabDebtsEdge, !isSavings);
    setSelected(tabSavingsEdge, isSavings);
  }

  function activateDash(which, opts) {
    const w = which === 'savings' ? 'savings' : 'debts';
    if (!tabDebts || !tabSavings || !panelDebts || !panelSavings) return;
    if (w === 'savings') activatePairB(dash);
    else activatePair(dash);
    syncDashEdgeTabs(w);
    // Edge tabs are the primary editor selectors: open the matching editor pane.
    setToolwinCollapsed('debts', w !== 'debts');
    setToolwinCollapsed('savings', w !== 'savings');
    if (opts && opts.updateHash) {
      try {
        history.replaceState(null, '', w === 'savings' ? '#dashboard/savings' : '#dashboard/debts');
      } catch (e) {}
    }
  }

  // Default state (in case markup changes later).
  activatePair(top);
  if (tabDebts && tabSavings && panelDebts && panelSavings) {
    activateDash('debts');
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
      activateDash('debts', { updateHash: true });
    });
    tabSavings.addEventListener('click', function () {
      activateDash('savings', { updateHash: true });
    });
  }

  if (tabDebtsEdge && tabSavingsEdge && tabDebts && tabSavings && panelDebts && panelSavings) {
    tabDebtsEdge.addEventListener('click', function () {
      activatePairB(top);
      activateDash('debts', { updateHash: true });
    });
    tabSavingsEdge.addEventListener('click', function () {
      activatePairB(top);
      activateDash('savings', { updateHash: true });
    });
  }

  // Buttons with data-open-dashboard (goal cards, plan hints) open Dashboard + subtab.
  const openDashBtns = document.querySelectorAll('[data-open-dashboard]');
  if (openDashBtns && openDashBtns.length) {
    openDashBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activatePairB(top);
        const which = btn.getAttribute('data-open-dashboard');
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

