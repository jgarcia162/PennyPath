/**
 * DOM for editable Monthly Budget Breakdown (Financial Plan → How we get there).
 */

import type { BudgetCategoryRow, DerivedPlanMetrics, FinancialPlan } from '../../types/index.js';
import {
  ensureBudgetCategories,
  refreshBudgetCategoryAmountsFromPlan,
  updateBufferRowAmount,
} from './budget-categories';

function escapeAttr(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function chipHtml(row: BudgetCategoryRow): string {
  if (row.role === 'cc' && row.chip === 'red') {
    return '<span class="chip red">Phase 1</span>';
  }
  if (row.role === 'hysa' && row.chip === 'green') {
    return '<span class="chip green">Phase 1</span>';
  }
  return '';
}

function amountStyleAttr(row: BudgetCategoryRow): string {
  const t = row.amountTone || 'default';
  if (t === 'red') return ' style="color:var(--red)"';
  if (t === 'sage') return ' style="color:var(--sage)"';
  if (t === 'gold') return ' style="color:var(--gold)"';
  return '';
}

export function renderBudgetBreakdown(
  plan: FinancialPlan,
  d: DerivedPlanMetrics,
  money: (n: number) => string,
  pctOfBudget: (amt: number) => number
): void {
  ensureBudgetCategories(plan);
  refreshBudgetCategoryAmountsFromPlan(plan);
  updateBufferRowAmount(plan);

  const host = document.getElementById('budget-breakdown-rows');
  if (!host) return;

  const rows = ((plan as any).budgetCategories || []) as BudgetCategoryRow[];
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pct = pctOfBudget(rowAmt(row));
    const readonlyAmt = row.role === 'buffer';
    const showRemove = row.role === 'custom';
    parts.push(
      '<div class="budget-row budget-row--editable" data-budget-id="' +
        escapeAttr(row.id) +
        '">' +
        '<div class="budget-cell budget-cell--cat">' +
        '<span class="budget-row__emoji" aria-hidden="true">' +
        (row.emoji ? escapeAttr(row.emoji) : '') +
        '</span>' +
        '<input type="text" class="budget-cat-label" maxlength="80" aria-label="Category name" value="' +
        escapeAttr(row.label) +
        '"' +
        ' />' +
        chipHtml(row) +
        '</div>' +
        '<input type="text" class="budget-cat-amount" inputmode="decimal" autocomplete="off" aria-label="Amount" value="' +
        escapeAttr(formatAmtInput(row.amount)) +
        '"' +
        (readonlyAmt ? ' readonly' : '') +
        amountStyleAttr(row) +
        '/>' +
        '<span class="budget-pct">' +
        pct +
        '%</span>' +
        (showRemove
          ? '<button type="button" class="budget-cat-remove no-print" aria-label="Remove category">×</button>'
          : '<span class="budget-cat-remove-spacer" aria-hidden="true"></span>') +
        '</div>'
    );
  }
  host.innerHTML = parts.join('');

  const totalEl = document.getElementById('budget-total');
  if (totalEl) totalEl.textContent = money(d.budgetTotal);
}

function rowAmt(row: BudgetCategoryRow): number {
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

function formatAmtInput(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return x === Math.floor(x) ? String(Math.round(x)) : x.toFixed(2);
}
