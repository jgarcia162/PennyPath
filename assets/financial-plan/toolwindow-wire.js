/**
 * Collapsible tool windows (IDE-style panes) on Dashboard.
 */

const TOOLWIN_KEY_PREFIX = 'financial-plan.dashboard.toolwin.';

function storageKey(name) {
  return TOOLWIN_KEY_PREFIX + String(name || 'tool') + '.collapsed';
}

function isCollapsedFromStorage(name) {
  try {
    return localStorage.getItem(storageKey(name)) === '1';
  } catch (e) {
    return false;
  }
}

function setCollapsedInStorage(name, collapsed) {
  try {
    localStorage.setItem(storageKey(name), collapsed ? '1' : '0');
  } catch (e) {}
}

function setCollapsed(el, collapsed) {
  if (!el) return;
  el.classList.toggle('is-collapsed', !!collapsed);
  const btn = el.querySelector('[data-toolwin-toggle]');
  if (btn) {
    btn.textContent = collapsed ? '⟪' : '⟫';
    btn.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + (el.getAttribute('data-toolwin') || 'editor'));
  }
}

export function wireToolWindows() {
  const wins = document.querySelectorAll('.toolwin[data-toolwin]');
  if (!wins || !wins.length) return;

  wins.forEach(function (win) {
    const name = win.getAttribute('data-toolwin') || 'tool';
    setCollapsed(win, isCollapsedFromStorage(name));

    const btn = win.querySelector('[data-toolwin-toggle]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const next = !win.classList.contains('is-collapsed');
      setCollapsed(win, next);
      setCollapsedInStorage(name, next);
    });
  });
}

