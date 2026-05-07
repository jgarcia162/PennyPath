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

function hashSeed(seed: string): number {
  // FNV-1a-ish: stable across runtimes, cheap, good enough for demo randomness.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  // xorshift32 → [0, 1)
  let x = seed >>> 0;
  return function () {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // eslint-disable-next-line no-bitwise
    return ((x >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function pick<T>(rng: () => number, xs: T[]): T {
  return xs[Math.max(0, Math.min(xs.length - 1, Math.floor(rng() * xs.length)))];
}

function randInt(rng: () => number, min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(rng() * (b - a + 1));
}

function randMoney(rng: () => number, min: number, max: number, step: number = 1): number {
  const n = randInt(rng, 0, Math.max(0, Math.floor((max - min) / step)));
  return Math.round((min + n * step) * 100) / 100;
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

  const savingsAccounts: Array<
    Pick<SavingsAccount, 'id' | 'name' | 'current' | 'apyPct' | 'depositHistory' | 'goalIds' | 'countTowardsGoal'>
  > = [
    {
      id: 'hysa',
      name: 'Joint Savings',
      current: hysaCurrent,
      apyPct: 3.25,
      goalIds: ['goal-hysa', 'goal-efund'],
      countTowardsGoal: true,
      depositHistory: hysaDep,
    },
    {
      id: 'jose',
      name: 'Avery — personal',
      current: joseCurrent,
      apyPct: 4.15,
      goalIds: ['goal-personal', 'goal-efund'],
      countTowardsGoal: false,
      depositHistory: joseDep,
    },
    {
      id: 'sher',
      name: 'Jordan — personal',
      current: sherCurrent,
      apyPct: 0,
      goalIds: ['goal-personal', 'goal-efund'],
      countTowardsGoal: false,
      depositHistory: sherDep,
    },
    {
      id: 'vacation',
      name: 'Vacation fund',
      current: vacationCurrent,
      apyPct: 3.5,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: vacationDep,
    },
    {
      id: 'kids',
      name: 'Kids — 529',
      current: kidsCurrent,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: kidsDep,
    },
    {
      id: 'ibonds',
      name: 'I-Bonds ladder',
      current: ibondsCurrent,
      apyPct: 0,
      goalIds: [],
      countTowardsGoal: false,
      depositHistory: ibondsDep,
    },
  ];

  return {
    // Trial/demo should never start with negative balances.
    hysaBalance: Math.max(0, hysaCurrent),
    joseSavings: Math.max(0, joseCurrent),
    sherlynaSavings: Math.max(0, sherCurrent),
    savingsAccounts,
    savingsGoals: [
      { id: 'goal-hysa', name: 'Joint HYSA', targetAmount: 50000, goalByYm: '2027-06' },
      { id: 'goal-efund', name: 'Emergency fund', targetAmount: 36000, goalByYm: '' },
      { id: 'goal-personal', name: 'Personal savings', targetAmount: 25000, goalByYm: '' },
    ],
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

export function buildMockCheckins(seed?: string | null): CheckInServiceEntry[] {
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
  const rng = seed ? makeRng(hashSeed(seed)) : null;
  const out: CheckInServiceEntry[] = [];
  const now = new Date();
  let noteIdx = 0;
  for (let m = 0; m < 20; m++) {
    const perMonth = rng ? (rng() < 0.35 ? 2 : 1) : m % 3 === 0 ? 2 : 1;
    for (let k = 0; k < perMonth; k++) {
      const jitter = rng ? randInt(rng, -1, 3) : 0;
      const day = 2 + (noteIdx % 20) + k * 6 + jitter;
      const d = new Date(now.getFullYear(), now.getMonth() - m, Math.min(28, day));
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const note = rng ? pick(rng, notes) : notes[noteIdx % notes.length];
      out.push({
        id: 'c_seed_' + noteIdx,
        date: (y + '-' + mo + '-' + dd) as any,
        note: note,
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
export function applyDemoPlanSnapshot(plan: FinancialPlan, opts?: { seed?: string | null }): void {
  const seed = opts && typeof opts.seed === 'string' ? opts.seed : null;
  if (!seed) {
    applyPlanPayloadFromObject(plan, buildMockBalancesPayload());
    return;
  }

  const rng = makeRng(hashSeed(seed));
  const months = MOCK_HISTORY_MONTHS;

  const firstNames = ['Avery', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Sam', 'Alex', 'Jamie'];
  const kidNames = ['Kids', '529', 'College', 'Future'];

  const hysaName = pick(rng, ['Joint Savings', 'Family HYSA', 'Primary Savings']);
  const hysaApy = randMoney(rng, 2.75, 4.75, 0.05);
  const hysaCurrent = Math.max(0, randMoney(rng, 12000, 52000, 50));
  const personal1Name = pick(rng, firstNames) + ' — personal';
  const personal2Name = pick(rng, firstNames) + ' — personal';

  const joseCurrent = Math.max(0, randMoney(rng, 1500, 12000, 25));
  const sherCurrent = Math.max(0, randMoney(rng, 3500, 28000, 25));

  const hysaDep = buildRichDepositHistory(months, {
    base: randMoney(rng, 220, 650, 5),
    days: [2, 9, 17, 24].map(function (d) {
      return Math.min(28, d + randInt(rng, -1, 1));
    }),
    mult: randMoney(rng, 0.9, 1.4, 0.05),
  });
  const joseDep = buildRichDepositHistory(months, { base: randMoney(rng, 50, 160, 5), days: [5, 20], mult: 0.9 });
  const sherDep = buildRichDepositHistory(months, { base: randMoney(rng, 120, 320, 5), days: [6, 14, 22], mult: 1.0 });

  const savingsGoals = [
    {
      id: 'goal-hysa',
      name: pick(rng, ['Joint HYSA', 'Primary HYSA', 'Emergency HYSA']),
      targetAmount: randInt(rng, 25000, 90000),
      goalByYm: pick(rng, ['2027-03', '2027-06', '2027-09', '2028-01']),
    },
    { id: 'goal-efund', name: 'Emergency fund', targetAmount: randInt(rng, 18000, 54000), goalByYm: '' },
    { id: 'goal-personal', name: 'Personal savings', targetAmount: randInt(rng, 8000, 32000), goalByYm: '' },
    {
      id: 'goal-kids',
      name: pick(rng, kidNames) + ' fund',
      targetAmount: randInt(rng, 6000, 40000),
      goalByYm: pick(rng, ['', '2027-12', '2028-06']),
    },
  ];

  const savingsAccounts: Array<
    Pick<SavingsAccount, 'id' | 'name' | 'current' | 'apyPct' | 'depositHistory' | 'goalIds' | 'countTowardsGoal'>
  > = [
    {
      id: 'hysa',
      name: hysaName,
      current: hysaCurrent,
      apyPct: hysaApy,
      goalIds: ['goal-hysa', 'goal-efund'],
      countTowardsGoal: true,
      depositHistory: hysaDep,
    },
    {
      id: 'jose',
      name: personal1Name,
      current: joseCurrent,
      apyPct: randMoney(rng, 0, 4.5, 0.05),
      goalIds: ['goal-personal', 'goal-efund'],
      countTowardsGoal: false,
      depositHistory: joseDep,
    },
    {
      id: 'sher',
      name: personal2Name,
      current: sherCurrent,
      apyPct: randMoney(rng, 0, 4.5, 0.05),
      goalIds: ['goal-personal', 'goal-efund'],
      countTowardsGoal: false,
      depositHistory: sherDep,
    },
  ];

  const ccPayments = buildPaymentHistoryFromTemplates(months, [
    { amountBase: randMoney(rng, 900, 3600, 25), day: 4 },
    { amountBase: randMoney(rng, 150, 900, 25), day: 11 },
    { amountBase: randMoney(rng, 50, 450, 10), day: 18 },
  ]);

  const debts = [
    {
      id: 'cc',
      name: pick(rng, ['Credit Cards', 'Credit Card', 'Cards']),
      current: randMoney(rng, 3500, 28000, 25),
      paidOff: randMoney(rng, 0, 16000, 25),
      aprPct: randMoney(rng, 0, 29.99, 0.25),
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: ccPayments,
    },
  ];

  if (rng() < 0.75) {
    debts.push({
      id: 'car',
      name: pick(rng, ['Car loan', 'Auto loan']),
      current: randMoney(rng, 2500, 22000, 50),
      paidOff: randMoney(rng, 500, 12000, 50),
      aprPct: randMoney(rng, 2.25, 8.75, 0.05),
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: buildCarPaymentHistory(months),
    } as any);
  }
  if (rng() < 0.65) {
    debts.push({
      id: 'student',
      name: pick(rng, ['Student loan', 'Student loans']),
      current: randMoney(rng, 4000, 38000, 50),
      paidOff: randMoney(rng, 0, 18000, 50),
      aprPct: randMoney(rng, 2.25, 7.25, 0.05),
      deferredAmount: 0,
      deferredExpiresOn: '',
      deferredMonthsRemaining: 0,
      paymentHistory: buildStudentPaymentHistory(months),
    } as any);
  }

  applyPlanPayloadFromObject(plan, {
    hysaBalance: hysaCurrent,
    joseSavings: joseCurrent,
    sherlynaSavings: sherCurrent,
    savingsAccounts,
    savingsGoals,
    debts,
  });
}

