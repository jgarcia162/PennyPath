/**
 * Light/dark theme: reads/writes `localStorage` and sets `document.documentElement[data-theme]`.
 * Exposes `window.ThemeService`. Load before `site-settings.js` on pages that use the gear menu.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'financial-plan-v3-aggressive.theme';
  const ROOT_ATTR = 'data-theme';

  type Theme = 'light' | 'dark';

  interface ThemeService {
    init(): void;
    getTheme(): Theme;
    setTheme(theme: Theme | string): Theme;
    toggleTheme(): Theme;
    applyTheme(theme: Theme | string): Theme;
    STORAGE_KEY: string;
    ROOT_ATTR: string;
  }

  function safeGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key: string, val: string): void {
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  function normalizeTheme(t: unknown): Theme {
    return t === 'dark' ? 'dark' : 'light';
  }

  function getTheme(): Theme {
    const stored = safeGet(STORAGE_KEY);
    if (stored) return normalizeTheme(stored);
    return 'light';
  }

  function applyTheme(theme: unknown): Theme {
    const t = normalizeTheme(theme);
    document.documentElement.setAttribute(ROOT_ATTR, t);
    return t;
  }

  function setTheme(theme: unknown): Theme {
    const t = applyTheme(theme);
    safeSet(STORAGE_KEY, t);
    return t;
  }

  function toggleTheme(): Theme {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    return setTheme(next);
  }

  function init(): void {
    applyTheme(getTheme());
  }

  (window as any).ThemeService = {
    init: init,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    applyTheme: applyTheme,
    STORAGE_KEY: STORAGE_KEY,
    ROOT_ATTR: ROOT_ATTR,
  } satisfies ThemeService;

  try {
    init();
  } catch (e) {}
})();

