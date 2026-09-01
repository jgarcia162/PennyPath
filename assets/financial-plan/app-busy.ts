/**
 * Non-blocking busy indicator for slow plan operations (save, wrap-up, reset).
 * A bottom status bar uses the Popover API so it can sit in the top layer
 * above editor modals without trapping focus or dimming the page.
 */

export const APP_BUSY_BAR_ID = 'app-busy-bar';
export const APP_BUSY_LABEL_ID = 'app-busy-bar-label';

const DEFAULT_MESSAGE = 'Saving…';
const OPEN_CLASS = 'app-busy-bar--open';

let depth = 0;

type PopoverEl = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

function canUseDom(): boolean {
  return typeof document !== 'undefined';
}

function supportsPopover(el: PopoverEl): boolean {
  return typeof el.showPopover === 'function' && typeof el.hidePopover === 'function';
}

function isPopoverOpen(el: HTMLElement): boolean {
  try {
    return el.matches(':popover-open');
  } catch {
    return false;
  }
}

function setLabel(el: HTMLElement, message: string): void {
  const label = el.querySelector('#' + APP_BUSY_LABEL_ID) as HTMLElement | null;
  if (label) label.textContent = message;
  el.setAttribute('aria-label', message);
}

function ensureBar(): PopoverEl | null {
  if (!canUseDom()) return null;
  let el = document.getElementById(APP_BUSY_BAR_ID) as PopoverEl | null;
  if (el) return el;

  el = document.createElement('div');
  el.id = APP_BUSY_BAR_ID;
  el.className = 'app-busy-bar';
  el.setAttribute('popover', 'manual');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-busy', 'false');
  el.innerHTML =
    '<span class="app-busy-bar__spinner" aria-hidden="true"></span>' +
    '<p class="app-busy-bar__label" id="' +
    APP_BUSY_LABEL_ID +
    '">' +
    DEFAULT_MESSAGE +
    '</p>';
  document.body.appendChild(el);
  return el;
}

function openBar(el: PopoverEl, message: string): void {
  setLabel(el, message);
  el.setAttribute('aria-busy', 'true');
  if (supportsPopover(el)) {
    try {
      if (!isPopoverOpen(el)) el.showPopover!();
      return;
    } catch {
      /* fall through */
    }
  }
  el.classList.add(OPEN_CLASS);
}

function closeBar(el: PopoverEl): void {
  el.setAttribute('aria-busy', 'false');
  if (supportsPopover(el)) {
    try {
      if (isPopoverOpen(el)) el.hidePopover!();
    } catch {
      /* fall through */
    }
  }
  el.classList.remove(OPEN_CLASS);
}

export function showAppBusy(message: string = DEFAULT_MESSAGE): void {
  const el = ensureBar();
  if (!el) {
    depth++;
    return;
  }
  if (depth === 0) openBar(el, message);
  depth++;
}

export function hideAppBusy(): void {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  const el = canUseDom() ? (document.getElementById(APP_BUSY_BAR_ID) as PopoverEl | null) : null;
  if (el) closeBar(el);
}

export function isAppBusy(): boolean {
  return depth > 0;
}

/** Test helper: close the bar and reset nesting. */
export function resetAppBusyForTests(): void {
  depth = 0;
  if (!canUseDom()) return;
  const el = document.getElementById(APP_BUSY_BAR_ID) as PopoverEl | null;
  if (el) closeBar(el);
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
