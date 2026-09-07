/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DerivedPlanMetrics } from '../../types/index.js';
import { PLAN, createBlankFinancialPlan } from './plan-data';
import { renderBudgetBreakdown } from './render-budget-breakdown';
import { setBudgetBreakdownEditMode, resetBudgetBreakdownEditMode } from './budget-breakdown-state';
import { wireBudgetBreakdown } from './budget-breakdown-wire';
import { formatCurrencyInput, formatMoneyInput } from './utils';

function resetPlan(): void {
  delete (PLAN as { budgetCategories?: unknown }).budgetCategories;
  Object.assign(PLAN, createBlankFinancialPlan());
  PLAN.monthlyTakeHome = 5000;
  PLAN.monthlyFixedExpenses = 2000;
  PLAN.phase1 = { ccPayment: 1000, hysaDeposit: 500 };
  PLAN.funBudget = 400;
}

function mountBudgetShell(): void {
  document.body.innerHTML =
    '<div id="budget-breakdown-wrap" class="budget-wrap">' +
    '<div id="budget-breakdown-rows"></div>' +
    '<span id="budget-total"></span>' +
    '</div>';
}

function derived(total: number): DerivedPlanMetrics {
  return { budgetTotal: total } as DerivedPlanMetrics;
}

function renderEditing(): void {
  setBudgetBreakdownEditMode(true);
  renderBudgetBreakdown(PLAN, derived(5000), function (n) {
    return '$' + n;
  }, function (amt) {
    return Math.round((amt / 5000) * 100);
  });
}

function typeKey(el: HTMLInputElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function expensesFields(): { amt: HTMLInputElement; pct: HTMLInputElement } {
  const row = document.querySelector('.budget-row--editable[data-budget-id="cat-expenses"]') as HTMLElement;
  return {
    amt: row.querySelector('.budget-cat-amount') as HTMLInputElement,
    pct: row.querySelector('.budget-cat-pct') as HTMLInputElement,
  };
}

describe('budget breakdown dollar and percent inputs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetPlan();
    resetBudgetBreakdownEditMode();
  });

  afterEach(() => {
    resetBudgetBreakdownEditMode();
    delete (PLAN as { budgetCategories?: unknown }).budgetCategories;
    Object.assign(PLAN, createBlankFinancialPlan());
  });

  it('uses the shared currency and rate money masks', () => {
    mountBudgetShell();
    renderEditing();

    const { amt, pct } = expensesFields();
    expect(amt.getAttribute('data-money')).toBe('currency');
    expect(amt.getAttribute('placeholder')).toBe('$0.00');
    expect(amt.value).toBe(formatCurrencyInput(2000));
    expect(pct.getAttribute('data-money')).toBe('rate');
    expect(pct.getAttribute('placeholder')).toBe('0.00');
    expect(pct.value).toBe(formatMoneyInput(40));
  });

  it('keeps typed dollars in the amount field instead of copying them into percent', () => {
    mountBudgetShell();
    renderEditing();
    wireBudgetBreakdown(function () {});

    const { amt, pct } = expensesFields();
    const originalPct = pct.value;

    amt.focus();
    amt.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    amt.setSelectionRange(0, amt.value.length);
    for (const key of ['5', '0', '0', '0', '0']) typeKey(amt, key);

    expect(amt.value).toBe('$500.00');
    expect(pct.value).toBe(originalPct);
    expect(pct.value).not.toBe('500');
    expect(pct.value).not.toBe('50000');
    expect(pct.value).not.toBe('$500.00');
  });

  it('converts a blurred amount into a rate percent, not the raw dollar digits', () => {
    mountBudgetShell();
    renderEditing();
    wireBudgetBreakdown(function () {});

    const { amt, pct } = expensesFields();
    amt.focus();
    amt.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    amt.setSelectionRange(0, amt.value.length);
    for (const key of ['5', '0', '0', '0', '0']) typeKey(amt, key);
    amt.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    expect(amt.value).toBe('$500.00');
    expect(pct.value).toBe(formatMoneyInput(10));
  });

  it('treats percent like other rate fields and updates amount on blur', () => {
    mountBudgetShell();
    renderEditing();
    wireBudgetBreakdown(function () {});

    const { amt, pct } = expensesFields();
    pct.focus();
    pct.value = '10';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    pct.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    expect(pct.value).toBe('10.00');
    expect(amt.value).toBe(formatCurrencyInput(500));
  });
});
