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

    ['btn-print', 'btn-wipe-all-data', 'btn-open-appearance'].forEach(function (id) {
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

  /** Appearance dialog: palette picker + body scroll lock while open. */
  function initAppearanceDialog() {
    var dlg = document.getElementById('appearance-dialog');
    var openBtn = document.getElementById('btn-open-appearance');
    if (!dlg || !openBtn) return;

    var scrollDepth = 0;
    var scrollY = 0;

    function lockScroll() {
      if (scrollDepth === 0) {
        scrollY = window.scrollY || window.pageYOffset || 0;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = '-' + scrollY + 'px';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
      }
      scrollDepth++;
    }

    function unlockScroll() {
      scrollDepth = Math.max(0, scrollDepth - 1);
      if (scrollDepth > 0) return;
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    }

    function syncPaletteOptions() {
      var current =
        window.ColorPaletteService && window.ColorPaletteService.getPalette
          ? window.ColorPaletteService.getPalette()
          : 'pastel';
      var opts = dlg.querySelectorAll('.palette-option[data-palette]');
      for (var i = 0; i < opts.length; i++) {
        var el = opts[i];
        var id = el.getAttribute('data-palette');
        var on = id === current;
        el.setAttribute('aria-selected', on ? 'true' : 'false');
        el.classList.toggle('palette-option--current', on);
      }
    }

    openBtn.addEventListener('click', function () {
      syncPaletteOptions();
      lockScroll();
      if (typeof dlg.showModal === 'function') dlg.showModal();
    });

    dlg.addEventListener('close', function () {
      unlockScroll();
    });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) {
        dlg.close();
        return;
      }
      var t = e.target;
      var el = t && t.nodeType === 3 ? t.parentElement : t;
      if (el && typeof el.closest === 'function' && el.closest('[data-close-appearance-dialog]')) {
        dlg.close();
      }
    });

    var paletteBtns = dlg.querySelectorAll('.palette-option[data-palette]');
    for (var k = 0; k < paletteBtns.length; k++) {
      paletteBtns[k].addEventListener('click', function () {
        var id = this.getAttribute('data-palette');
        if (!id || !window.ColorPaletteService || !window.ColorPaletteService.applyPalette) return;
        window.ColorPaletteService.applyPalette(id);
        syncPaletteOptions();
      });
    }

    window.addEventListener('pennypath:palettechange', syncPaletteOptions);
  }

  function init() {
    initDropdown();
    initTheme();
    initPrint();
    initDemoModeToggle();
    initAppearanceDialog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
