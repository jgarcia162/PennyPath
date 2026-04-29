/**
 * Event wiring for editable Monthly Budget Breakdown.
 */

import type { BudgetCategoryRow, FinancialPlan } from '../../types/index.js';
import { PLAN } from './plan-data';
import {
  ensureBudgetCategories,
  newBudgetCustomId,
  parseAmountFromInput,
  syncBudgetRowsToLegacyFields,
  updateBufferRowAmount,
} from './budget-categories';
import { savePlanOverrides } from './persistence';

type RenderFn = () => void;

function findRow(plan: FinancialPlan, id: string): BudgetCategoryRow | undefined {
  const rows = (plan as any).budgetCategories as BudgetCategoryRow[] | undefined;
  if (!Array.isArray(rows)) return undefined;
  return rows.find(function (r) {
    return String(r.id) === String(id);
  });
}

export function wireBudgetBreakdown(render: RenderFn): void {
  const rowsHost = document.getElementById('budget-breakdown-rows');
  const addBtn = document.getElementById('budget-add-row-btn');
  if (!rowsHost && !addBtn) return;

  function commitFromDom(): void {
    ensureBudgetCategories(PLAN as FinancialPlan);
    const rows = (PLAN as any).budgetCategories as BudgetCategoryRow[];
    const els = document.querySelectorAll('.budget-row--editable[data-budget-id]');
    els.forEach(function (el) {
      const id = el.getAttribute('data-budget-id');
      if (!id) return;
      const row = findRow(PLAN as FinancialPlan, id);
      if (!row) return;
      const labelIn = el.querySelector('.budget-cat-label') as HTMLInputElement | null;
      const amtIn = el.querySelector('.budget-cat-amount') as HTMLInputElement | null;
      if (labelIn) {
        const t = String(labelIn.value || '').trim();
        if (t) row.label = t.slice(0, 80);
      }
      if (amtIn && row.role !== 'buffer') {
        row.amount = parseAmountFromInput(amtIn.value);
      }
    });
    syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
    updateBufferRowAmount(PLAN as FinancialPlan);
  }

  function onBlur(e: Event): void {
    const t = e.target as HTMLElement | null;
    if (!t || !t.classList) return;
    if (!t.classList.contains('budget-cat-amount') && !t.classList.contains('budget-cat-label')) return;
    commitFromDom();
    void savePlanOverrides();
    render();
  }

  if (rowsHost) {
    rowsHost.addEventListener('blur', onBlur, true);
    rowsHost.addEventListener('click', function (e: Event) {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      const btn = t.closest('.budget-cat-remove');
      if (!btn) return;
      e.preventDefault();
      const rowEl = btn.closest('.budget-row--editable');
      const id = rowEl && rowEl.getAttribute('data-budget-id');
      if (!id) return;
      ensureBudgetCategories(PLAN as FinancialPlan);
      const rows = (PLAN as any).budgetCategories as BudgetCategoryRow[];
      const idx = rows.findIndex(function (r) {
        return String(r.id) === String(id);
      });
      if (idx === -1) return;
      if (rows[idx].role !== 'custom') return;
      rows.splice(idx, 1);
      syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
      updateBufferRowAmount(PLAN as FinancialPlan);
      void savePlanOverrides();
      render();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', function (e: Event) {
      e.preventDefault();
      ensureBudgetCategories(PLAN as FinancialPlan);
      const rows = (PLAN as any).budgetCategories as BudgetCategoryRow[];
      const bufIdx = rows.findIndex(function (r) {
        return r.role === 'buffer';
      });
      const insertAt = bufIdx >= 0 ? bufIdx : rows.length;
      const nu: BudgetCategoryRow = {
        id: newBudgetCustomId(),
        role: 'custom',
        label: 'New category',
        emoji: '📎',
        amount: 0,
      };
      rows.splice(insertAt, 0, nu);
      syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
      updateBufferRowAmount(PLAN as FinancialPlan);
      void savePlanOverrides();
      render();
      window.setTimeout(function () {
        const el = document.querySelector('.budget-row--editable[data-budget-id="' + nu.id + '"] .budget-cat-label') as
          | HTMLInputElement
          | undefined
          | null;
        if (el) {
          el.focus();
          el.select();
        }
      }, 0);
    });
  }
}
