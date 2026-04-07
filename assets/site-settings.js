/**
 * Sticky header settings (gear): dropdown panel, theme, print, demo toggle.
 * Loaded on all site pages that include the shared header.
 *
 * Demo mode key must match `DEMO_MODE_STORAGE_KEY` in `assets/financial-plan/plan-data.js`
 * (ES modules cannot import here; change both if you rename the flag).
 */
(function () {
  'use strict';

  function syncThemeButtonLabel(btn) {
    if (!btn) return;
    var t = window.ThemeService && window.ThemeService.getTheme ? window.ThemeService.getTheme() : 'light';
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    btn.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function closeMenu(menu, trigger) {
    if (!menu || !trigger) return;
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('site-settings-open');
  }

  function openMenu(menu, trigger) {
    if (!menu || !trigger) return;
    menu.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('site-settings-open');
  }

  function toggleMenu(menu, trigger) {
    if (menu.classList.contains('is-open')) closeMenu(menu, trigger);
    else openMenu(menu, trigger);
  }

  function initDropdown() {
    var trigger = document.getElementById('btn-site-settings');
    var menu = document.getElementById('site-settings-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(menu, trigger);
    });

    document.addEventListener('click', function (e) {
      var wrap = trigger.closest('.site-header__settings');
      if (wrap && !wrap.contains(e.target)) closeMenu(menu, trigger);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu(menu, trigger);
    });

    ['btn-print', 'btn-wipe-all-data'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        closeMenu(menu, trigger);
      });
    });
  }

  function initTheme() {
    try {
      if (window.ThemeService && window.ThemeService.init) window.ThemeService.init();
    } catch (e) {}
    var btn = document.getElementById('btn-toggle-theme');
    if (!btn) return;
    syncThemeButtonLabel(btn);
    btn.addEventListener('click', function () {
      try {
        if (window.ThemeService && window.ThemeService.toggleTheme) window.ThemeService.toggleTheme();
      } catch (e) {}
      syncThemeButtonLabel(btn);
    });
  }

  function initPrint() {
    var btn = document.getElementById('btn-print');
    if (!btn) return;
    btn.addEventListener('click', function () {
      try {
        window.print();
      } catch (e) {}
    });
  }

  /** Keep in sync with `DEMO_MODE_STORAGE_KEY` in plan-data.js */
  var DEMO_MODE_KEY = 'financial-plan.historyDemo';

  function initDemoModeToggle() {
    var input = document.getElementById('demo-mode-toggle');
    if (!input) return;
    try {
      input.checked = localStorage.getItem(DEMO_MODE_KEY) === '1';
    } catch (e) {}
    input.addEventListener('change', function () {
      try {
        localStorage.setItem(DEMO_MODE_KEY, input.checked ? '1' : '0');
      } catch (e) {}
      location.reload();
    });
  }

  function init() {
    initDropdown();
    initTheme();
    initPrint();
    initDemoModeToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
