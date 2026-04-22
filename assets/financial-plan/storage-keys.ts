/**
 * localStorage keys used by AI features.
 *
 * Converted from `storage-keys.js` with no runtime logic changes.
 */

import type { AiProviderStorageKeys } from '../../types/index.js';

/** localStorage key for cached AI debt payoff plan text (v1). */
export const AI_PAYOFF_PLAN_CACHE_LS_KEY: AiProviderStorageKeys['AI_PAYOFF_PLAN_CACHE_LS_KEY'] =
  'pennypath.aiPayoffPlan.v1';

/** Last generated bill + debt payment calendar JSON (v1). */
export const AI_BILL_CALENDAR_CACHE_LS_KEY: AiProviderStorageKeys['AI_BILL_CALENDAR_CACHE_LS_KEY'] =
  'pennypath.aiBillCalendar.v1';

/** User CSV column names for bill calendar (name, amount, due day headers). */
export const AI_BILL_CALENDAR_COLUMNS_LS_KEY: AiProviderStorageKeys['AI_BILL_CALENDAR_COLUMNS_LS_KEY'] =
  'pennypath.aiBillCalendarColumns.v1';

