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
  const tabDebtsEdge = document.getElementById('tab-dashboard-debts-edge') as HTMLElement | null;
  const tabSavingsEdge = document.getElementById('tab-dashboard-savings-edge') as HTMLElement | null;

  if (!tabPlan || !tabDash || !panelPlan || !panelDash) return;

  const top = { tabA: tabPlan, tabB: tabDash, panelA: panelPlan, panelB: panelDash };
  const dash =
    tabDebts && tabSavings && panelDebts && panelSavings
      ? { tabA: tabDebts, tabB: tabSavings, panelA: panelDebts, panelB: panelSavings }
      : null;

  function setEdgeEditorOpen(name: string, open: boolean): void {
    const n = String(name || '');
    const editor = document.querySelector(
      '.edge-editor[data-edge-editor="' + n + '"]'
    ) as HTMLElement | null;
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

  function syncDashEdgeTabs(which: string): void {
    if (!tabDebtsEdge || !tabSavingsEdge) return;
    const isSavings = which === 'savings';
    setSelected(tabDebtsEdge, !isSavings);
    setSelected(tabSavingsEdge, isSavings);
  }

  function activateDash(which: string, opts?: { openEditor?: boolean; updateHash?: boolean }): void {
    const w = which === 'savings' ? 'savings' : 'debts';
    if (!dash) return;
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
  if (dash) {
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

  if (dash) {
    const tabDebtsEl = dash.tabA;
    const tabSavingsEl = dash.tabB;
    tabDebtsEl.addEventListener('click', function () {
      closeAllEdgeEditors();
      activateDash('debts', { updateHash: true, openEditor: false });
    });
    tabSavingsEl.addEventListener('click', function () {
      closeAllEdgeEditors();
      activateDash('savings', { updateHash: true, openEditor: false });
    });
  }

  if (tabDebtsEdge && tabSavingsEdge && tabDebts && tabSavings && panelDebts && panelSavings) {
    tabDebtsEdge.addEventListener('click', function () {
      activatePairB(top);
      const isSelected = tabDebtsEdge.getAttribute('aria-selected') === 'true';
      if (!isSelected) {
        // First click selects the dashboard tab (no editor open).
        closeAllEdgeEditors();
        activateDash('debts', { updateHash: true, openEditor: false });
        return;
      }
      // Second click toggles the editor drawer.
      const open = tabDebtsEdge.getAttribute('aria-expanded') === 'true';
      setEdgeEditorOpen('savings', false);
      setEdgeEditorOpen('debts', !open);
    });
    tabSavingsEdge.addEventListener('click', function () {
      activatePairB(top);
      const isSelected = tabSavingsEdge.getAttribute('aria-selected') === 'true';
      if (!isSelected) {
        closeAllEdgeEditors();
        activateDash('savings', { updateHash: true, openEditor: false });
        return;
      }
      const open = tabSavingsEdge.getAttribute('aria-expanded') === 'true';
      setEdgeEditorOpen('debts', false);
      setEdgeEditorOpen('savings', !open);
    });

    // Click outside drawer collapses any open editor.
    document.addEventListener(
      'click',
      function (e: MouseEvent) {
        const t = e && (e.target as HTMLElement | null);
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

  // (Auto-contrast demo removed; using scrim/text-shadow approach only.)

  // Buttons with data-open-dashboard (goal cards, plan hints) open Dashboard + subtab.
  const openDashBtns = document.querySelectorAll('[data-open-dashboard]');
  if (openDashBtns && openDashBtns.length) {
    openDashBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activatePairB(top);
        const which = (btn as HTMLElement).getAttribute('data-open-dashboard');
        closeAllEdgeEditors();
        activateDash(which === 'savings' ? 'savings' : 'debts', { updateHash: true, openEditor: false });
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

