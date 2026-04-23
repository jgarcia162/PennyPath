import type { Debt, FinancialPlan, SavingsAccount, SavingsGoal } from '../../types';

export interface PlanRepository {
  load(): Promise<FinancialPlan | null>;
  save(plan: FinancialPlan): Promise<void>;
}

export interface DebtRepository {
  list(): Promise<Debt[]>;
  add(debt: Debt): Promise<void>;
  update(debt: Debt): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SavingsAccountRepository {
  list(): Promise<SavingsAccount[]>;
  add(account: SavingsAccount): Promise<void>;
  update(account: SavingsAccount): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SavingsGoalRepository {
  list(): Promise<SavingsGoal[]>;
  save(goals: SavingsGoal[]): Promise<void>;
}

export interface AiCacheRepository {
  getPayoffPlan(): Promise<string | null>;
  setPayoffPlan(text: string): Promise<void>;
  getBillCalendar(): Promise<unknown | null>;
  setBillCalendar(data: unknown): Promise<void>;
  getBillCalendarColumns(data: unknown): Promise<void>;
}

