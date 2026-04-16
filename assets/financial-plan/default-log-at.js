/**
 * Default ISO timestamp for new debt payments / savings deposits from editors.
 * Uses the dashboard view month when it differs from “today’s” calendar month.
 */

import { PLAN } from './plan-data.js';
import { getDashboardViewMonthYm } from './plan-derived.js';
import { yyyyMmFromDate } from './monthly-activity.js';

export function defaultLogAtIsoForEdits() {
  const ym = getDashboardViewMonthYm(PLAN);
  const todayYm = yyyyMmFromDate(new Date());
  if (ym === todayYm) return new Date().toISOString();
  const p = ym.split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  return new Date(y, m - 1, 15, 12, 0, 0).toISOString();
}
