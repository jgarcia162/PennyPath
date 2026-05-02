/**
 * Sticky header settings (gear): dropdown panel, theme, print, demo toggle.
 * Loaded on all site pages that include the shared header.
 *
 * Demo mode key must match `DEMO_MODE_STORAGE_KEY` in `assets/financial-plan/plan-data.js`
 * (ES modules cannot import here; change both if you rename the flag).
 */
(function () {
  'use strict';

  function syncThemeButtonLabel(btn: HTMLButtonElement | null) {
    if (!btn) return;
    var t =
      (window as any).ThemeService && (window as any).ThemeService.getTheme ? (window as any).ThemeService.getTheme() : 'light';
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    btn.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function closeMenu(menu: HTMLElement | null, trigger: HTMLElement | null) {
    if (!menu || !trigger) return;
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('site-settings-open');
  }

  function openMenu(menu: HTMLElement | null, trigger: HTMLElement | null) {
    if (!menu || !trigger) return;
    menu.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('site-settings-open');
  }

  function toggleMenu(menu: HTMLElement, trigger: HTMLElement) {
    if (menu.classList.contains('is-open')) closeMenu(menu, trigger);
    else openMenu(menu, trigger);
  }

  function initDropdown() {
    var trigger = document.getElementById('btn-site-settings') as HTMLButtonElement | null;
    var menu = document.getElementById('site-settings-menu') as HTMLElement | null;
    if (!trigger || !menu) return;
    const triggerEl = trigger;
    const menuEl = menu;

    triggerEl.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(menuEl, triggerEl);
    });

    document.addEventListener('click', function (e) {
      var wrap = triggerEl.closest('.site-header__settings');
      if (wrap && !wrap.contains(e.target as any)) closeMenu(menuEl, triggerEl);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu(menuEl, triggerEl);
    });

    ['btn-print', 'btn-wipe-all-data', 'btn-open-appearance', 'btn-dev-lock'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        closeMenu(menuEl, triggerEl);
      });
    });
  }

  function initTheme() {
    try {
      if ((window as any).ThemeService && (window as any).ThemeService.init) (window as any).ThemeService.init();
    } catch (e) {}
    var btn = document.getElementById('btn-toggle-theme') as HTMLButtonElement | null;
    if (!btn) return;
    syncThemeButtonLabel(btn);
    btn.addEventListener('click', function () {
      try {
        if ((window as any).ThemeService && (window as any).ThemeService.toggleTheme) (window as any).ThemeService.toggleTheme();
      } catch (e) {}
      syncThemeButtonLabel(btn);
    });
  }

  function initPrint() {
    var btn = document.getElementById('btn-print') as HTMLButtonElement | null;
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
    var input = document.getElementById('demo-mode-toggle') as HTMLInputElement | null;
    if (!input) return;
    const inputEl = input;
    try {
      inputEl.checked = localStorage.getItem(DEMO_MODE_KEY) === '1';
    } catch (e) {}
    inputEl.addEventListener('change', function () {
      try {
        localStorage.setItem(DEMO_MODE_KEY, inputEl.checked ? '1' : '0');
      } catch (e) {}
      location.reload();
    });
  }

  /** Appearance dialog: palette picker + body scroll lock while open. */
  function initAppearanceDialog() {
    var dlg = document.getElementById('appearance-dialog') as HTMLDialogElement | null;
    var openBtn = document.getElementById('btn-open-appearance') as HTMLButtonElement | null;
    if (!dlg || !openBtn) return;
    const dlgEl = dlg;
    const openBtnEl = openBtn;

    var scrollDepth = 0;
    var scrollY = 0;
    var backdropEl: HTMLElement | null = null;

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
      var root = document.documentElement;
      var prevSb = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      try {
        window.scrollTo({ left: 0, top: scrollY, behavior: 'auto' });
      } finally {
        if (prevSb) {
          root.style.scrollBehavior = prevSb;
        } else {
          root.style.removeProperty('scroll-behavior');
        }
      }
    }

    function syncPaletteOptions() {
      var svc = (window as any).ColorPaletteService;
      var current = svc && svc.getPalette ? svc.getPalette() : null;
      if (!current && svc && svc.PALETTES && svc.PALETTES.length && svc.PALETTES[0] && svc.PALETTES[0].id) {
        current = svc.PALETTES[0].id;
      }
      var opts = dlgEl.querySelectorAll('.palette-option[data-palette]');
      if (!current && opts.length && opts[0]) {
        current = opts[0].getAttribute('data-palette');
      }
      for (var i = 0; i < opts.length; i++) {
        var el = opts[i] as HTMLElement;
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
      // (In TS libdom, showModal() is always present on HTMLDialogElement, but some browsers may not implement it.)
      if (typeof (dlgEl as any).showModal === 'function') {
        // Avoid calling showModal() if the dialog is already open.
        // Some browsers throw in that case; also don't close an already-open dialog on failure.
        if (dlgEl.open === true || (typeof (dlgEl as any).hasAttribute === 'function' && dlgEl.hasAttribute('open'))) {
          lockScroll();
          return true;
        }
        try {
          (dlgEl as any).showModal();
          lockScroll();
          return true;
        } catch (e) {
          // showModal can throw (e.g., not in DOM). Don't lock scroll on failure.
          return false;
        }
      }

      // Fallback for browsers without native <dialog> support:
      // make the dialog visibly open and provide a backdrop that closes it.
      try {
        dlgEl.setAttribute('open', '');
        dlgEl.setAttribute('aria-modal', 'true');
        if (!dlgEl.getAttribute('role')) dlgEl.setAttribute('role', 'dialog');

        // Ensure it's visible even if CSS expects showModal/backdrop behavior.
        dlgEl.style.display = 'block';
        dlgEl.style.position = 'fixed';
        dlgEl.style.zIndex = '10000';
        dlgEl.style.left = '50%';
        dlgEl.style.top = '50%';
        dlgEl.style.transform = 'translate(-50%, -50%)';
        if (!dlgEl.style.maxWidth) dlgEl.style.maxWidth = 'min(92vw, 42rem)';
        if (!dlgEl.style.maxHeight) dlgEl.style.maxHeight = 'min(85vh, 42rem)';
        dlgEl.style.overflow = 'auto';

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

        // Add Escape key support (fallback mode only) and prevent listener buildup.
        var escHandler = (dlgEl as any)._appearanceEscHandler as ((e: KeyboardEvent) => void) | null;
        if (!escHandler) {
          escHandler = function (e) {
            if (e && e.key === 'Escape') closeAppearanceDialog();
          };
          (dlgEl as any)._appearanceEscHandler = escHandler;
        }
        try {
          document.removeEventListener('keydown', escHandler);
          document.addEventListener('keydown', escHandler);
        } catch (eEsc) {}

        // Move focus into the dialog for accessibility.
        var focusTarget =
          (dlgEl.querySelector('[autofocus]') as HTMLElement | null) ||
          (dlgEl.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement | null);
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
      if (typeof dlgEl.close === 'function') {
        try {
          dlgEl.close();
          return;
        } catch (e) {}
      }

      // Fallback close: mirror unlockScroll() behavior since <dialog> won't fire "close".
      try {
        dlgEl.removeAttribute('open');
        dlgEl.style.display = '';
        dlgEl.style.position = '';
        dlgEl.style.zIndex = '';
        dlgEl.style.left = '';
        dlgEl.style.top = '';
        dlgEl.style.transform = '';
        dlgEl.style.maxWidth = '';
        dlgEl.style.maxHeight = '';
        dlgEl.style.overflow = '';
      } catch (e2) {}
      try {
        if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      } catch (e3) {}

      // Remove fallback Escape handler and restore focus to the trigger.
      try {
        var escHandler = (dlgEl as any)._appearanceEscHandler;
        if (escHandler) {
          document.removeEventListener('keydown', escHandler);
          (dlgEl as any)._appearanceEscHandler = null;
        }
      } catch (e4) {}
      try {
        if (openBtnEl && openBtnEl.focus) setTimeout(function () { openBtnEl.focus(); }, 0);
      } catch (e5) {}

      unlockScroll();
    }

    openBtnEl.addEventListener('click', function () {
      openAppearanceDialog();
    });

    dlgEl.addEventListener('close', function () {
      unlockScroll();
      try {
        if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      } catch (e) {}
    });

    dlgEl.addEventListener('click', function (e) {
      if (e.target === dlgEl) {
        closeAppearanceDialog();
        return;
      }
      var t = e.target as any;
      var el = t && t.nodeType === 3 ? t.parentElement : t;
      if (el && typeof el.closest === 'function' && el.closest('[data-close-appearance-dialog]')) {
        closeAppearanceDialog();
      }
    });

    var paletteBtns = dlgEl.querySelectorAll('.palette-option[data-palette]');
    for (var k = 0; k < paletteBtns.length; k++) {
      paletteBtns[k].addEventListener('click', function (this: HTMLElement) {
        var id = this.getAttribute('data-palette');
        if (!id || !(window as any).ColorPaletteService || !(window as any).ColorPaletteService.applyPalette) return;
        (window as any).ColorPaletteService.applyPalette(id);
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
