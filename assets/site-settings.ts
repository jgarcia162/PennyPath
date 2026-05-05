/**
 * Sticky header settings (gear): dropdown panel, theme, print, demo toggle.
 * Next.js navigations replace header DOM nodes; callers must invoke `bindSiteSettings()`
 * whenever the markup mounts (and dispose on unmount) so IDs point at live elements.
 */

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

function initDropdown(signal: AbortSignal) {
  const trigger = document.getElementById('btn-site-settings') as HTMLButtonElement | null;
  const menu = document.getElementById('site-settings-menu') as HTMLElement | null;
  if (!trigger || !menu) return;
  const triggerEl = trigger;
  const menuEl = menu;

  triggerEl.addEventListener(
    'click',
    function (e) {
      e.stopPropagation();
      toggleMenu(menuEl, triggerEl);
    },
    { signal }
  );

  document.addEventListener(
    'click',
    function (e) {
      const wrap = triggerEl.closest('.site-header__settings');
      if (wrap && !wrap.contains(e.target as Node)) closeMenu(menuEl, triggerEl);
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key === 'Escape') closeMenu(menuEl, triggerEl);
    },
    { signal }
  );

  ['btn-print', 'btn-wipe-all-data', 'btn-open-appearance', 'btn-dev-lock'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      'click',
      function () {
        closeMenu(menuEl, triggerEl);
      },
      { signal }
    );
  });
}

function initTheme(signal: AbortSignal) {
  try {
    if ((window as any).ThemeService && (window as any).ThemeService.init) (window as any).ThemeService.init();
  } catch (_) {
    /* ignore */
  }
  const btn = document.getElementById('btn-toggle-theme') as HTMLButtonElement | null;
  if (!btn) return;
  syncThemeButtonLabel(btn);
  btn.addEventListener(
    'click',
    function () {
      try {
        if ((window as any).ThemeService && (window as any).ThemeService.toggleTheme) (window as any).ThemeService.toggleTheme();
      } catch (_) {
        /* ignore */
      }
      syncThemeButtonLabel(btn);
    },
    { signal }
  );
}

function initPrint(signal: AbortSignal) {
  const btn = document.getElementById('btn-print') as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener(
    'click',
    function () {
      try {
        window.print();
      } catch (_) {
        /* ignore */
      }
    },
    { signal }
  );
}

/** Keep in sync with `DEMO_MODE_STORAGE_KEY` in plan-data.js */
var DEMO_MODE_KEY = 'financial-plan.historyDemo';

function initDemoModeToggle(signal: AbortSignal) {
  const input = document.getElementById('demo-mode-toggle') as HTMLInputElement | null;
  if (!input) return;
  const inputEl = input;
  try {
    inputEl.checked = localStorage.getItem(DEMO_MODE_KEY) === '1';
  } catch (_) {
    /* ignore */
  }
  inputEl.addEventListener(
    'change',
    function () {
      try {
        localStorage.setItem(DEMO_MODE_KEY, inputEl.checked ? '1' : '0');
      } catch (_) {
        /* ignore */
      }
      location.reload();
    },
    { signal }
  );
}

