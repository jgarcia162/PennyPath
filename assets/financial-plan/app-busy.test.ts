/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_BUSY_OVERLAY_ID,
  hideAppBusy,
  isAppBusy,
  resetAppBusyForTests,
  showAppBusy,
  withAppBusy,
} from './app-busy';

function overlay(): HTMLElement | null {
  return document.getElementById(APP_BUSY_OVERLAY_ID);
}

function overlayIsVisible(): boolean {
  const el = overlay();
  if (!el) return false;
  const dlg = el as HTMLDialogElement;
  if (typeof dlg.open === 'boolean') return dlg.open;
  return el.hasAttribute('open') && !el.hasAttribute('hidden');
}

describe('app-busy overlay', () => {
  beforeEach(() => {
    resetAppBusyForTests();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    resetAppBusyForTests();
    vi.useRealTimers();
  });

  it('creates a dialog overlay with the given message', () => {
    showAppBusy('Saving wrap-up…');
    const el = overlay();
    expect(el).toBeTruthy();
    expect(el?.tagName.toLowerCase()).toBe('dialog');
    expect(isAppBusy()).toBe(true);
    expect(overlayIsVisible()).toBe(true);
    expect(el?.textContent).toContain('Saving wrap-up…');
    hideAppBusy();
    expect(isAppBusy()).toBe(false);
    expect(overlayIsVisible()).toBe(false);
  });

  it('nests show/hide so the overlay stays until the outer operation finishes', () => {
    showAppBusy('Resetting…');
    showAppBusy('Saving…');
    expect(overlay()?.textContent).toContain('Resetting…');
    hideAppBusy();
    expect(overlayIsVisible()).toBe(true);
    expect(overlay()?.textContent).toContain('Resetting…');
    hideAppBusy();
    expect(overlayIsVisible()).toBe(false);
  });

  it('withAppBusy hides even when the work throws', async () => {
    await expect(
      withAppBusy('Saving…', async function () {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');
    expect(isAppBusy()).toBe(false);
    expect(overlayIsVisible()).toBe(false);
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
    expect(overlay()).toBeNull();
    expect(isAppBusy()).toBe(false);
  });

  it('delayed withAppBusy appears after the delay while work is still running', async () => {
    vi.useFakeTimers();
    let release: () => void = function () {};
    const work = new Promise<void>(function (resolve) {
      release = resolve;
    });
    const p = withAppBusy('Saving…', function () {
      return work;
    }, { delayMs: 160 });
    await vi.advanceTimersByTimeAsync(159);
    expect(overlay()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(overlayIsVisible()).toBe(true);
    release();
    await p;
    expect(overlayIsVisible()).toBe(false);
  });
});
