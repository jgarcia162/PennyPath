/**
 * Monthly budget breakdown rows: editable categories synced to legacy plan fields
 * (monthlyFixedExpenses, phase1, funBudget) plus optional custom lines and computed buffer.
 */

import type { BudgetCategoryRole, BudgetCategoryRow, FinancialPlan } from '../../types/index.js';
import { numOr, parseMoneyInput, roundMoney } from './utils';

const CORE_ROLES: BudgetCategoryRole[] = ['expenses', 'cc', 'hysa', 'fun'];

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

  const defaults = createDefaultBudgetCategories(plan);
  const defByRole = new Map<BudgetCategoryRole, BudgetCategoryRow>();
  defaults.forEach(function (d) {
    defByRole.set(d.role, d);
  });

  const firstOf = new Map<BudgetCategoryRole, BudgetCategoryRow>();
  const customs: BudgetCategoryRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== 'object') continue;
    const role = r.role;
    if (role === 'custom') {
      customs.push(r);
      continue;
    }
    if (role === 'buffer') {
      if (!firstOf.has('buffer')) firstOf.set('buffer', r);
      continue;
    }
    if (role === 'expenses' || role === 'cc' || role === 'hysa' || role === 'fun') {
      if (!firstOf.has(role)) firstOf.set(role, r);
      continue;
    }
    customs.push({
      ...r,
      role: 'custom',
      id: r.id && String(r.id).length ? r.id : newBudgetCustomId(),
    });
  }

  const out: BudgetCategoryRow[] = [];
  for (let j = 0; j < CORE_ROLES.length; j++) {
    const cr = CORE_ROLES[j];
    const existing = firstOf.get(cr);
    const fallback = defByRole.get(cr);
    if (existing) out.push(existing);
    else if (fallback) out.push({ ...fallback });
  }
  for (let c = 0; c < customs.length; c++) out.push(customs[c]);
  const bufRow = firstOf.get('buffer') || defByRole.get('buffer');
  if (bufRow) out.push({ ...bufRow });

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
