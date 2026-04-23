import type {
  AiCacheRepository,
  DebtRepository,
  PlanRepository,
  SavingsAccountRepository,
  SavingsGoalRepository,
} from './types';

import { SupabasePlanRepository } from './supabase/plan-repository';
import type { Debt, SavingsAccount, SavingsGoal } from '../../types/index.js';

export interface Repositories {
  plan: PlanRepository;
  debts: DebtRepository;
  savingsAccounts: SavingsAccountRepository;
  savingsGoals: SavingsGoalRepository;
  aiCache: AiCacheRepository;
}

class NotImplementedRepositoryError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented yet`);
    this.name = 'NotImplementedRepositoryError';
  }
}

class NotImplementedDebtRepository implements DebtRepository {
  async list(): Promise<Debt[]> {
    throw new NotImplementedRepositoryError('DebtRepository.list');
  }
  async add(): Promise<void> {
    throw new NotImplementedRepositoryError('DebtRepository.add');
  }
  async update(): Promise<void> {
    throw new NotImplementedRepositoryError('DebtRepository.update');
  }
  async remove(): Promise<void> {
    throw new NotImplementedRepositoryError('DebtRepository.remove');
  }
}

class NotImplementedSavingsAccountRepository implements SavingsAccountRepository {
  async list(): Promise<SavingsAccount[]> {
    throw new NotImplementedRepositoryError('SavingsAccountRepository.list');
  }
  async add(): Promise<void> {
    throw new NotImplementedRepositoryError('SavingsAccountRepository.add');
  }
  async update(): Promise<void> {
    throw new NotImplementedRepositoryError('SavingsAccountRepository.update');
  }
  async remove(): Promise<void> {
    throw new NotImplementedRepositoryError('SavingsAccountRepository.remove');
  }
}

class NotImplementedSavingsGoalRepository implements SavingsGoalRepository {
  async list(): Promise<SavingsGoal[]> {
    throw new NotImplementedRepositoryError('SavingsGoalRepository.list');
  }
  async save(): Promise<void> {
    throw new NotImplementedRepositoryError('SavingsGoalRepository.save');
  }
}

class NotImplementedAiCacheRepository implements AiCacheRepository {
  async getPayoffPlan(): Promise<string | null> {
    throw new NotImplementedRepositoryError('AiCacheRepository.getPayoffPlan');
  }
  async setPayoffPlan(): Promise<void> {
    throw new NotImplementedRepositoryError('AiCacheRepository.setPayoffPlan');
  }
  async getBillCalendar(): Promise<unknown | null> {
    throw new NotImplementedRepositoryError('AiCacheRepository.getBillCalendar');
  }
  async setBillCalendar(): Promise<void> {
    throw new NotImplementedRepositoryError('AiCacheRepository.setBillCalendar');
  }
  async getBillCalendarColumns(): Promise<void> {
    throw new NotImplementedRepositoryError('AiCacheRepository.getBillCalendarColumns');
  }
}

/**
 * Single wiring point for repository implementations.
 *
 * Swap implementations here (and only here) when we move from the temporary JSONB
 * persistence approach to fully relational repositories.
 */
export function getRepositories(): Repositories {
  return {
    // TODO(relational): replace Supabase JSONB plan repository with relational repos.
    plan: new SupabasePlanRepository(),
    debts: new NotImplementedDebtRepository(),
    savingsAccounts: new NotImplementedSavingsAccountRepository(),
    savingsGoals: new NotImplementedSavingsGoalRepository(),
    aiCache: new NotImplementedAiCacheRepository(),
  };
}

