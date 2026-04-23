import type { FinancialPlan } from '../../../types/index.js';

import { createSupabaseBrowserClient } from '../../supabase/browser';
import { applyPlanPayloadFromObject } from '../../../assets/financial-plan/persistence';
import { yyyyMmFromDate } from '../../../assets/financial-plan/monthly-activity';
import type { PlanRepository } from '../types';

function normalizeDebtsEditorSortForStorage(sort: unknown): string {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return (sort as any) || 'saved';
}

function normalizeDebtsProgressSortForStorage(sort: unknown): string {
  if (sort === 'balance') return 'balance-desc';
  if (sort === 'apr') return 'apr-desc';
  return (sort as any) || 'saved';
}

function buildPlanPayloadForStorage(plan: FinancialPlan): unknown {
  return {
    goalHysa: (plan as any).goalHysa,
    hysaGoalByYm: (plan as any).hysaGoalByYm,
    hysaGoalBy: (plan as any).hysaGoalBy,
    labels: {
      hysaGoalByShort:
        (plan as any).labels && (plan as any).labels.hysaGoalByShort ? (plan as any).labels.hysaGoalByShort : '',
      goalHysaWhen: (plan as any).labels && (plan as any).labels.goalHysaWhen ? (plan as any).labels.goalHysaWhen : '',
    },
    hysaBalance: (plan as any).hysaBalance,
    joseSavings: (plan as any).joseSavings,
    sherlynaSavings: (plan as any).sherlynaSavings,
    savingsAccounts: (plan as any).savingsAccounts,
    debts: (plan as any).debts,
    debtsEditorSort: normalizeDebtsEditorSortForStorage((plan as any).debtsEditorSort),
    debtsProgressSort: normalizeDebtsProgressSortForStorage((plan as any).debtsProgressSort),
    workingMonthYm:
      typeof (plan as any).workingMonthYm === 'string' && /^\d{4}-\d{2}$/.test((plan as any).workingMonthYm)
        ? (plan as any).workingMonthYm
        : yyyyMmFromDate(new Date()),
    dashboardViewMonthYm:
      typeof (plan as any).dashboardViewMonthYm === 'string' && /^\d{4}-\d{2}$/.test((plan as any).dashboardViewMonthYm)
        ? (plan as any).dashboardViewMonthYm
        : '',
    savingsGoals: Array.isArray((plan as any).savingsGoals) ? (plan as any).savingsGoals : [],
  };
}

/**
 * Supabase-backed PlanRepository.
 *
 * Uses `financial_plans.payload` as a single JSONB document per user.
 * Clean surface area so callers can be kept stable while we iterate on persistence.
 */
export class SupabasePlanRepository implements PlanRepository {
  async load(): Promise<FinancialPlan | null> {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return null;

      const { data, error } = await supabase
        .from('financial_plans')
        .select('payload')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (error || !data?.payload) return null;

      // Create a fresh plan object and hydrate it using the existing normalization logic.
      const plan = {} as FinancialPlan;
      applyPlanPayloadFromObject(plan, data.payload);
      return plan;
    } catch {
      return null;
    }
  }

  async save(plan: FinancialPlan): Promise<void> {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return;

      const payload = buildPlanPayloadForStorage(plan);
      await supabase.from('financial_plans').upsert(
        {
          user_id: userData.user.id,
          payload: payload as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch {
      // Silent by design (matches existing persistence behavior).
    }
  }
}

