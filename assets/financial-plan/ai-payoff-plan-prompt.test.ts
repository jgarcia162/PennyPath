import { describe, it, expect } from 'vitest';
import { buildPrompt } from './ai-payoff-plan-wire';
import { createBlankFinancialPlan } from './plan-data';

describe('AI payoff plan APR prompt', () => {
  it('sends percent APRs and converts legacy decimal rows', () => {
    const plan = createBlankFinancialPlan();
    plan.debts = [
      {
        id: 'visa',
        name: 'Travel Visa',
        current: 1000,
        paidOff: 0,
        aprPct: 22.99,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: [],
      },
      {
        id: 'store',
        name: 'Store Card',
        current: 500,
        paidOff: 0,
        aprPct: 0.2799,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: [],
      },
    ];
    const prompt = buildPrompt(plan);
    expect(prompt).toContain('Purchase APR: 22.99%');
    expect(prompt).toContain('Purchase APR: 27.99%');
    expect(prompt).not.toContain('APR: 0.2799%');
    expect(prompt).not.toContain('0 may mean blended or unknown');
    expect(prompt).not.toContain('Legacy blended CC APR');
  });

  it('omits paid-off debts from the prompt', () => {
    const plan = createBlankFinancialPlan();
    plan.debts = [
      {
        id: 'active',
        name: 'Active Card',
        current: 200,
        paidOff: 0,
        aprPct: 19.99,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: [],
      },
      {
        id: 'done',
        name: 'Paid Off Card',
        current: 0,
        paidOff: 800,
        aprPct: 29.99,
        deferredAmount: 0,
        deferredExpiresOn: '',
        deferredMonthsRemaining: 0,
        paymentHistory: [],
        ledgerStatus: 'completed',
      },
    ];
    const prompt = buildPrompt(plan);
    expect(prompt).toContain('Active Card');
    expect(prompt).toContain('Purchase APR: 19.99%');
    expect(prompt).not.toContain('Paid Off Card');
    expect(prompt).not.toContain('29.99%');
  });
});
