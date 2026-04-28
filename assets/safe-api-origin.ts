/**
 * Validates optional localStorage API base (real-estate-plan.apiBase) before use.
 * Only same page origin, loopback hosts, or __PENNYPATH_ALLOWED_API_ORIGINS__ entries are accepted;
 * otherwise falls back to same-origin or http://127.0.0.1:8787.
 */
(function (global) {
  'use strict';

  var DEFAULT_DEV_ORIGIN = 'http://127.0.0.1:8787';

  function normalizeOrigin(s: unknown, base?: string): string | null {
    try {
      return new URL(String(s).trim(), base || DEFAULT_DEV_ORIGIN).origin;
    } catch (e) {
      return null;
    }
  }

  function isLoopbackOrigin(origin: string): boolean {
    try {
      var u = new URL(origin);
      var h = u.hostname.toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
    } catch (e) {
      return false;
    }
  }

  function sameDocumentOrigin(): string | null {
    try {
      if ((global as any).location && /^https?:$/.test((global as any).location.protocol)) {
        return normalizeOrigin((global as any).location.href);
      }
    } catch (e) {}
    return null;
  }

  function isExplicitlyListed(origin: string): boolean {
    var extra = (global as any).__PENNYPATH_ALLOWED_API_ORIGINS__;
    if (!Array.isArray(extra)) return false;
    for (var i = 0; i < extra.length; i++) {
      var o = extra[i] != null ? normalizeOrigin(String(extra[i])) : null;
      if (o && o === origin) return true;
    }
    return false;
  }

  function isApprovedOrigin(candidate: string | null, same: string | null): boolean {
    if (!candidate) return false;
    if (same && candidate === same) return true;
    if (isLoopbackOrigin(candidate)) return true;
    if (isExplicitlyListed(candidate)) return true;
    return false;
  }

  function getSafeApiBase(lsKey?: string): string {
    var key = lsKey || 'real-estate-plan.apiBase';
    var same = sameDocumentOrigin();
    var fallback = (same || DEFAULT_DEV_ORIGIN).replace(/\/$/, '');

    var custom = null;
    try {
      if ((global as any).localStorage) custom = (global as any).localStorage.getItem(key);
    } catch (e) {}

    if (!custom || !String(custom).trim()) {
      return fallback;
    }

    var parsed = normalizeOrigin(String(custom).trim(), same || fallback);
    if (!parsed) return fallback;

    if (isApprovedOrigin(parsed, same)) {
      var chosen = parsed.replace(/\/$/, '');
      if (same) {
        var sameTrim = same.replace(/\/$/, '');
        // Real (non-loopback) page: never send API calls to a leftover dev loopback URL in storage.
        if (!isLoopbackOrigin(sameTrim) && isLoopbackOrigin(chosen)) {
          return sameTrim;
        }
        // Two loopback origins (e.g. Next on :3000 vs old `npm run research-server` on :8787): follow the tab.
        if (isLoopbackOrigin(sameTrim) && isLoopbackOrigin(chosen) && chosen !== sameTrim) {
          return sameTrim;
        }
      }
      return chosen;
    }
    return fallback;
  }

  (global as any).PennypathApiOrigin = {
    getSafeApiBase: getSafeApiBase,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
