/**
 * Pure helpers for month wrap-up (destination month, YYYY-MM arithmetic).
 */

import type { YyyyMm } from '../../types/index.js';
import { monthLabel, yyyyMmFromDate } from './monthly-activity';

export function isYyyyMm(s: unknown): s is YyyyMm {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

/** @param ym YYYY-MM */
export function nextYyyyYm(ym: string, fallbackNow?: Date): YyyyMm {
  const p = String(ym).split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return yyyyMmFromDate(fallbackNow ?? new Date()) as YyyyMm;
  }
  return yyyyMmFromDate(new Date(y, m, 1)) as YyyyMm;
}

/**
 * Month to start tracking after wrapping `workingYm`.
 * If the working month is behind the calendar, jump to the current month
 * instead of stepping only one month forward.
 */
export function defaultWrapDestinationYm(workingYm: string, now?: Date): YyyyMm {
  const next = nextYyyyYm(workingYm, now);
  const current = yyyyMmFromDate(now ?? new Date()) as YyyyMm;
  if (isYyyyMm(workingYm) && current > workingYm) return current;
  return next;
}

/**
 * Months the user can jump to after wrapping `workingYm` (exclusive of the wrapped month).
 * Covers catching up to the current calendar month plus a short look-ahead.
 */
export function listWrapDestinationMonths(workingYm: string, now?: Date): YyyyMm[] {
  const next = nextYyyyYm(workingYm, now);
  const current = yyyyMmFromDate(now ?? new Date()) as YyyyMm;
  const endYm = current > next ? current : next;
  const endParts = String(endYm).split('-');
  const endY = Number(endParts[0]);
  const endM = Number(endParts[1]);
  const endDate = new Date(endY, endM - 1 + 6, 1);

  const nextParts = String(next).split('-');
  const out: YyyyMm[] = [];
  let cursor = new Date(Number(nextParts[0]), Number(nextParts[1]) - 1, 1);
  while (cursor.getTime() <= endDate.getTime()) {
    out.push(yyyyMmFromDate(cursor) as YyyyMm);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

export function wrapDestinationOptionLabel(ym: string, now?: Date): string {
  const current = yyyyMmFromDate(now ?? new Date());
  const label = monthLabel(ym);
  if (ym === current) return label + ' (this month)';
  return label;
}
