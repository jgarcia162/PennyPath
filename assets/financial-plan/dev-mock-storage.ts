/**
 * Clears Financial Plan–related localStorage keys and seeds mock balances + check-ins for UI development.
 *
 * Converted from `dev-mock-storage.js` with no logic changes.
 */

import type { CheckInServiceEntry, FinancialPlan, MoneyLedgerItem, SavingsAccount } from '../../types/index.js';
import {
  STORAGE_KEY,
  BADGES_STORAGE_KEY,
  TOGGLE_GOAL2_EDITOR_KEY,
  TOGGLE_GOAL3_EDITOR_KEY,
  DEMO_MODE_STORAGE_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
} from './plan-data';
import { applyPlanPayloadFromObject } from './persistence';

export const CHECKIN_STORAGE_KEY = 'financial-plan-v3-aggressive.checkins' as const;
export const THEME_STORAGE_KEY = 'financial-plan-v3-aggressive.theme' as const;

/** Keys removed before seeding (Financial Plan app only — does not touch Real Estate keys). */
export const FINANCIAL_PLAN_STORAGE_KEYS = [
  STORAGE_KEY,
  CHECKIN_STORAGE_KEY,
  THEME_STORAGE_KEY,
  TOGGLE_GOAL2_EDITOR_KEY,
  TOGGLE_GOAL3_EDITOR_KEY,
  BADGES_STORAGE_KEY,
  DEMO_MODE_STORAGE_KEY,
  MONTH_WRAP_ROLLBACK_KEY,
  MONTH_WRAP_ARCHIVES_KEY,
] as const;

/** Months of payment/deposit history to generate (~1.5 years). */
export const MOCK_HISTORY_MONTHS = 18 as const;

