/**
 * Site-wide color palettes: reads/writes localStorage and sets `data-color-palette` on `<html>`.
 * Default palette is Pastel (no attribute). Other palettes set `data-color-palette="<id>"`.
 * Load after `theme-service.js` so theme + palette compose.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'financial-plan-v3-aggressive.palette';
  var ATTR = 'data-color-palette';
  var DEFAULT_ID = 'pastel';

  var PALETTES = [
    { id: 'pastel', name: 'Pastel', blurb: 'Soft blues, warm cream' },
    { id: 'classic', name: 'Classic', blurb: 'Navy, gold, sage' },
    { id: 'ocean', name: 'Ocean', blurb: 'Teal, sea glass, sand' },
    { id: 'forest', name: 'Forest', blurb: 'Moss, bark, honey' },
    { id: 'sunset', name: 'Sunset', blurb: 'Rose, peach, amber' },
  ];

  var VALID = PALETTES.map(function (p) {
    return p.id;
  });

  function normalizePalette(id) {
    return VALID.indexOf(id) !== -1 ? id : DEFAULT_ID;
  }

  function applyPalette(id) {
    id = normalizePalette(id);
    var root = document.documentElement;
    if (id === DEFAULT_ID) {
      root.removeAttribute(ATTR);
    } else {
      root.setAttribute(ATTR, id);
    }
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
    try {
      window.dispatchEvent(
        new CustomEvent('pennypath:palettechange', { detail: { palette: id } })
      );
    } catch (e) {}
    return id;
  }

  function getPalette() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) return normalizePalette(s);
    } catch (e) {}
    return DEFAULT_ID;
  }

  function init() {
    applyPalette(getPalette());
  }

  window.ColorPaletteService = {
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
