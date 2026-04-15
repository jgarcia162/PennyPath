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
    var backdropEl = null;

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

    function openAppearanceDialog() {
      // Always sync the UI first so the dialog opens in a correct state.
      syncPaletteOptions();

      // Prefer native <dialog>. Only lock scroll after showModal() succeeds.
      if (typeof dlg.showModal === 'function') {
        try {
          dlg.showModal();
          lockScroll();
          return true;
        } catch (e) {
          // showModal can throw (e.g., not in DOM, already open). Don't lock scroll on failure.
          try {
            if (typeof dlg.close === 'function') dlg.close();
          } catch (e2) {}
          return false;
        }
      }

      // Fallback for browsers without native <dialog> support:
      // make the dialog visibly open and provide a backdrop that closes it.
      try {
        dlg.setAttribute('open', '');
        dlg.setAttribute('aria-modal', 'true');
        if (!dlg.getAttribute('role')) dlg.setAttribute('role', 'dialog');

        // Ensure it's visible even if CSS expects showModal/backdrop behavior.
        dlg.style.display = 'block';
        dlg.style.position = 'fixed';
        dlg.style.zIndex = '10000';
        dlg.style.left = '50%';
        dlg.style.top = '50%';
        dlg.style.transform = 'translate(-50%, -50%)';
        if (!dlg.style.maxWidth) dlg.style.maxWidth = 'min(92vw, 42rem)';
        if (!dlg.style.maxHeight) dlg.style.maxHeight = 'min(85vh, 42rem)';
        dlg.style.overflow = 'auto';

        if (!backdropEl) {
          backdropEl = document.createElement('div');
          backdropEl.setAttribute('data-appearance-dialog-backdrop', '');
          backdropEl.style.position = 'fixed';
          backdropEl.style.left = '0';
          backdropEl.style.top = '0';
          backdropEl.style.right = '0';
          backdropEl.style.bottom = '0';
          backdropEl.style.background = 'rgba(0,0,0,0.4)';
          backdropEl.style.zIndex = '9999';
          backdropEl.addEventListener('click', function () {
            closeAppearanceDialog();
          });
        }
        if (!backdropEl.parentNode) document.body.appendChild(backdropEl);

        // Move focus into the dialog for accessibility.
        var focusTarget =
          dlg.querySelector('[autofocus]') ||
          dlg.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusTarget && focusTarget.focus) focusTarget.focus();

        lockScroll();
        return true;
      } catch (e3) {
        // Surface an explicit failure rather than silently doing nothing.
        try {
          console.error('Appearance dialog failed to open (no native <dialog> support).', e3);
        } catch (e4) {}
        return false;
      }
    }

    function closeAppearanceDialog() {
      if (typeof dlg.close === 'function') {
        try {
          dlg.close();
          return;
        } catch (e) {}
      }

      // Fallback close: mirror unlockScroll() behavior since <dialog> won't fire "close".
      try {
        dlg.removeAttribute('open');
        dlg.style.display = '';
        dlg.style.position = '';
        dlg.style.zIndex = '';
        dlg.style.left = '';
        dlg.style.top = '';
        dlg.style.transform = '';
        dlg.style.maxWidth = '';
        dlg.style.maxHeight = '';
        dlg.style.overflow = '';
      } catch (e2) {}
      try {
        if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      } catch (e3) {}
      unlockScroll();
    }

    openBtn.addEventListener('click', function () {
      openAppearanceDialog();
    });

    dlg.addEventListener('close', function () {
      unlockScroll();
      try {
        if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      } catch (e) {}
    });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) {
        closeAppearanceDialog();
        return;
      }
      var t = e.target;
      var el = t && t.nodeType === 3 ? t.parentElement : t;
      if (el && typeof el.closest === 'function' && el.closest('[data-close-appearance-dialog]')) {
        closeAppearanceDialog();
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
