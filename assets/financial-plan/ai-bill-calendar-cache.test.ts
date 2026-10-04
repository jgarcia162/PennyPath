import { describe, it, expect } from 'vitest';
import {
  unwrapBillCalendarCache,
  parseBillCalendarCache,
  appendBillCalendarVersion,
  selectBillCalendarVersion,
  removeBillCalendarVersion,
  currentBillCalendar,
  billCalendarVersionTitle,
  MAX_BILL_CALENDAR_VERSIONS,
} from './ai-bill-calendar-cache';

const events = [
  { date: '2026-10-01' as const, kind: 'bill' as const, label: 'Rent', amount: 1200, debtName: '' },
];

const laterEvents = [
  { date: '2026-11-15' as const, kind: 'debt' as const, label: 'Card', amount: 200, debtName: 'Visa' },
];

describe('unwrapBillCalendarCache', () => {
  it('returns canonical { notes, events } payloads', () => {
    const out = unwrapBillCalendarCache({ notes: 'ok', events });
    expect(out?.notes).toBe('ok');
    expect(out?.events).toEqual(events);
  });

  it('unwraps the legacy { at, data } shape saved on generate', () => {
    const out = unwrapBillCalendarCache({
      at: '2026-10-03T14:00:00.000Z',
      data: { notes: 'saved', events },
    });
    expect(out?.notes).toBe('saved');
    expect(out?.events).toEqual(events);
  });

  it('returns the current version from a history payload', () => {
    const out = unwrapBillCalendarCache({
      currentId: 'b',
      versions: [
        { id: 'a', at: '2026-09-01T00:00:00.000Z', notes: 'old', events },
        { id: 'b', at: '2026-10-01T00:00:00.000Z', notes: 'new', events: laterEvents },
      ],
    });
    expect(out?.notes).toBe('new');
    expect(out?.events).toEqual(laterEvents);
  });

  it('returns null when events are missing so a stale row does not render empty', () => {
    expect(unwrapBillCalendarCache({ at: '2026-10-03T14:00:00.000Z', data: { notes: 'x' } })).toBeNull();
    expect(unwrapBillCalendarCache(null)).toBeNull();
    expect(unwrapBillCalendarCache({})).toBeNull();
  });
});

describe('parseBillCalendarCache', () => {
  it('wraps a single calendar into a one-item history', () => {
    const cache = parseBillCalendarCache({ notes: 'ok', events });
    expect(cache.versions).toHaveLength(1);
    expect(cache.versions[0].notes).toBe('ok');
    expect(cache.versions[0].events).toEqual(events);
    expect(cache.currentId).toBe(cache.versions[0].id);
  });

  it('keeps generatedAt from the legacy wrapper', () => {
    const cache = parseBillCalendarCache({
      at: '2026-10-03T14:00:00.000Z',
      data: { notes: 'saved', events },
    });
    expect(cache.versions[0].at).toBe('2026-10-03T14:00:00.000Z');
  });

  it('reads an existing history payload', () => {
    const cache = parseBillCalendarCache({
      currentId: 'keep',
      versions: [
        { id: 'keep', at: '2026-10-01T00:00:00.000Z', notes: 'a', events },
        { id: 'other', at: '2026-09-01T00:00:00.000Z', notes: 'b', events: laterEvents },
      ],
    });
    expect(cache.currentId).toBe('keep');
    expect(cache.versions).toHaveLength(2);
  });
});

describe('bill calendar history mutations', () => {
  it('prepends a new version and caps history', () => {
    let cache = parseBillCalendarCache({ notes: 'first', events });
    for (let i = 0; i < MAX_BILL_CALENDAR_VERSIONS + 2; i++) {
      cache = appendBillCalendarVersion(cache, { notes: 'n' + i, events: laterEvents }, '2026-10-03T00:00:00.000Z');
    }
    expect(cache.versions).toHaveLength(MAX_BILL_CALENDAR_VERSIONS);
    expect(cache.versions[0].notes).toBe('n' + (MAX_BILL_CALENDAR_VERSIONS + 1));
    expect(cache.currentId).toBe(cache.versions[0].id);
  });

  it('selects and removes versions, falling back to the newest remaining', () => {
    const first = parseBillCalendarCache({ notes: 'first', events });
    const withSecond = appendBillCalendarVersion(first, { notes: 'second', events: laterEvents });
    const selected = selectBillCalendarVersion(withSecond, first.versions[0].id);
    expect(currentBillCalendar(selected)?.notes).toBe('first');
    const removed = removeBillCalendarVersion(selected, first.versions[0].id);
    expect(currentBillCalendar(removed)?.notes).toBe('second');
    expect(removed.versions).toHaveLength(1);
  });
});

describe('billCalendarVersionTitle', () => {
  it('summarizes the month span of events', () => {
    expect(
      billCalendarVersionTitle({
        id: 'x',
        at: '2026-10-03T00:00:00.000Z',
        notes: '',
        events: [
          { date: '2026-10-01', kind: 'bill', label: 'Rent', amount: 1, debtName: '' },
          { date: '2026-12-15', kind: 'bill', label: 'Ins', amount: 1, debtName: '' },
        ],
      })
    ).toBe('Oct 2026 – Dec 2026');
  });
});
