/**
 * Collapsible tool windows (IDE-style panes) on Dashboard.
 */

const TOOLWIN_KEY_PREFIX = 'financial-plan.dashboard.toolwin.';

function storageKey(name: unknown): string {
  return TOOLWIN_KEY_PREFIX + String(name || 'tool') + '.collapsed';
}

function isCollapsedFromStorage(name: string): boolean {
  try {
    return localStorage.getItem(storageKey(name)) === '1';
  } catch (e) {
    return false;
  }
}

function setCollapsedInStorage(name: string, collapsed: boolean): void {
  try {
    localStorage.setItem(storageKey(name), collapsed ? '1' : '0');
  } catch (e) {}
}

function setCollapsed(el: HTMLElement | null, collapsed: boolean): void {
  if (!el) return;
  el.classList.toggle('is-collapsed', !!collapsed);
  el.setAttribute('data-collapsed', collapsed ? '1' : '0');
  const btn = el.querySelector('[data-toolwin-toggle]') as HTMLElement | null;
  if (btn) {
    const name = el.getAttribute('data-toolwin') || 'editor';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute(
      'aria-label',
      collapsed ? 'Expand ' + name + ' editor' : 'Collapse ' + name + ' editor'
    );
  }
}

export function wireToolWindows(): void {
  const wins = document.querySelectorAll<HTMLElement>('.toolwin[data-toolwin]');
  if (!wins || !wins.length) return;

  wins.forEach(function (win) {
    const name = win.getAttribute('data-toolwin') || 'tool';
    setCollapsed(win, isCollapsedFromStorage(name));

    const btn = win.querySelector('[data-toolwin-toggle]') as HTMLElement | null;
    const head = win.querySelector('.toolwin__head') as HTMLElement | null;
    function toggle() {
      const next = !win.classList.contains('is-collapsed');
      setCollapsed(win, next);
      setCollapsedInStorage(name, next);
    }
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
    }
    if (head) {
      head.addEventListener('click', function (e) {
        // Ignore clicks inside interactive controls (inputs/buttons/selects).
        const t = (e.target as HTMLElement | null) || null;
        if (t && t.closest && t.closest('button, a, input, select, textarea, label')) return;
        toggle();
      });
      head.style.cursor = 'pointer';
    }
  });
}

