(function () {
  'use strict';

  const STORAGE_KEY = 'financial-plan-v3-aggressive.checkins';
  const DEMO_MODE_KEY = 'financial-plan.historyDemo';

  function isDemoMode() {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function safeLoad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function safeSave(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newId() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function list() {
    return safeLoad()
      .filter(function (e) { return e && typeof e === 'object'; })
      .map(function (e) {
        return {
          id: String(e.id || newId()),
          date: String(e.date || ''),
          note: String(e.note || ''),
          createdAt: String(e.createdAt || nowIso()),
        };
      })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  function add(entry) {
    if (isDemoMode()) return null;
    const items = safeLoad();
    const next = {
      id: newId(),
      date: String((entry && entry.date) || ''),
      note: String((entry && entry.note) || '').trim(),
      createdAt: nowIso(),
    };
    items.push(next);
    safeSave(items);
    return next;
  }

  function remove(id) {
    if (isDemoMode()) return false;
    const items = safeLoad();
    const sid = String(id || '');
    const next = items.filter(function (e) { return e && String(e.id) !== sid; });
    safeSave(next);
    return next.length !== items.length;
  }

  function clearAll() {
    safeSave([]);
  }

  window.CheckInService = {
    STORAGE_KEY: STORAGE_KEY,
    list: list,
    add: add,
    remove: remove,
    clearAll: clearAll,
  };
})();

