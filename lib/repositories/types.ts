import type {
  AiPayoffPlanCache,
  CheckInEntry,
  CheckInServiceEntry,
  Debt,
  FinancialCalendarResponse,
  FinancialPlan,
  SavingsAccount,
  SavingsGoal,
} from '../../types/index.js';

export interface PlanConfigRepository {
  load(): Promise<Partial<FinancialPlan> | null>;
  save(plan: FinancialPlan): Promise<void>;
}

export interface DebtRepository {
  list(): Promise<Debt[]>;
  add(debt: Debt): Promise<void>;
  update(debt: Debt): Promise<void>;
  remove(id: string): Promise<void>;
  addPayment(debtId: string, payment: { id: string; amount: number; at: string }): Promise<void>;
}

export interface SavingsAccountRepository {
  list(): Promise<SavingsAccount[]>;
  add(account: SavingsAccount): Promise<void>;
  update(account: SavingsAccount): Promise<void>;
  remove(id: string): Promise<void>;
  addDeposit(accountId: string, deposit: { id: string; amount: number; at: string }): Promise<void>;
}

export interface SavingsGoalRepository {
  list(): Promise<SavingsGoal[]>;
  save(goals: SavingsGoal[]): Promise<void>;
  add(goal: SavingsGoal): Promise<void>;
  update(goal: SavingsGoal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AiCacheRepository {
  getPayoffPlan(): Promise<AiPayoffPlanCache | null>;
  setPayoffPlan(cache: AiPayoffPlanCache): Promise<void>;
  getBillCalendar(): Promise<FinancialCalendarResponse | null>;
  setBillCalendar(data: FinancialCalendarResponse): Promise<void>;
  getBillCalendarColumns(columns: unknown): Promise<void>;
  getColumns(): Promise<unknown | null>;
}

export interface CheckInRepository {
  list(): Promise<CheckInServiceEntry[]>;
  add(entry: Pick<CheckInEntry, 'date' | 'note'>): Promise<CheckInServiceEntry>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export interface FinancialPlanStateRepository {
  getBadges(): Promise<Record<string, string>>;
  setBadges(unlocks: Record<string, string>): Promise<void>;

  getMonthWrapArchives(): Promise<unknown[]>;
  setMonthWrapArchives(archives: unknown[]): Promise<void>;

  getMonthWrapRollback(): Promise<unknown | null>;
  setMonthWrapRollback(payload: unknown): Promise<void>;
  clearMonthWrapRollback(): Promise<void>;
}

export interface Repositories {
  planConfigRepository: PlanConfigRepository;
  debtRepository: DebtRepository;
  savingsAccountRepository: SavingsAccountRepository;
  savingsGoalRepository: SavingsGoalRepository;
  checkInRepository: CheckInRepository;
  aiCacheRepository: AiCacheRepository;
  financialPlanStateRepository: FinancialPlanStateRepository;
}

