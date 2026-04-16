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

  function setEdgeEditorOpen(name, open) {
    const n = String(name || '');
    const editor = document.querySelector('.edge-editor[data-edge-editor="' + n + '"]');
    const tab = document.getElementById('tab-dashboard-' + n + '-edge');
    const panel = document.getElementById('edge-editor-panel-' + n);
    if (tab) tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) {
      panel.hidden = !open;
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (editor) editor.classList.toggle('is-open', !!open);
  }

  function closeAllEdgeEditors() {
    setEdgeEditorOpen('debts', false);
    setEdgeEditorOpen('savings', false);
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
    // Only open drawers when explicitly requested (edge tabs).
    if (opts && opts.openEditor) {
      setEdgeEditorOpen('debts', w === 'debts');
      setEdgeEditorOpen('savings', w === 'savings');
    }
    if (opts && opts.updateHash) {
      try {
        history.replaceState(null, '', w === 'savings' ? '#dashboard/savings' : '#dashboard/debts');
      } catch (e) {}
    }
  }

  // Default state (in case markup changes later).
  activatePair(top);
  if (tabDebts && tabSavings && panelDebts && panelSavings) {
    // Keep edge editor drawers collapsed on load.
    setEdgeEditorOpen('debts', false);
    setEdgeEditorOpen('savings', false);
    // Preserve the default tab selection (Debts) without opening an editor.
    activateDash('debts', { openEditor: false });
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
      activateDash('debts', { updateHash: true, openEditor: false });
    });
    tabSavings.addEventListener('click', function () {
      activateDash('savings', { updateHash: true, openEditor: false });
    });
  }

  if (tabDebtsEdge && tabSavingsEdge && tabDebts && tabSavings && panelDebts && panelSavings) {
    tabDebtsEdge.addEventListener('click', function () {
      activatePairB(top);
      const open = tabDebtsEdge.getAttribute('aria-expanded') === 'true';
      if (open) {
        // Collapse when clicking the active editor tab.
        setEdgeEditorOpen('debts', false);
      } else {
        // Ensure the other editor collapses, then open this one.
        setEdgeEditorOpen('savings', false);
        activateDash('debts', { updateHash: true, openEditor: true });
      }
    });
    tabSavingsEdge.addEventListener('click', function () {
      activatePairB(top);
      const open = tabSavingsEdge.getAttribute('aria-expanded') === 'true';
      if (open) {
        setEdgeEditorOpen('savings', false);
      } else {
        setEdgeEditorOpen('debts', false);
        activateDash('savings', { updateHash: true, openEditor: true });
      }
    });

    // Click outside drawer collapses any open editor.
    document.addEventListener(
      'click',
      function (e) {
        const t = e && e.target;
        if (!t) return;
        // Ignore clicks on the tabs or inside the drawer panels.
        if (t.closest && t.closest('.edge-editor__tab')) return;
        if (t.closest && t.closest('.edge-editor__panel')) return;
        // Only close if anything is currently open.
        if (
          tabDebtsEdge.getAttribute('aria-expanded') === 'true' ||
          tabSavingsEdge.getAttribute('aria-expanded') === 'true'
        ) {
          closeAllEdgeEditors();
        }
      },
      false
    );
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
      // Select correct dashboard panel, keep drawers collapsed.
      if (h.indexOf('/savings') !== -1) activateDash('savings', { openEditor: false });
      else activateDash('debts', { openEditor: false });
    }
  } catch (e) {}
}

