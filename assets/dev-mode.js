/**
 * Developer mode (easter egg): tap the footer app version 7× within ~4.5s to unlock.
 * Toggle “technical” copy in Appearance → Developer. Keys: pennypath.developer.*
 */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var LS_UNLOCKED = 'pennypath.developer.unlocked';
  var LS_TECHNICAL = 'pennypath.developer.technical';
  var TAP_WINDOW_MS = 4500;
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
  }

  function unlockFromEasterEgg() {
    setItem(LS_UNLOCKED, '1');
    if (getItem(LS_TECHNICAL) === null) {
      setItem(LS_TECHNICAL, '1');
    }
    syncDom();
    dispatchChange();
  }

  function wireEasterEgg() {
    var el = document.getElementById('footer-app-version');
    if (!el) return;

    var firstTap = 0;
    var count = 0;

    function reset() {
      firstTap = 0;
      count = 0;
    }

    function onActivate() {
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

    el.addEventListener('click', onActivate);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    });
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
