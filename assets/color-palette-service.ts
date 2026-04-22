/**
 * Site-wide color palettes: reads/writes localStorage and sets `data-color-palette` on `<html>`.
 * Default palette is Pastel (no attribute). Other palettes set `data-color-palette="<id>"`.
 * Load after `theme-service.js` so theme + palette compose.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'financial-plan-v3-aggressive.palette';
  const ATTR = 'data-color-palette';
  const DEFAULT_ID = 'pastel';

  type PaletteId = 'pastel' | 'classic' | 'ocean' | 'forest' | 'sunset';
  interface PaletteDef { id: PaletteId; name: string; blurb: string }

  const PALETTES: PaletteDef[] = [
    { id: 'pastel', name: 'Pastel', blurb: 'Soft blues, warm cream' },
    { id: 'classic', name: 'Classic', blurb: 'Navy, gold, sage' },
    { id: 'ocean', name: 'Ocean', blurb: 'Teal, sea glass, sand' },
    { id: 'forest', name: 'Forest', blurb: 'Moss, bark, honey' },
    { id: 'sunset', name: 'Sunset', blurb: 'Rose, peach, amber' },
  ];

  const VALID: PaletteId[] = PALETTES.map(function (p) {
    return p.id;
  });

  function normalizePalette(id: unknown): PaletteId {
    const s = String(id || '');
    return (VALID as string[]).indexOf(s) !== -1 ? (s as PaletteId) : DEFAULT_ID;
  }

  function applyPalette(id: unknown): PaletteId {
    const palette = normalizePalette(id);
    var root = document.documentElement;
    if (palette === DEFAULT_ID) {
      root.removeAttribute(ATTR);
    } else {
      root.setAttribute(ATTR, palette);
    }
    try {
      localStorage.setItem(STORAGE_KEY, palette);
    } catch (e) {}
    try {
      window.dispatchEvent(
        new CustomEvent('pennypath:palettechange', { detail: { palette: palette } })
      );
    } catch (e) {}
    return palette;
  }

  function getPalette(): PaletteId {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) return normalizePalette(s);
    } catch (e) {}
    return DEFAULT_ID;
  }

  function init(): void {
    applyPalette(getPalette());
  }

  (window as any).ColorPaletteService = {
    init: init,
    applyPalette: applyPalette,
    getPalette: getPalette,
    normalizePalette: normalizePalette,
    PALETTES: PALETTES,
    STORAGE_KEY: STORAGE_KEY,
  };

  try {
    init();
  } catch (e) {}
})();
