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
import { setBudgetBreakdownEditMode } from './budget-breakdown-state';

type RenderFn = () => void;
type BudgetRowLike = BudgetCategoryRow;

function findRow(plan: FinancialPlan, id: string): BudgetCategoryRow | undefined {
  const rows = (plan as any).budgetCategories as BudgetCategoryRow[] | undefined;
  if (!Array.isArray(rows)) return undefined;
  return rows.find(function (r) {
    return String(r.id) === String(id);
  });
}

function parsePercentFromInput(raw: string): number {
  const n = Number(String(raw || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function budgetTotalForEditing(plan: FinancialPlan): number {
  const take = Number((plan as any).monthlyTakeHome);
  if (Number.isFinite(take) && take > 0) return take;
  const rows = (((plan as any).budgetCategories as BudgetCategoryRow[] | undefined) || []).slice();
  let total = 0;
  for (let i = 0; i < rows.length; i++) total += Number(rows[i].amount) || 0;
  return total > 0 ? total : 1;
}

export function wireBudgetBreakdown(render: RenderFn): void {
  const wrap = document.getElementById('budget-breakdown-wrap');
  if (!wrap || (wrap as HTMLElement & { _budgetWired?: boolean })._budgetWired) return;
  (wrap as HTMLElement & { _budgetWired?: boolean })._budgetWired = true;

  const rowsHost = document.getElementById('budget-breakdown-rows');
  const addBtn = document.getElementById('budget-add-row-btn');
  const toggleBtn = document.getElementById('budget-edit-toggle');
  const doneBtn = document.getElementById('budget-done-btn');
  const cancelBtn = document.getElementById('budget-cancel-btn');
  const undoBtn = document.getElementById('budget-undo-btn');
  const statusEl = document.getElementById('budget-edit-status');
  let editSnapshot: BudgetRowLike[] | null = null;

  function setStatus(msg: string): void {
    if (!statusEl) return;
    statusEl.textContent = msg;
  }

  function cloneRows(rows: BudgetCategoryRow[]): BudgetRowLike[] {
    return rows.map(function (r) {
      return { ...r };
    });
  }

  function captureSnapshot(): void {
    ensureBudgetCategories(PLAN as FinancialPlan);
    editSnapshot = cloneRows(((PLAN as any).budgetCategories as BudgetCategoryRow[]) || []);
  }

  function restoreSnapshot(): void {
    if (!editSnapshot) return;
    (PLAN as any).budgetCategories = cloneRows(editSnapshot);
    syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
    updateBufferRowAmount(PLAN as FinancialPlan);
  }

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
      if (row.role !== 'buffer') {
        const pctIn = el.querySelector('.budget-cat-pct') as HTMLInputElement | null;
        const mode = (el.getAttribute('data-last-edit') || '').toLowerCase();
        if (mode === 'pct' && pctIn) {
          const pct = parsePercentFromInput(pctIn.value);
          row.amount = parseAmountFromInput(String((budgetTotalForEditing(PLAN as FinancialPlan) * pct) / 100));
        } else if (amtIn) {
          row.amount = parseAmountFromInput(amtIn.value);
        }
      }
    });
    syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
    updateBufferRowAmount(PLAN as FinancialPlan);
  }

  function onBlur(e: Event): void {
    const t = e.target as HTMLElement | null;
    if (!t || !t.classList) return;
    if (
      !t.classList.contains('budget-cat-amount') &&
      !t.classList.contains('budget-cat-label') &&
      !t.classList.contains('budget-cat-pct')
    ) {
      return;
    }
    const rowEl = t.closest('.budget-row--editable');
    if (rowEl && t.classList.contains('budget-cat-pct')) rowEl.setAttribute('data-last-edit', 'pct');
    if (rowEl && t.classList.contains('budget-cat-amount')) rowEl.setAttribute('data-last-edit', 'amount');
    commitFromDom();
  }

  if (rowsHost) {
    rowsHost.addEventListener('input', function (e: Event) {
      const t = e.target as HTMLElement | null;
      if (!t || !t.classList) return;
      const rowEl = t.closest('.budget-row--editable');
      if (!rowEl) return;
      const amtIn = rowEl.querySelector('.budget-cat-amount') as HTMLInputElement | null;
      const pctIn = rowEl.querySelector('.budget-cat-pct') as HTMLInputElement | null;
      const total = budgetTotalForEditing(PLAN as FinancialPlan);
      if (t.classList.contains('budget-cat-amount')) {
        rowEl.setAttribute('data-last-edit', 'amount');
        if (!amtIn || !pctIn) return;
        const amt = parseAmountFromInput(amtIn.value);
        pctIn.value = total > 0 ? (((amt / total) * 100 * 10) / 10).toFixed(1).replace(/\.0$/, '') : '0';
      } else if (t.classList.contains('budget-cat-pct')) {
        rowEl.setAttribute('data-last-edit', 'pct');
        if (!amtIn || !pctIn) return;
        const pct = parsePercentFromInput(pctIn.value);
        const amt = parseAmountFromInput(String((total * pct) / 100));
        amtIn.value = String(amt % 1 === 0 ? Math.round(amt) : amt.toFixed(2));
      }
    });

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
      if (rows[idx].role === 'buffer') return;
      rows.splice(idx, 1);
      syncBudgetRowsToLegacyFields(PLAN as FinancialPlan);
      updateBufferRowAmount(PLAN as FinancialPlan);
      render();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function (e: Event) {
      e.preventDefault();
      captureSnapshot();
      setStatus('');
      setBudgetBreakdownEditMode(true);
      render();
    });
  }

  if (doneBtn) {
    doneBtn.addEventListener('click', async function (e: Event) {
      e.preventDefault();
      commitFromDom();
      setStatus('Saving...');
      try {
        await savePlanOverrides();
        editSnapshot = null;
        setBudgetBreakdownEditMode(false);
        setStatus('');
        render();
      } catch {
        setStatus('Could not save changes. Please try again.');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function (e: Event) {
      e.preventDefault();
      restoreSnapshot();
      editSnapshot = null;
      setBudgetBreakdownEditMode(false);
      setStatus('');
      render();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', function (e: Event) {
      e.preventDefault();
      restoreSnapshot();
      setStatus('Reverted to edit start.');
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
