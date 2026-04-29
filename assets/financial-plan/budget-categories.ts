/**
 * Monthly budget breakdown rows: editable categories synced to legacy plan fields
 * (monthlyFixedExpenses, phase1, funBudget) plus optional custom lines and computed buffer.
 */

import type { BudgetCategoryRow, FinancialPlan } from '../../types/index.js';
import { numOr, parseMoneyInput, roundMoney } from './utils';

export function newBudgetCustomId(): string {
  return 'bcust_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Default rows when none persisted (matches former static UI). */
export function createDefaultBudgetCategories(plan: FinancialPlan): BudgetCategoryRow[] {
  const take = numOr(plan.monthlyTakeHome, 0);
  const exp = numOr(plan.monthlyFixedExpenses, 0);
  const cc = numOr(plan.phase1 && plan.phase1.ccPayment, 0);
  const hysa = numOr(plan.phase1 && plan.phase1.hysaDeposit, 0);
  const fun = numOr(plan.funBudget, 0);
  const customSum = 0;
  const buf = roundMoney(Math.max(0, take - exp - cc - hysa - fun - customSum));

  return [
    {
      id: 'cat-expenses',
      role: 'expenses',
      label: 'Monthly Expenses',
      emoji: '🏠',
      amount: roundMoney(exp),
    },
    {
      id: 'cat-cc',
      role: 'cc',
      label: 'Credit Card Payoff',
      emoji: '💳',
      chip: 'red',
      amountTone: 'red',
      amount: roundMoney(cc),
    },
    {
      id: 'cat-hysa',
      role: 'hysa',
      label: 'HYSA Savings',
      emoji: '💰',
      chip: 'green',
      amountTone: 'sage',
      amount: roundMoney(hysa),
    },
    {
      id: 'cat-fun',
      role: 'fun',
      label: 'Fun Budget',
      emoji: '🎉',
      amountTone: 'gold',
      amount: roundMoney(fun),
    },
    {
      id: 'cat-buffer',
      role: 'buffer',
      label: 'Buffer (rolls to savings if unused)',
      emoji: '🛡️',
      amount: buf,
    },
  ];
}

export function ensureBudgetCategories(plan: FinancialPlan): void {
  const raw = (plan as any).budgetCategories as BudgetCategoryRow[] | undefined;
  if (!Array.isArray(raw) || raw.length === 0) {
    (plan as any).budgetCategories = createDefaultBudgetCategories(plan);
    return;
  }

  const out: BudgetCategoryRow[] = [];
  let hasBuffer = false;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== 'object') continue;
    const role = String(r.role || '');
    if (
      role === 'expenses' ||
      role === 'cc' ||
      role === 'hysa' ||
      role === 'fun' ||
      role === 'custom' ||
      role === 'buffer'
    ) {
      const normalized = {
        ...r,
        role: role as BudgetCategoryRow['role'],
        id: r.id && String(r.id).length ? String(r.id) : role === 'custom' ? newBudgetCustomId() : 'cat-' + role,
        label: String(r.label || '').trim() || 'Category',
        amount: roundMoney(Math.max(0, numOr(r.amount, 0))),
      } as BudgetCategoryRow;
      if (normalized.role === 'buffer') {
        if (hasBuffer) continue;
        hasBuffer = true;
      }
      out.push(normalized);
      continue;
    }
  }
  if (!hasBuffer) {
    out.push({
      id: 'cat-buffer',
      role: 'buffer',
      label: 'Buffer (rolls to savings if unused)',
      emoji: '🛡️',
      amount: 0,
    });
  }

  (plan as any).budgetCategories = out;
}

/** Mirror legacy scalar fields into core row amounts; refresh buffer. */
export function refreshBudgetCategoryAmountsFromPlan(plan: FinancialPlan): void {
  ensureBudgetCategories(plan);
  const rows = (plan as any).budgetCategories as BudgetCategoryRow[];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === 'expenses') r.amount = roundMoney(numOr(plan.monthlyFixedExpenses, 0));
    else if (r.role === 'cc') r.amount = roundMoney(numOr(plan.phase1 && plan.phase1.ccPayment, 0));
    else if (r.role === 'hysa') r.amount = roundMoney(numOr(plan.phase1 && plan.phase1.hysaDeposit, 0));
    else if (r.role === 'fun') r.amount = roundMoney(numOr(plan.funBudget, 0));
  }
  updateBufferRowAmount(plan);
}

/** Sum of custom category amounts. */
export function sumCustomBudgetAmounts(plan: FinancialPlan): number {
  const rows = ((plan as any).budgetCategories || []) as BudgetCategoryRow[];
  return rows
    .filter(function (r) {
      return r.role === 'custom';
    })
    .reduce(function (s, r) {
      return s + numOr(r.amount, 0);
    }, 0);
}

export function updateBufferRowAmount(plan: FinancialPlan): void {
  ensureBudgetCategories(plan);
  const take = numOr(plan.monthlyTakeHome, 0);
  const rows = (plan as any).budgetCategories as BudgetCategoryRow[];
  let alloc = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === 'buffer') continue;
    alloc += numOr(r.amount, 0);
  }
  const buf = roundMoney(Math.max(0, take - alloc));
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].role === 'buffer') rows[i].amount = buf;
  }
}

/** Push non-buffer, non-custom row amounts into legacy plan fields (custom excluded). */
export function syncBudgetRowsToLegacyFields(plan: FinancialPlan): void {
  ensureBudgetCategories(plan);
  const rows = (plan as any).budgetCategories as BudgetCategoryRow[];
  plan.monthlyFixedExpenses = 0;
  if (!plan.phase1) (plan as any).phase1 = { ccPayment: 0, hysaDeposit: 0 };
  plan.phase1.ccPayment = 0;
  plan.phase1.hysaDeposit = 0;
  plan.funBudget = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const a = roundMoney(numOr(r.amount, 0));
    if (r.role === 'expenses') plan.monthlyFixedExpenses = a;
    else if (r.role === 'cc') {
      if (!plan.phase1) (plan as any).phase1 = { ccPayment: 0, hysaDeposit: 0 };
      plan.phase1.ccPayment = a;
    } else if (r.role === 'hysa') {
      if (!plan.phase1) (plan as any).phase1 = { ccPayment: 0, hysaDeposit: 0 };
      plan.phase1.hysaDeposit = a;
    } else if (r.role === 'fun') plan.funBudget = a;
  }
  updateBufferRowAmount(plan);
}

export function parseAmountFromInput(raw: string): number {
  const n = parseMoneyInput(raw);
  return n == null ? 0 : roundMoney(Math.max(0, n));
}
