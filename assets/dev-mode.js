/**
 * Developer mode (easter egg): tap the footer version row (#footer-meta) 7× within ~12s to unlock.
 * Shows a toast, Appearance → Developer, and Settings → Sample data. Keys: pennypath.developer.*
 */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var LS_UNLOCKED = 'pennypath.developer.unlocked';
  var LS_TECHNICAL = 'pennypath.developer.technical';
  var TAP_WINDOW_MS = 12000;
  var TAPS_REQUIRED = 7;

  function getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setItem(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function isUnlocked() {
    return getItem(LS_UNLOCKED) === '1';
  }

  /** Technical hints (.env, npm, etc.) when unlocked and not opted out. */
  function isTechnical() {
    if (!isUnlocked()) return false;
    var t = getItem(LS_TECHNICAL);
    if (t === '0') return false;
    return true;
  }

  function setTechnical(on) {
    setItem(LS_TECHNICAL, on ? '1' : '0');
    syncDom();
    dispatchChange();
  }

  function dispatchChange() {
    try {
      window.dispatchEvent(new CustomEvent('pennypath-dev-mode-changed'));
    } catch (e) {}
  }

  function syncDom() {
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

    var cb = document.getElementById('dev-mode-technical-toggle');
    if (cb) {
      cb.checked = isTechnical();
    }

    var devBits = document.querySelectorAll('[data-dev-copy="technical"]');
    for (var i = 0; i < devBits.length; i++) {
      devBits[i].hidden = !isTechnical();
    }

    var sampleSections = document.querySelectorAll('[data-dev-only="sample-data"]');
    for (var s = 0; s < sampleSections.length; s++) {
      sampleSections[s].hidden = !isUnlocked();
    }
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

    function onActivate(e) {
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

    hit.addEventListener('click', onActivate);

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
    var cb = document.getElementById('dev-mode-technical-toggle');
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

  window.PennypathDev = {
    VERSION: APP_VERSION,
    isUnlocked: isUnlocked,
    isTechnical: isTechnical,
    setTechnical: setTechnical,
    syncDom: syncDom,
  };

  function init() {
    setFooterLabel();
    syncDom();
    wireEasterEgg();
    wireAppearanceToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
