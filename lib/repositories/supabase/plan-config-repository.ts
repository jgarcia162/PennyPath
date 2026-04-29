import type { SupabaseClient } from '@supabase/supabase-js';

import type { FinancialPlan, InterestNote, Phase1Budget, Phase2Budget, PlanLabels } from '../../../types/index.js';
import type { Database, Tables, TablesInsert } from '../../../types/supabase';
import type { PlanConfigRepository } from '../types';

type FinancialPlansRow = Tables<'financial_plans'>;
type FinancialPlansInsert = TablesInsert<'financial_plans'>;

function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function asPhase1(v: unknown): Phase1Budget {
  return v as Phase1Budget;
}

function asPhase2(v: unknown): Phase2Budget {
  return v as Phase2Budget;
}

function asInterestNote(v: unknown): InterestNote {
  return v as InterestNote;
}

function asLabels(v: unknown): PlanLabels {
  return v as PlanLabels;
}

function mapRowToPlanConfig(row: FinancialPlansRow): Partial<FinancialPlan> {
  const rawLabels = (row.labels || {}) as { budgetCategories?: unknown };
  return {
    monthlyTakeHome: row.monthly_take_home,
    paycheckAmount: row.paycheck_amount,
    paychecksPerMonth: row.paychecks_per_month,

    hysaBalance: row.hysa_balance,
    hysaApy: row.hysa_apy,
    joseSavings: row.jose_savings,
    sherlynaSavings: row.sherlyna_savings,

    timelineStart: (row.timeline_start || '') as any,
    ccApr: row.cc_apr,

    goalHysa: row.goal_hysa,
    hysaGoalByYm: row.hysa_goal_by_ym as any,
    hysaGoalBy: row.hysa_goal_by,

    monthlyFixedExpenses: row.monthly_fixed_expenses,
    efundMonths: row.efund_months,
    phase1: asPhase1(row.phase1),
    phase2: asPhase2(row.phase2),
    funBudget: row.fun_budget,

    monthsDebtPayoff: row.months_debt_payoff,
    monthsHysaBuild: row.months_hysa_build,
    debtFreeBy: row.debt_free_by,
    monthsToDebtFree: row.months_to_debt_free,
    monthsToHysaGoal: row.months_to_hysa_goal,
    netWorthGoalK: row.net_worth_goal_k,
    phase2HysaResultK: row.phase2_hysa_result_k,
    interestNote: asInterestNote(row.interest_note),
    labels: asLabels(row.labels),

    debtsEditorSort: row.debts_editor_sort as any,
    debtsProgressSort: row.debts_progress_sort as any,
    workingMonthYm: row.working_month_ym as any,
    dashboardViewMonthYm: row.dashboard_view_month_ym as any,
    ...(Array.isArray(rawLabels.budgetCategories) ? { budgetCategories: rawLabels.budgetCategories as any } : {}),
  };
}

function mapPlanToInsert(userId: string, plan: FinancialPlan): FinancialPlansInsert {
  return {
    user_id: userId,
    updated_at: new Date().toISOString(),

    monthly_take_home: plan.monthlyTakeHome,
    paycheck_amount: plan.paycheckAmount,
    paychecks_per_month: plan.paychecksPerMonth,

    hysa_balance: plan.hysaBalance,
    hysa_apy: plan.hysaApy,
    jose_savings: plan.joseSavings,
    sherlyna_savings: plan.sherlynaSavings,

    timeline_start: plan.timelineStart || null,
    cc_apr: plan.ccApr,

    goal_hysa: plan.goalHysa,
    hysa_goal_by_ym: plan.hysaGoalByYm,
    hysa_goal_by: plan.hysaGoalBy,

    monthly_fixed_expenses: plan.monthlyFixedExpenses,
    efund_months: plan.efundMonths,
    phase1: plan.phase1 as any,
    phase2: plan.phase2 as any,
    fun_budget: plan.funBudget,

    months_debt_payoff: plan.monthsDebtPayoff,
    months_hysa_build: plan.monthsHysaBuild,
    debt_free_by: plan.debtFreeBy,
    months_to_debt_free: plan.monthsToDebtFree,
    months_to_hysa_goal: plan.monthsToHysaGoal,
    net_worth_goal_k: plan.netWorthGoalK,
    phase2_hysa_result_k: plan.phase2HysaResultK,
    interest_note: plan.interestNote as any,
    labels: {
      ...(typeof plan.labels === 'object' && plan.labels ? (plan.labels as object) : {}),
      ...(Array.isArray((plan as any).budgetCategories) && (plan as any).budgetCategories.length
        ? { budgetCategories: (plan as any).budgetCategories }
        : {}),
    } as any,

    debts_editor_sort: plan.debtsEditorSort,
    debts_progress_sort: plan.debtsProgressSort,
    working_month_ym: plan.workingMonthYm,
    dashboard_view_month_ym: plan.dashboardViewMonthYm,
  };
}

export class SupabasePlanConfigRepository implements PlanConfigRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async load(): Promise<Partial<FinancialPlan> | null> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const { data, error } = await this.supabase
      .from('financial_plans')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return mapRowToPlanConfig(data as FinancialPlansRow);
  }

  async save(plan: FinancialPlan): Promise<void> {
    const { data: userData, error: userErr } = await this.supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = requireUserId(userData?.user?.id);

    const row = mapPlanToInsert(userId, plan);
    const { error } = await this.supabase.from('financial_plans').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

