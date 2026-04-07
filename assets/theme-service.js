/**
 * Light/dark theme: reads/writes `localStorage` and sets `document.documentElement[data-theme]`.
 * Exposes `window.ThemeService`. Load before `site-settings.js` on pages that use the gear menu.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'financial-plan-v3-aggressive.theme';
  const ROOT_ATTR = 'data-theme';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  function normalizeTheme(t) {
    return t === 'dark' ? 'dark' : 'light';
  }

  function getTheme() {
    const stored = safeGet(STORAGE_KEY);
    if (stored) return normalizeTheme(stored);
    return 'light';
  }

  function applyTheme(theme) {
    const t = normalizeTheme(theme);
    document.documentElement.setAttribute(ROOT_ATTR, t);
    return t;
  }

  function setTheme(theme) {
    const t = applyTheme(theme);
    safeSet(STORAGE_KEY, t);
    return t;
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    return setTheme(next);
  }

  function init() {
    applyTheme(getTheme());
  }

  window.ThemeService = {
    init: init,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    applyTheme: applyTheme,
    STORAGE_KEY: STORAGE_KEY,
    ROOT_ATTR: ROOT_ATTR,
  };

  try {
    init();
  } catch (e) {}
})();

