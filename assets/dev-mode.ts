/**
 * Developer mode (easter egg): tap the footer version row (#footer-meta) 7× within ~12s to unlock.
 * Settings → Lock developer options clears keys. Test reset: add ?resetDeveloper=1 to the URL once.
 * Keys: pennypath.developer.unlocked, pennypath.developer.technical
 * When unlocked, a reminder strip appears under the header so you don’t forget to lock before demos.
 */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var LS_UNLOCKED = 'pennypath.developer.unlocked';
  var LS_TECHNICAL = 'pennypath.developer.technical';
  var TAP_WINDOW_MS = 12000;
  var TAPS_REQUIRED = 7;

  function getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setItem(key: string, val: string): void {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function isUnlocked(): boolean {
    return getItem(LS_UNLOCKED) === '1';
  }

  /** Technical hints (.env, npm, etc.) when unlocked and not opted out. */
  function isTechnical(): boolean {
    if (!isUnlocked()) return false;
    var t = getItem(LS_TECHNICAL);
    if (t === '0') return false;
    return true;
  }

  function setTechnical(on: boolean): void {
    setItem(LS_TECHNICAL, on ? '1' : '0');
    syncDom();
    dispatchChange();
  }

  function dispatchChange(): void {
    try {
      window.dispatchEvent(new CustomEvent('pennypath-dev-mode-changed'));
    } catch (e) {}
  }

  function syncDom(): void {
    var root = document.documentElement;
    if (isTechnical()) {
      root.setAttribute('data-dev-technical', 'true');
    } else {
      root.removeAttribute('data-dev-technical');
    }

    var devSec = document.getElementById('appearance-dev-section');
    if (devSec) {
      devSec.hidden = !isUnlocked();
    }

    var cb = document.getElementById('dev-mode-technical-toggle') as HTMLInputElement | null;
    if (cb) {
      cb.checked = isTechnical();
    }

    var devBits = document.querySelectorAll('[data-dev-copy="technical"]');
    for (var i = 0; i < devBits.length; i++) {
      (devBits[i] as HTMLElement).hidden = !isTechnical();
    }

    var sampleSections = document.querySelectorAll('[data-dev-only="sample-data"]');
    for (var s = 0; s < sampleSections.length; s++) {
      (sampleSections[s] as HTMLElement).hidden = !isUnlocked();
    }

    var devSettingsRows = document.querySelectorAll('[data-dev-only="developer-settings"]');
    for (var r = 0; r < devSettingsRows.length; r++) {
      (devSettingsRows[r] as HTMLElement).hidden = !isUnlocked();
    }

    syncReminderBar();
  }

  /** One sticky column so the nav + dev reminder scroll away together and stay in view. */
  function ensureHeaderStickyShell(): void {
    var header = document.querySelector('.site-header') as HTMLElement | null;
    if (!header) return;
    var p = header.parentElement;
    if (p && p.classList && p.classList.contains('site-header-sticky-shell')) return;
    var shell = document.createElement('div');
    shell.className = 'site-header-sticky-shell no-print';
    shell.id = 'site-header-sticky-shell';
    if (header.parentNode) header.parentNode.insertBefore(shell, header);
    shell.appendChild(header);
  }

  /** Banner under the site header whenever dev is unlocked (hard to miss before a screen share). */
  function syncReminderBar(): void {
    ensureHeaderStickyShell();
    var header = document.querySelector('.site-header') as HTMLElement | null;
    if (!header) return;

    var bar = document.getElementById('dev-mode-reminder');
    if (!isUnlocked()) {
      if (bar) bar.hidden = true;
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dev-mode-reminder';
      bar.className = 'dev-mode-reminder no-print';
      bar.setAttribute('role', 'status');
      var text = document.createElement('span');
      text.className = 'dev-mode-reminder__text';
      text.textContent =
        'Developer options are on — sample data controls and technical hints may be visible on this device.';
      var lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.id = 'btn-dev-reminder-lock';
      lockBtn.className = 'dev-mode-reminder__lock';
      lockBtn.textContent = 'Lock developer mode';
      lockBtn.addEventListener('click', function () {
        lockDeveloperMode();
      });
      bar.appendChild(text);
      bar.appendChild(lockBtn);
      header.parentNode.insertBefore(bar, header.nextSibling);
    }
    bar.hidden = false;
  }

  /** Clear unlock (for Settings or testing). */
  function lockDeveloperMode(): void {
    var reminder = document.getElementById('dev-mode-reminder');
    if (reminder) reminder.setAttribute('hidden', '');
    try {
      localStorage.removeItem(LS_UNLOCKED);
      localStorage.removeItem(LS_TECHNICAL);
    } catch (e) {}
    syncDom();
    dispatchChange();
    showLockToast();
  }

  function showLockToast() {
    var existing = document.getElementById('dev-mode-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.id = 'dev-mode-toast';
    t.className = 'dev-mode-toast';
    t.setAttribute('role', 'status');
    var msg = document.createElement('span');
    msg.className = 'dev-mode-toast__msg';
    msg.textContent = 'Developer options locked. Tap the footer version 7× to unlock again.';
    t.appendChild(msg);
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.classList.add('dev-mode-toast--visible');
    });
    setTimeout(function () {
      t.classList.remove('dev-mode-toast--visible');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 420);
    }, 3200);
  }

  /** Testing: `?resetDeveloper=1` clears keys once, then removes the query param. */
  function resetDeveloperFromQuery() {
    try {
      var currentUrl = new URL(window.location.href);
      var q = currentUrl.searchParams.get('resetDeveloper');
      if (q !== '1' && q !== 'true') return;
      localStorage.removeItem(LS_UNLOCKED);
      localStorage.removeItem(LS_TECHNICAL);
      currentUrl.searchParams.delete('resetDeveloper');
      var next =
        currentUrl.pathname +
        (currentUrl.searchParams.toString() ? '?' + currentUrl.searchParams.toString() : '') +
        (currentUrl.hash || '');
      window.history.replaceState({}, '', next);
    } catch (e) {}
  }

  function showDevUnlockToast() {
    var existing = document.getElementById('dev-mode-toast');
    if (existing) existing.remove();

    var t = document.createElement('div');
    t.id = 'dev-mode-toast';
    t.className = 'dev-mode-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');

    var icon = document.createElement('span');
    icon.className = 'dev-mode-toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✓';

    var msg = document.createElement('span');
    msg.className = 'dev-mode-toast__msg';
    msg.textContent = 'Developer options unlocked — check Settings and Appearance';

    t.appendChild(icon);
    t.appendChild(msg);
    document.body.appendChild(t);

    requestAnimationFrame(function () {
      t.classList.add('dev-mode-toast--visible');
    });

    var hideMs = 3800;
    setTimeout(function () {
      t.classList.remove('dev-mode-toast--visible');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 420);
    }, hideMs);
  }

  function unlockFromEasterEgg() {
    setItem(LS_UNLOCKED, '1');
    if (getItem(LS_TECHNICAL) === null) {
      setItem(LS_TECHNICAL, '1');
    }
    syncDom();
    dispatchChange();
    showDevUnlockToast();
  }

  function wireEasterEgg() {
    /** Whole strip is tappable (not only the small label) so the gesture is discoverable. */
    var hit =
      document.getElementById('footer-meta') || document.getElementById('footer-app-version');
    var btn = document.getElementById('footer-app-version');
    if (!hit) return;

    var firstTap = 0;
    var count = 0;

    function reset() {
      firstTap = 0;
      count = 0;
    }

    function onActivate(e?: any) {
      if (e && typeof e.button === 'number' && e.button !== 0) return;
      var now = Date.now();
      if (!firstTap || now - firstTap > TAP_WINDOW_MS) {
        firstTap = now;
        count = 0;
      }
      count++;
      if (count >= TAPS_REQUIRED) {
        reset();
        if (!isUnlocked()) {
          unlockFromEasterEgg();
        }
        return;
      }
    }

    /** Capture phase so nested controls or late listeners cannot swallow the gesture. */
    hit.addEventListener('click', onActivate, true);

    if (btn && btn !== hit) {
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      });
    } else if (hit && hit.tagName === 'BUTTON') {
      hit.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      });
    }
  }

  function wireAppearanceToggle() {
    var cb = document.getElementById('dev-mode-technical-toggle') as HTMLInputElement | null;
    if (!cb) return;
    cb.addEventListener('change', function () {
      setTechnical(!!cb.checked);
    });
  }

  function setFooterLabel() {
    var el = document.getElementById('footer-app-version');
    if (!el) return;
    el.textContent = 'PennyPath · v' + APP_VERSION;
    el.setAttribute('aria-label', 'App version ' + APP_VERSION);
  }

  (window as any).PennypathDev = {
    VERSION: APP_VERSION,
    isUnlocked: isUnlocked,
    isTechnical: isTechnical,
    setTechnical: setTechnical,
    syncDom: syncDom,
    lock: lockDeveloperMode,
  };

  function wireLockButton() {
    var btn = document.getElementById('btn-dev-lock');
    if (!btn) return;
    btn.addEventListener('click', function () {
      lockDeveloperMode();
    });
  }

  function init() {
    resetDeveloperFromQuery();
    setFooterLabel();
    ensureHeaderStickyShell();
    syncDom();
    wireEasterEgg();
    wireAppearanceToggle();
    wireLockButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
