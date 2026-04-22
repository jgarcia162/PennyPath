/**
 * Default ISO timestamp for new debt payments / savings deposits from editors.
 * Uses the dashboard view month when it differs from “today’s” calendar month.
 *
 * Converted from `default-log-at.js` with no logic changes.
 */

import type { IsoDateTimeString, YyyyMm } from '../../types/index.js';
import { PLAN } from './plan-data.js';
import { getDashboardViewMonthYm } from './plan-derived.js';
import { yyyyMmFromDate } from './monthly-activity.js';

export function defaultLogAtIsoForEdits(): IsoDateTimeString {
  const ym = getDashboardViewMonthYm(PLAN) as YyyyMm;
  const todayYm = yyyyMmFromDate(new Date()) as YyyyMm;
  if (ym === todayYm) return new Date().toISOString();
  const p = ym.split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  return new Date(y, m - 1, 15, 12, 0, 0).toISOString();
}