function newId(prefix: string): string {
  return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function isoLocal(y: number, mo: number, day: number, h?: number | null, min?: number): string {
  return new Date(y, mo, Math.min(28, day), h == null ? 12 : h, min || 0, 0).toISOString();
}

/**
 * Multiple payments per month (realistic staggered dates).
 * @param templates
 */
function buildPaymentHistoryFromTemplates(
  monthsBack: number,
  templates: { amountBase: number; day: number; h?: number }[]
): MoneyLedgerItem[] {
  const out: MoneyLedgerItem[] = [];
  const n = monthsBack | 0;
  const now = new Date();
  for (let m = 0; m < n; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    templates.forEach(function (t, idx) {
      const jitter = (m * 17 + idx * 41) % 55;
      const amt = t.amountBase + jitter + (m % 4) * 25;
      const day = Math.min(28, t.day + ((m + idx) % 3));
      out.push({
        id: newId('ph_'),
        amount: Math.round(amt * 100) / 100,
        at: isoLocal(y, mo, day, t.h != null ? t.h : 9 + (idx % 8), (idx * 7) % 60),
      });
    });
  }
  return out;
}

function buildCarPaymentHistory(monthsBack: number): MoneyLedgerItem[] {
  const out: MoneyLedgerItem[] = [];
  const n = Math.min(monthsBack, 16);
  const now = new Date();
  for (let m = 0; m < n; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    out.push({
      id: newId('ph_'),
      amount: 485.2 + (m % 5) * 2,
      at: isoLocal(y, mo, 12 + (m % 5)),
    });
    if (m % 3 !== 1) {
      out.push({
        id: newId('ph_'),
        amount: 120 + (m % 4) * 15,
        at: isoLocal(y, mo, 25),
      });
    }
  }
  return out;
}

function buildStudentPaymentHistory(monthsBack: number): MoneyLedgerItem[] {
  const out: MoneyLedgerItem[] = [];
  const n = monthsBack | 0;
  const now = new Date();
  for (let m = 0; m < n; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    out.push({
      id: newId('ph_'),
      amount: 318.75 + (m % 6) * 5,
      at: isoLocal(y, mo, 15),
    });
  }
  return out;
}

/**
 * Several deposits per month per account (different days).
 */
function buildRichDepositHistory(
  monthsBack: number,
  spec: { base: number; days: number[]; mult?: number }
): MoneyLedgerItem[] {
  const out: MoneyLedgerItem[] = [];
  const n = monthsBack | 0;
  const now = new Date();
  const mult = spec.mult != null ? spec.mult : 1;
  for (let m = 0; m < n; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    spec.days.forEach(function (day, idx) {
      const jitter = ((m * 13 + idx * 29) % 47) * mult;
      const amt = spec.base + jitter + m * 3 * mult;
      const dom = Math.min(28, day + (m % 2));
      out.push({
        id: newId('dep_'),
        amount: Math.round(amt * 100) / 100,
        at: isoLocal(y, mo, dom, 14 + idx, (idx * 11) % 60),
      });
    });
  }
  return out;
}

/**
 * Payload shape matches persistence.savePlanOverrides().
 */
export function buildMockBalancesPayload(): Record<string, unknown> {
  const months = MOCK_HISTORY_MONTHS;

  const ccPayments = buildPaymentHistoryFromTemplates(months, [
    { amountBase: 2750, day: 4 },
    { amountBase: 420, day: 11 },
    { amountBase: 195, day: 18 },
    { amountBase: 88, day: 24 },
    { amountBase: 3500, day: 7 },
  ]);

  const carPayments = buildCarPaymentHistory(months);
  const studentPayments = buildStudentPaymentHistory(months);

  const hysaDep = buildRichDepositHistory(months, { base: 380, days: [2, 9, 17, 24], mult: 1.2 });
  const joseDep = buildRichDepositHistory(months, { base: 95, days: [5, 20], mult: 0.85 });
  const sherDep = buildRichDepositHistory(months, { base: 210, days: [6, 14, 22], mult: 1 });
  const vacationDep = buildRichDepositHistory(months, { base: 75, days: [3, 16], mult: 0.6 });
  const kidsDep = buildRichDepositHistory(months, { base: 150, days: [1, 15], mult: 0.9 });
  const ibondsDep = buildRichDepositHistory(Math.min(12, months), { base: 50, days: [10], mult: 0.5 });

  const hysaCurrent = 27420.55;
  const joseCurrent = 4520;
  const sherCurrent = 21400;
  const vacationCurrent = 3180.25;
  const kidsCurrent = 8920;
  const ibondsCurrent = 2400;

  const savingsAccounts: Array<Pick<SavingsAccount, 'id' | 'name' | 'current' | 'apyPct' | 'depositHistory'>> = [
    { id: 'hysa', name: 'Joint Savings', current: hysaCurrent, apyPct: 3.25, depositHistory: hysaDep },
    { id: 'jose', name: 'Avery — personal', current: joseCurrent, apyPct: 4.15, depositHistory: joseDep },
    { id: 'sher', name: 'Jordan — personal', current: sherCurrent, apyPct: 0, depositHistory: sherDep },
    { id: 'vacation', name: 'Vacation fund', current: vacationCurrent, apyPct: 3.5, depositHistory: vacationDep },
    { id: 'kids', name: 'Kids — 529', current: kidsCurrent, apyPct: 0, depositHistory: kidsDep },
    { id: 'ibonds', name: 'I-Bonds ladder', current: ibondsCurrent, apyPct: 0, depositHistory: ibondsDep },
  ];

  return {
    hysaBalance: hysaCurrent,
    joseSavings: joseCurrent,
    sherlynaSavings: sherCurrent,
    savingsAccounts,
    debts: [
      {
        id: 'cc',
        name: 'Credit Cards',
        current: 19880,
        paidOff: 12400,
        aprPct: 0,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: ccPayments,
      },
      {
        id: 'car',
        name: 'Car loan',
        current: 6420,
        paidOff: 3580,
        aprPct: 5.9,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: carPayments,
      },
      {
        id: 'student',
        name: 'Student loan',
        current: 14200,
        paidOff: 6800,
        aprPct: 4.25,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: studentPayments,
      },
    ],
  };
}

export function buildMockCheckins(): CheckInServiceEntry[] {
  const notes = [
    'Reviewed budget — on track for debt snowball.',
    'Emergency fund discussion; bumped HYSA auto-transfer.',
    'Quarterly goals check with partner.',
    'Paid extra on CC after bonus.',
    'Adjusted fun budget after travel.',
    'Logged all payments for the month.',
    'Reviewed payoff timeline — morale high.',
    'Synced on holiday spending cap.',
    'Reconciled accounts; no surprises.',
    'Plan for tax refund allocation.',
    'Car insurance renewal — shopped rates.',
    '529 contribution increased for kids.',
    'Vacation fund: set summer target.',
    'Student loan: checked PSLF progress.',
    'I-Bonds purchase logged.',
    'Extra CC payment from side gig.',
    'Mid-year net worth snapshot.',
    'Debt avalanche order confirmed.',
    'Savings rate: 22% this month.',
    'Reviewed credit report — clean.',
    'Holiday budget — started sinking fund.',
    'Property tax escrow true-up.',
    'Medical FSA: used remaining balance.',
    'Year-end charitable giving plan.',
    'Mortgage vs invest discussion (N/A).',
    'Quarterly investment rebalance noted.',
    '529: age-based glide path OK.',
    'Emergency fund: 8 months covered.',
    'Side income: deposited to vacation.',
    'Annual insurance review complete.',
    'Goals: debt under $20k on CC.',
  ];
  const out: CheckInServiceEntry[] = [];
  const now = new Date();
  let noteIdx = 0;
  for (let m = 0; m < 20; m++) {
    const perMonth = m % 3 === 0 ? 2 : 1;
    for (let k = 0; k < perMonth; k++) {
      const day = 2 + (noteIdx % 20) + k * 6;
      const d = new Date(now.getFullYear(), now.getMonth() - m, Math.min(28, day));
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      out.push({
        id: 'c_seed_' + noteIdx,
        date: (y + '-' + mo + '-' + dd) as any,
        note: notes[noteIdx % notes.length],
        createdAt: new Date(y, d.getMonth(), d.getDate(), 10 + (noteIdx % 6), 0, 0).toISOString(),
      });
      noteIdx++;
    }
  }
  return out;
}

/**
 * Clears Financial Plan storage keys and writes mock balances, check-ins, and dev-friendly flags.
 */
export function seedDevMockStorage(opts?: { clearTheme?: boolean }): { ok: true } {
  const clearTheme = !(opts && opts.clearTheme === false);

  FINANCIAL_PLAN_STORAGE_KEYS.forEach(function (key) {
    try {
      localStorage.removeItem(String(key));
    } catch (e) {}
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildMockBalancesPayload()));
  } catch (e) {}

  try {
    localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(buildMockCheckins()));
  } catch (e) {}

  try {
    localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify({}));
  } catch (e) {}

  if (clearTheme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    } catch (e) {}
  }

  return { ok: true };
}

/** Apply rich mock balances to an in-memory plan (sample-data mode; does not write localStorage). */
export function applyDemoPlanSnapshot(plan: FinancialPlan): void {
  applyPlanPayloadFromObject(plan, buildMockBalancesPayload());
}

