/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_BUSY_BAR_ID,
  hideAppBusy,
  isAppBusy,
  resetAppBusyForTests,
  showAppBusy,
  withAppBusy,
} from './app-busy';

function bar(): HTMLElement | null {
  return document.getElementById(APP_BUSY_BAR_ID);
}

function barIsVisible(): boolean {
  const el = bar();
  if (!el) return false;
  try {
    if (el.matches(':popover-open')) return true;
  } catch {
    /* happy-dom may not support :popover-open */
  }
  return el.classList.contains('app-busy-bar--open');
}

describe('app-busy status bar', () => {
  beforeEach(() => {
    resetAppBusyForTests();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetAppBusyForTests();
    vi.useRealTimers();
  });

  it('creates a non-blocking status bar with the given message', () => {
    showAppBusy('Saving wrap-up…');
    const el = bar();
    expect(el).toBeTruthy();
    expect(el?.tagName.toLowerCase()).toBe('div');
    expect(el?.getAttribute('popover')).toBe('manual');
    expect(el?.getAttribute('role')).toBe('status');
    expect(isAppBusy()).toBe(true);
    expect(barIsVisible()).toBe(true);
    expect(el?.textContent).toContain('Saving wrap-up…');
    hideAppBusy();
    expect(isAppBusy()).toBe(false);
    expect(barIsVisible()).toBe(false);
  });

  it('nests show/hide so the bar stays until the outer operation finishes', () => {
    showAppBusy('Resetting…');
    showAppBusy('Saving…');
    expect(bar()?.textContent).toContain('Resetting…');
    hideAppBusy();
    expect(barIsVisible()).toBe(true);
    expect(bar()?.textContent).toContain('Resetting…');
    hideAppBusy();
    expect(barIsVisible()).toBe(false);
  });

  it('withAppBusy hides even when the work throws', async () => {
    await expect(
      withAppBusy('Saving…', async function () {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');
    expect(isAppBusy()).toBe(false);
    expect(barIsVisible()).toBe(false);
  });

  it('delayed withAppBusy does not flash for fast work', async () => {
    vi.useFakeTimers();
    const p = withAppBusy(
      'Saving…',
      function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, 50);
        });
      },
      { delayMs: 160 }
    );
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(bar()).toBeNull();
    expect(isAppBusy()).toBe(false);
  });

  it('delayed withAppBusy appears after the delay while work is still running', async () => {
    vi.useFakeTimers();
    let release: () => void = function () {};
    const work = new Promise<void>(function (resolve) {
      release = resolve;
    });
    const p = withAppBusy(
      'Saving…',
      function () {
        return work;
      },
      { delayMs: 160 }
    );
    await vi.advanceTimersByTimeAsync(159);
    expect(bar()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(barIsVisible()).toBe(true);
    release();
    await p;
    expect(barIsVisible()).toBe(false);
  });
});
