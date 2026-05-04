/**
 * Monthly CC payoff + joint HYSA projection (pure). Used by timeline UI and end-of-plan liquid.
 */

import { getSavingsAccounts } from './savings-accounts';

function clamp0(n) {
  const x = typeof n === 'number' ? n : Number(n);
  return Math.max(0, Number.isFinite(x) ? x : 0);
}

/** Archived debts (paid-off / deleted) do not participate in payoff simulation. */
function debtLedgerActive(d) {
  const s = d && d.ledgerStatus;
  return !s || s === 'active';
}

/** APR % from plan (number or numeric string). 0% is valid — do not use Number.isFinite on raw strings. */
function aprPctFromDebt(d, plan) {
  const raw = d && d.aprPct;
  const v = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(v)) return v;
  const cc = plan && plan.ccApr;
  const ccNum = typeof cc === 'number' ? cc : Number(cc);
  return Number.isFinite(ccNum) ? ccNum * 100 : 0;
}

function parseStartDate(plan) {
  const raw = plan && plan.timelineStart;
  if (typeof raw === 'string' && raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addMonthsUtc(d, m) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1));
}

function yyyyMm(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

function monthlyRateFromApy(apy) {
  const a = Number.isFinite(apy) ? apy : 0;
  if (a <= -1) return 0;
  return Math.pow(1 + a, 1 / 12) - 1;
}

function monthlyRateFromAprPct(aprPct) {
  const p = typeof aprPct === 'number' ? aprPct : Number(aprPct);
  if (!Number.isFinite(p) || p === 0) return 0;
  const apr = p > 1 ? p / 100 : p;
  return apr > 0 ? apr / 12 : 0;
}

function toInt(n, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function parseYyyyMmDdUtc(s) {
  if (typeof s !== 'string' || !s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function hysaApyDecimalFromPlan(plan) {
  const accs = getSavingsAccounts(plan || {});
  const hysa = accs.find(function (a) {
    return String(a.id) === 'hysa';
  });
  if (hysa && Number.isFinite(hysa.apyPct)) return Math.max(0, hysa.apyPct / 100);
  return Number.isFinite(plan && plan.hysaApy) ? Math.max(0, plan.hysaApy) : 0;
}

/**
 * @param {object} plan
 * @param {{ maxMonths?: number, noEarlyBreak?: boolean }} [opts]
 */
export function projectPayoffTimeline(plan, opts) {
  const maxMonths = (opts && Number.isFinite(opts.maxMonths) ? opts.maxMonths : 48) | 0;
  const noEarlyBreak = !!(opts && opts.noEarlyBreak);
  const startDate = parseStartDate(plan || {});

  const debts = (Array.isArray(plan && plan.debts) ? plan.debts : []).filter(debtLedgerActive).map(function (d) {
    return {
      id: String((d && d.id) || ''),
      current: clamp0(d && d.current),
      aprPct: aprPctFromDebt(d, plan),
      deferredRemaining: clamp0(d && d.deferredAmount),
      deferredExpiresOn: parseYyyyMmDdUtc(d && d.deferredExpiresOn),
      deferredMonthsRemainingLegacy: Math.max(0, toInt(d && d.deferredMonthsRemaining, 0)),
    };
  });

  const hysaApy = hysaApyDecimalFromPlan(plan);
  const hysaMonthlyRate = monthlyRateFromApy(hysaApy);

  let ccBal = debts.reduce(function (sum, d) {
    return sum + clamp0(d.current);
  }, 0);
  let hysaBal = clamp0(plan && plan.hysaBalance);

  const phase1CcPayment = clamp0(plan && plan.phase1 && plan.phase1.ccPayment);
  const phase1HysaDeposit = clamp0(plan && plan.phase1 && plan.phase1.hysaDeposit);
  const phase2HysaDeposit = clamp0(plan && plan.phase2 && plan.phase2.hysaDeposit);

  const rows = [];

  for (let i = 0; i < Math.max(0, maxMonths); i++) {
    const date = addMonthsUtc(startDate, i);
    const monthStart = date;

    let ccInterest = 0;
    debts.forEach(function (d) {
      const r = monthlyRateFromAprPct(d.aprPct);
      const legacyActive = d.deferredMonthsRemainingLegacy > 0;
      const dateActive = d.deferredExpiresOn ? monthStart.getTime() < d.deferredExpiresOn.getTime() : false;
      const deferredActive = dateActive || legacyActive;
      const deferredBucket = deferredActive ? Math.min(d.deferredRemaining, d.current) : 0;
      const interestBearing = Math.max(0, d.current - deferredBucket);
      const intr = interestBearing * r;
      d.current = d.current + intr;
      ccInterest += intr;
    });

    const ccBalAfterInterest = debts.reduce(function (sum, d) {
      return sum + clamp0(d.current);
    }, 0);
    const ccPayment = ccBalAfterInterest > 0 ? Math.min(phase1CcPayment, ccBalAfterInterest) : 0;

    let remainingPayment = ccPayment;
    const totalBeforePay = ccBalAfterInterest;
    if (totalBeforePay > 0 && remainingPayment > 0) {
      debts.forEach(function (d, idx) {
        if (remainingPayment <= 0) return;
        const weight = d.current / totalBeforePay;
        const slice = idx === debts.length - 1 ? remainingPayment : ccPayment * weight;
        const planned = Math.min(d.current, Math.max(0, slice));
        let apply = planned;

        const legacyActive = d.deferredMonthsRemainingLegacy > 0;
        const dateActive = d.deferredExpiresOn ? monthStart.getTime() < d.deferredExpiresOn.getTime() : false;
        const deferredActive = dateActive || legacyActive;
        if (apply > 0 && deferredActive) {
          const deferredBucket = Math.min(d.deferredRemaining, d.current);
          const interestBearing = Math.max(0, d.current - deferredBucket);
          const towardInterestBearing = Math.min(apply, interestBearing);
          d.current = Math.max(0, d.current - towardInterestBearing);
          apply -= towardInterestBearing;

          if (apply > 0) {
            const towardDeferred = Math.min(apply, d.deferredRemaining);
            d.current = Math.max(0, d.current - towardDeferred);
            d.deferredRemaining = Math.max(0, d.deferredRemaining - towardDeferred);
            apply -= towardDeferred;
          }
        } else if (apply > 0) {
          d.current = Math.max(0, d.current - apply);
        }

        remainingPayment -= planned;
      });
    }

    debts.forEach(function (d) {
      if (d.deferredMonthsRemainingLegacy > 0) d.deferredMonthsRemainingLegacy -= 1;
    });

    const ccBalEnd = debts.reduce(function (sum, d) {
      return sum + clamp0(d.current);
    }, 0);

    const hysaInterest = hysaBal * hysaMonthlyRate;
    const hysaBalAfterInterest = hysaBal + hysaInterest;
    const hysaDeposit = ccBalEnd > 0 ? phase1HysaDeposit : phase2HysaDeposit;
    const hysaBalEnd = hysaBalAfterInterest + hysaDeposit;

    rows.push({
      month: yyyyMm(date),
      ccStart: ccBal,
      ccInterest: ccInterest,
      ccPayment: ccPayment,
      ccEnd: ccBalEnd,
      hysaStart: hysaBal,
      hysaInterest: hysaInterest,
      hysaDeposit: hysaDeposit,
      hysaEnd: hysaBalEnd,
    });

    ccBal = ccBalEnd;
    hysaBal = hysaBalEnd;

    if (!noEarlyBreak && ccBal <= 0 && i >= 3) {
      const remaining = Math.max(0, maxMonths - (i + 1));
      if (remaining > 6) break;
    }
  }

  return rows;
}

/**
 * First simulated month where aggregate CC balance reaches $0, or null if not within `maxMonths`.
 * Uses the same rules as {@link projectPayoffTimeline} (Phase 1 payment, interest, etc.).
 *
 * @param {object} plan
 * @param {{ maxMonths?: number }} [opts]
 * @returns {{ ym: string | null, monthIndex: number | null }}
 */
export function projectDebtPayoffYm(plan, opts) {
  const cap = opts && Number.isFinite(opts.maxMonths) ? Math.max(12, opts.maxMonths | 0) : 600;
  const debts = (Array.isArray(plan && plan.debts) ? plan.debts : []).filter(debtLedgerActive).filter(Boolean);
  const totalCurrent = debts.reduce(function (s, d) {
    return s + clamp0(d && d.current);
  }, 0);
  if (totalCurrent <= 0) {
    return { ym: null, monthIndex: null };
  }
  const rows = projectPayoffTimeline(plan, { maxMonths: cap, noEarlyBreak: true });
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].ccEnd <= 0) {
      return { ym: rows[i].month, monthIndex: i };
    }
  }
  return { ym: null, monthIndex: null };
}

if (typeof window !== 'undefined') {
  window.PayoffTimeline = { project: projectPayoffTimeline };
}
