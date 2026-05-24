import { describe, it, expect } from 'vitest';
import { projectPayoffTimeline, projectDebtPayoffYm } from './payoff-projection.js';

function makePlan(overrides = {}) {
  return {
    timelineStart: '2026-01-01',
    hysaBalance: 0,
    hysaApy: 0,
    debts: [],
    phase1: { ccPayment: 500, hysaDeposit: 100 },
    phase2: { hysaDeposit: 300 },
    ...overrides,
  };
}

function makeDebt(overrides = {}) {
  return {
    id: 'd1',
    name: 'Test Debt',
    current: 1000,
    aprPct: 0,
    deferredAmount: 0,
    deferredExpiresOn: '',
    deferredMonthsRemaining: 0,
    ...overrides,
  };
}

describe('projectPayoffTimeline — zero-debt plan', () => {
  it('returns the requested number of rows', () => {
    const rows = projectPayoffTimeline(makePlan(), { maxMonths: 3 });
    expect(rows).toHaveLength(3);
  });

  it('has ccEnd=0 and ccPayment=0 throughout with no debt', () => {
    const rows = projectPayoffTimeline(makePlan(), { maxMonths: 3 });
    rows.forEach((r) => {
      expect(r.ccEnd).toBe(0);
      expect(r.ccPayment).toBe(0);
    });
  });

  it('uses phase2 deposit when there is no debt', () => {
    const rows = projectPayoffTimeline(makePlan({ hysaBalance: 1000 }), { maxMonths: 2 });
    expect(rows[0].hysaDeposit).toBe(300);
    expect(rows[0].hysaEnd).toBe(1300);
    expect(rows[1].hysaEnd).toBe(1600);
  });

  it('includes a month string in YYYY-MM format', () => {
    const rows = projectPayoffTimeline(makePlan(), { maxMonths: 1 });
    expect(rows[0].month).toMatch(/^\d{4}-\d{2}$/);
    expect(rows[0].month).toBe('2026-01');
  });
});

describe('projectPayoffTimeline — single debt, no interest', () => {
  it('reduces balance by payment each month', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 1000, aprPct: 0 })],
      phase1: { ccPayment: 500, hysaDeposit: 50 },
    });
    const rows = projectPayoffTimeline(plan, { maxMonths: 4, noEarlyBreak: true });
    expect(rows[0].ccEnd).toBeCloseTo(500, 1);
    expect(rows[1].ccEnd).toBeCloseTo(0, 1);
  });

  it('caps payment at remaining balance', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 300 })],
      phase1: { ccPayment: 500, hysaDeposit: 0 },
    });
    const rows = projectPayoffTimeline(plan, { maxMonths: 2, noEarlyBreak: true });
    expect(rows[0].ccPayment).toBe(300);
    expect(rows[0].ccEnd).toBe(0);
  });

  it('switches to phase2 HYSA deposit once debt is cleared', () => {
    // Debt 1000, payment 500 → month 0 ends with 500 remaining, month 1 ends at 0.
    // hysaDeposit uses ccBalEnd: >0 → phase1, ==0 → phase2.
    const plan = makePlan({
      debts: [makeDebt({ current: 1000 })],
      phase1: { ccPayment: 500, hysaDeposit: 100 },
      phase2: { hysaDeposit: 400 },
    });
    const rows = projectPayoffTimeline(plan, { maxMonths: 3, noEarlyBreak: true });
    // Month 0: ccBalEnd = 500 → phase1 deposit
    expect(rows[0].hysaDeposit).toBe(100);
    // Month 1: ccBalEnd = 0 → phase2 deposit
    expect(rows[1].hysaDeposit).toBe(400);
  });
});

describe('projectPayoffTimeline — interest accrual', () => {
  it('charges ~1% monthly interest on a 12% APR debt', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 1000, aprPct: 12 })],
      phase1: { ccPayment: 0, hysaDeposit: 0 },
    });
    const rows = projectPayoffTimeline(plan, { maxMonths: 1, noEarlyBreak: true });
    // 12% APR => 1% simple monthly rate => 1000 * 0.01 = 10
    expect(rows[0].ccInterest).toBeCloseTo(10, 1);
    expect(rows[0].ccEnd).toBeCloseTo(1010, 1);
  });

  it('does not accrue interest on deferred balance', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 1000, aprPct: 12, deferredAmount: 1000, deferredExpiresOn: '2027-01-01' })],
      phase1: { ccPayment: 0, hysaDeposit: 0 },
    });
    const rows = projectPayoffTimeline(plan, { maxMonths: 1, noEarlyBreak: true });
    expect(rows[0].ccInterest).toBeCloseTo(0, 2);
  });
});

describe('projectDebtPayoffYm', () => {
  it('returns null/null when there are no debts', () => {
    const result = projectDebtPayoffYm(makePlan());
    expect(result.ym).toBeNull();
    expect(result.monthIndex).toBeNull();
  });

  it('returns null/null when debt has zero balance', () => {
    const plan = makePlan({ debts: [makeDebt({ current: 0 })] });
    const result = projectDebtPayoffYm(plan);
    expect(result.ym).toBeNull();
    expect(result.monthIndex).toBeNull();
  });

  it('finds the payoff month for a simple plan', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 500, aprPct: 0 })],
      phase1: { ccPayment: 500, hysaDeposit: 0 },
    });
    const result = projectDebtPayoffYm(plan);
    expect(result.monthIndex).toBe(0);
    expect(result.ym).toBe('2026-01');
  });

  it('returns null when debt cannot be repaid within maxMonths', () => {
    const plan = makePlan({
      debts: [makeDebt({ current: 100_000, aprPct: 24 })],
      phase1: { ccPayment: 1, hysaDeposit: 0 },
    });
    const result = projectDebtPayoffYm(plan, { maxMonths: 12 });
    expect(result.ym).toBeNull();
    expect(result.monthIndex).toBeNull();
  });
});
