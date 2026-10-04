import type { FinancialCalendarEvent, FinancialCalendarResponse, BillCalendarCache, BillCalendarVersion } from '../../types/index.js';

export const MAX_BILL_CALENDAR_VERSIONS = 12;

export type { BillCalendarCache, BillCalendarVersion };

export function emptyBillCalendarCache(): BillCalendarCache {
  return { currentId: '', versions: [] };
}

export function isBillCalendarHistoryPayload(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && Array.isArray((raw as { versions?: unknown }).versions);
}

function newCalendarVersionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return 'cal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function asEvents(raw: unknown): FinancialCalendarEvent[] {
  return Array.isArray(raw) ? (raw as FinancialCalendarEvent[]) : [];
}

/**
 * Bill calendar cache has been stored three ways:
 * - `{ currentId, versions }` (history of generated calendars)
 * - `{ notes, events }` (canonical `FinancialCalendarResponse`)
 * - `{ at, data: { notes, events } }` (legacy wrapper used by generate)
 * Accept all three so a logout/login still restores the grid.
 */
export function unwrapBillCalendarCache(raw: unknown): FinancialCalendarResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  if (isBillCalendarHistoryPayload(raw)) {
    const current = currentBillCalendar(parseBillCalendarCache(raw));
    if (!current || !current.events.length) return null;
    return { notes: current.notes, events: current.events };
  }
  const obj = raw as { events?: unknown; notes?: unknown; data?: unknown };
  const inner =
    Array.isArray(obj.events) ? obj : obj.data && typeof obj.data === 'object' ? (obj.data as { events?: unknown; notes?: unknown }) : null;
  if (!inner || !Array.isArray(inner.events)) return null;
  return {
    notes: typeof inner.notes === 'string' ? inner.notes : '',
    events: asEvents(inner.events),
  };
}

function normalizeVersion(raw: unknown): BillCalendarVersion | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { id?: unknown; at?: unknown; notes?: unknown; events?: unknown; data?: unknown };
  const inner = Array.isArray(obj.events)
    ? obj
    : obj.data && typeof obj.data === 'object'
      ? (obj.data as { notes?: unknown; events?: unknown })
      : null;
  if (!inner || !Array.isArray(inner.events) || !inner.events.length) return null;
  const at = typeof obj.at === 'string' && obj.at ? obj.at : new Date().toISOString();
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : newCalendarVersionId(),
    at,
    notes: typeof inner.notes === 'string' ? inner.notes : '',
    events: asEvents(inner.events),
  };
}

export function parseBillCalendarCache(raw: unknown): BillCalendarCache {
  if (!raw || typeof raw !== 'object') return emptyBillCalendarCache();
  const obj = raw as { currentId?: unknown; versions?: unknown; at?: unknown };
  if (Array.isArray(obj.versions)) {
    const versions: BillCalendarVersion[] = [];
    for (let i = 0; i < obj.versions.length; i++) {
      const version = normalizeVersion(obj.versions[i]);
      if (version) versions.push(version);
    }
    const currentId =
      typeof obj.currentId === 'string' && versions.some(function (v) {
        return v.id === obj.currentId;
      })
        ? obj.currentId
        : versions[0]
          ? versions[0].id
          : '';
    return { currentId, versions };
  }
  const single = unwrapBillCalendarCache(raw);
  if (!single || !single.events.length) return emptyBillCalendarCache();
  const at = typeof obj.at === 'string' && obj.at ? obj.at : new Date().toISOString();
  const version: BillCalendarVersion = {
    id: newCalendarVersionId(),
    at,
    notes: single.notes,
    events: single.events,
  };
  return { currentId: version.id, versions: [version] };
}

export function currentBillCalendar(cache: BillCalendarCache): BillCalendarVersion | null {
  if (!cache || !Array.isArray(cache.versions) || !cache.versions.length) return null;
  const match = cache.versions.find(function (v) {
    return v.id === cache.currentId;
  });
  return match || cache.versions[0] || null;
}

export function appendBillCalendarVersion(
  cache: BillCalendarCache,
  cal: { notes?: string; events?: unknown },
  at?: string
): BillCalendarCache {
  const version: BillCalendarVersion = {
    id: newCalendarVersionId(),
    at: at || new Date().toISOString(),
    notes: typeof cal.notes === 'string' ? cal.notes : '',
    events: asEvents(cal.events),
  };
  const versions = [version].concat(cache.versions || []).slice(0, MAX_BILL_CALENDAR_VERSIONS);
  return { currentId: version.id, versions };
}

export function selectBillCalendarVersion(cache: BillCalendarCache, id: string): BillCalendarCache {
  if (!cache.versions.some(function (v) {
    return v.id === id;
  })) {
    return cache;
  }
  return { currentId: id, versions: cache.versions };
}

export function removeBillCalendarVersion(cache: BillCalendarCache, id: string): BillCalendarCache {
  const versions = cache.versions.filter(function (v) {
    return v.id !== id;
  });
  const currentId = cache.currentId === id ? (versions[0] ? versions[0].id : '') : cache.currentId;
  return { currentId, versions };
}

function monthKeysFromEvents(events: FinancialCalendarEvent[]): string[] {
  const set: Record<string, true> = {};
  events.forEach(function (ev) {
    const m = String(ev && ev.date ? ev.date : '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) set[m] = true;
  });
  return Object.keys(set).sort();
}

function formatYearMonth(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5, 7), 10) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return ym;
  return new Date(y, m, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

export function billCalendarVersionTitle(version: BillCalendarVersion): string {
  const months = monthKeysFromEvents(version.events || []);
  if (!months.length) return 'Saved calendar';
  if (months.length === 1) return formatYearMonth(months[0]);
  return formatYearMonth(months[0]) + ' – ' + formatYearMonth(months[months.length - 1]);
}

export function billCalendarVersionSubtitle(version: BillCalendarVersion): string {
  const n = Array.isArray(version.events) ? version.events.length : 0;
  let when = '';
  try {
    const dt = new Date(version.at);
    if (!Number.isNaN(dt.getTime())) {
      when = dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  } catch {
    when = '';
  }
  const count = n + ' event' + (n === 1 ? '' : 's');
  return when ? when + ' · ' + count : count;
}
