import { describe, expect, it } from 'vitest';
import { createBlankFinancialPlan } from './plan-data';
import {
  applyTakeHomePay,
  draftFromPlan,
  formatPaycheckCount,
  resolveTakeHome,
  takeHomeStatusNote,
} from './takehome-pay';

describe('take-home pay', () => {
  it('multiplies paycheck amount by paychecks per month', () => {
    expect(
      resolveTakeHome({
        paycheckAmount: 3100,
        paychecksPerMonth: 2,
        monthlyTakeHome: 0,
        source: 'paycheck',
      })
    ).toEqual({
      paycheckAmount: 3100,
      paychecksPerMonth: 2,
      monthlyTakeHome: 6200,
    });
  });

  it('treats a blank count as one paycheck when an amount is entered', () => {
    expect(
      resolveTakeHome({
        paycheckAmount: 4500,
        paychecksPerMonth: 0,
        monthlyTakeHome: 0,
        source: 'paycheck',
      }).paychecksPerMonth
    ).toBe(1);
  });

  it('derives the paycheck from a monthly total', () => {
    const draft = resolveTakeHome({
      paycheckAmount: 0,
      paychecksPerMonth: 2,
      monthlyTakeHome: 6200,
      source: 'monthly',
    });
    expect(draft.paycheckAmount).toBe(3100);
    expect(draft.monthlyTakeHome).toBe(6200);
  });

  it('rebuilds a missing paycheck breakdown from the stored monthly total', () => {
    const draft = draftFromPlan({
      paycheckAmount: 0,
      paychecksPerMonth: 0,
      monthlyTakeHome: 5000,
    });
    expect(draft).toEqual({
      paycheckAmount: 5000,
      paychecksPerMonth: 1,
      monthlyTakeHome: 5000,
    });
  });

  it('keeps a monthly total that does not match the old breakdown', () => {
    const draft = draftFromPlan({
      paycheckAmount: 2000,
      paychecksPerMonth: 2,
      monthlyTakeHome: 6000,
    });
    expect(draft.paycheckAmount).toBe(3000);
    expect(draft.paychecksPerMonth).toBe(2);
    expect(draft.monthlyTakeHome).toBe(6000);
  });

  it('writes the three plan fields together', () => {
    const plan = createBlankFinancialPlan();
    applyTakeHomePay(plan, {
      paycheckAmount: 1800.126,
      paychecksPerMonth: 2.16666,
      monthlyTakeHome: 0,
    });
    expect(plan.paycheckAmount).toBe(1800.13);
    expect(plan.paychecksPerMonth).toBe(2.1667);
    expect(plan.monthlyTakeHome).toBe(3900.34);
  });

  it('formats whole paycheck counts without decimals', () => {
    expect(formatPaycheckCount(2)).toBe('2');
    expect(formatPaycheckCount(2.16666)).toBe('2.1667');
  });

  it('describes an empty plan and a single paycheck', () => {
    expect(
      takeHomeStatusNote({ paycheckAmount: 0, paychecksPerMonth: 0, monthlyTakeHome: 0 })
    ).toBe('Edit to set your take-home pay.');
    expect(
      takeHomeStatusNote({ paycheckAmount: 4200, paychecksPerMonth: 1, monthlyTakeHome: 4200 })
    ).toBe('$4,200.00 × 1 paycheck per month');
  });
});