/** Appearance dialog: palette picker + body scroll lock while open. */
function initAppearanceDialog(signal: AbortSignal) {
  const dlg = document.getElementById('appearance-dialog') as HTMLDialogElement | null;
  const openBtn = document.getElementById('btn-open-appearance') as HTMLButtonElement | null;
  if (!dlg || !openBtn) return;
  const dlgEl = dlg;
  const openBtnEl = openBtn;

  let scrollDepth = 0;
  let scrollY = 0;
  let backdropEl: HTMLElement | null = null;

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
    const root = document.documentElement;
    const prevSb = root.style.scrollBehavior;
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
    const svc = (window as any).ColorPaletteService;
    let current = svc && svc.getPalette ? svc.getPalette() : null;
    if (!current && svc && svc.PALETTES && svc.PALETTES.length && svc.PALETTES[0] && svc.PALETTES[0].id) {
      current = svc.PALETTES[0].id;
    }
    const opts = dlgEl.querySelectorAll('.palette-option[data-palette]');
    if (!current && opts.length && opts[0]) {
      current = opts[0].getAttribute('data-palette');
    }
    for (let i = 0; i < opts.length; i++) {
      const el = opts[i] as HTMLElement;
      const id = el.getAttribute('data-palette');
      const on = id === current;
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.classList.toggle('palette-option--current', on);
    }
  }

  function openAppearanceDialog() {
    syncPaletteOptions();

    if (typeof (dlgEl as any).showModal === 'function') {
      if (dlgEl.open === true || (typeof (dlgEl as any).hasAttribute === 'function' && dlgEl.hasAttribute('open'))) {
        lockScroll();
        return true;
      }
      try {
        (dlgEl as any).showModal();
        lockScroll();
        return true;
      } catch {
        /* fallthrough */
      }
    }

    try {
      dlgEl.setAttribute('open', '');
      dlgEl.setAttribute('aria-modal', 'true');
      if (!dlgEl.getAttribute('role')) dlgEl.setAttribute('role', 'dialog');

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

      let escHandler = (dlgEl as any)._appearanceEscHandler as ((e: KeyboardEvent) => void) | null;
      if (!escHandler) {
        escHandler = function (e: KeyboardEvent) {
          if (e.key === 'Escape') closeAppearanceDialog();
        };
        (dlgEl as any)._appearanceEscHandler = escHandler;
      }
      try {
        document.removeEventListener('keydown', escHandler);
        document.addEventListener('keydown', escHandler);
      } catch {
        /* ignore */
      }

      const focusTarget =
        (dlgEl.querySelector('[autofocus]') as HTMLElement | null) ||
        (dlgEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement | null);
      if (focusTarget?.focus) focusTarget.focus();

      lockScroll();
      return true;
    } catch (e3) {
      try {
        console.error('Appearance dialog failed to open (no native <dialog> support).', e3);
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  function closeAppearanceDialog() {
    if (typeof dlgEl.close === 'function') {
      try {
        dlgEl.close();
        return;
      } catch {
        /* fallthrough */
      }
    }

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
    } catch {
      /* ignore */
    }
    try {
      if (backdropEl?.parentNode) backdropEl.parentNode.removeChild(backdropEl);
    } catch {
      /* ignore */
    }

    try {
      const escHandler = (dlgEl as any)._appearanceEscHandler;
      if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        (dlgEl as any)._appearanceEscHandler = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (openBtnEl?.focus) setTimeout(() => openBtnEl.focus(), 0);
    } catch {
      /* ignore */
    }

    unlockScroll();
  }

  openBtnEl.addEventListener('click', openAppearanceDialog, { signal });

  dlgEl.addEventListener(
    'close',
    function () {
      unlockScroll();
      try {
        if (backdropEl?.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      } catch {
        /* ignore */
      }
    },
    { signal }
  );

  dlgEl.addEventListener(
    'click',
    function (e) {
      if (e.target === dlgEl) {
        closeAppearanceDialog();
        return;
      }
      const t = e.target as any;
      const el = t && t.nodeType === 3 ? t.parentElement : t;
      if (el && typeof el.closest === 'function' && el.closest('[data-close-appearance-dialog]')) {
        closeAppearanceDialog();
      }
    },
    { signal }
  );

  const paletteBtns = dlgEl.querySelectorAll('.palette-option[data-palette]');
  for (let k = 0; k < paletteBtns.length; k++) {
    paletteBtns[k].addEventListener(
      'click',
      function (this: HTMLElement) {
        const id = this.getAttribute('data-palette');
        if (!id || !(window as any).ColorPaletteService || !(window as any).ColorPaletteService.applyPalette) return;
        (window as any).ColorPaletteService.applyPalette(id);
        syncPaletteOptions();
      },
      { signal }
    );
  }

  window.addEventListener('pennypath:palettechange', syncPaletteOptions as EventListener, { signal });

  signal.addEventListener('abort', function () {
    try {
      if (dlgEl.open) closeAppearanceDialog();
    } catch {
      /* ignore */
    }
  });
}

function bindInternals(signal: AbortSignal) {
  initDropdown(signal);
  initTheme(signal);
  initPrint(signal);
  initDemoModeToggle(signal);
  initAppearanceDialog(signal);
}

/**
 * Wire header settings to the **current** DOM (by ID). Call after mount; return value
 * disposes listeners (e.g. React `useEffect` cleanup).
 */
export function bindSiteSettings(): () => void {
  const ac = new AbortController();
  bindInternals(ac.signal);
  return () => ac.abort();
}
