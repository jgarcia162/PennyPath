/**
 * Full-viewport busy overlay for slow plan operations (save, wrap-up, reset).
 * Implemented as a <dialog> so it stacks in the top layer above editor modals.
 */

export const APP_BUSY_OVERLAY_ID = 'app-busy-overlay';
export const APP_BUSY_LABEL_ID = 'app-busy-overlay-label';

const DEFAULT_MESSAGE = 'Saving…';

let depth = 0;

function canUseDom(): boolean {
  return typeof document !== 'undefined';
}

function setLabel(el: HTMLElement, message: string): void {
  const label = el.querySelector('#' + APP_BUSY_LABEL_ID) as HTMLElement | null;
  if (label) label.textContent = message;
  el.setAttribute('aria-label', message);
}

function ensureOverlay(): HTMLDialogElement | HTMLElement | null {
  if (!canUseDom()) return null;
  let el = document.getElementById(APP_BUSY_OVERLAY_ID);
  if (el) return el as HTMLDialogElement;

  const dlg = document.createElement('dialog');
  dlg.id = APP_BUSY_OVERLAY_ID;
  dlg.className = 'app-loading-overlay';
  dlg.setAttribute('role', 'status');
  dlg.setAttribute('aria-live', 'polite');
  dlg.setAttribute('aria-busy', 'true');
  dlg.setAttribute('aria-modal', 'true');
  dlg.innerHTML =
    '<div class="ai-payoff-loading app-loading-overlay__panel">' +
    '<span class="ai-payoff-loading__spinner" aria-hidden="true"></span>' +
    '<p class="ai-payoff-loading__label" id="' +
    APP_BUSY_LABEL_ID +
    '">' +
    DEFAULT_MESSAGE +
    '</p>' +
    '</div>';
  dlg.addEventListener('cancel', function (e) {
    e.preventDefault();
  });
  document.body.appendChild(dlg);
  return dlg;
}

function openOverlay(el: HTMLElement, message: string): void {
  setLabel(el, message);
  const dlg = el as HTMLDialogElement;
  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) {
      try {
        dlg.showModal();
        return;
      } catch {
        /* fall through */
      }
    } else {
      return;
    }
  }
  el.setAttribute('open', '');
  el.removeAttribute('hidden');
}

function closeOverlay(el: HTMLElement): void {
  const dlg = el as HTMLDialogElement;
  if (typeof dlg.close === 'function' && dlg.open) {
    try {
      dlg.close();
      return;
    } catch {
      /* fall through */
    }
  }
  el.removeAttribute('open');
  el.setAttribute('hidden', '');
}

export function showAppBusy(message: string = DEFAULT_MESSAGE): void {
  const el = ensureOverlay();
  if (!el) {
    depth++;
    return;
  }
  if (depth === 0) openOverlay(el, message);
  depth++;
}

export function hideAppBusy(): void {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  const el = canUseDom() ? document.getElementById(APP_BUSY_OVERLAY_ID) : null;
  if (el) closeOverlay(el);
}

export function isAppBusy(): boolean {
  return depth > 0;
}

/** Test helper: close overlay and reset nesting. */
export function resetAppBusyForTests(): void {
  depth = 0;
  if (!canUseDom()) return;
  const el = document.getElementById(APP_BUSY_OVERLAY_ID);
  if (el) closeOverlay(el);
}

export async function withAppBusy<T>(
  message: string,
  fn: () => Promise<T>,
  opts?: { delayMs?: number }
): Promise<T> {
  const delayMs = opts && typeof opts.delayMs === 'number' ? opts.delayMs : 0;
  let shown = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (delayMs <= 0) {
    showAppBusy(message);
    shown = true;
  } else if (canUseDom()) {
    timer = setTimeout(function () {
      showAppBusy(message);
      shown = true;
      timer = null;
    }, delayMs);
  }

  try {
    return await fn();
  } finally {
    if (timer != null) clearTimeout(timer);
    if (shown) hideAppBusy();
  }
}
