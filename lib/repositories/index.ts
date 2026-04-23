// TO MIGRATE: swap Supabase implementations here without touching any calling code

import type { Repositories } from './types';

import { createSupabaseBrowserClient } from '../supabase/browser';
import type { Database } from '../../types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabasePlanConfigRepository } from './supabase/plan-config-repository';
import { SupabaseDebtRepository } from './supabase/debt-repository';
import { SupabaseSavingsAccountRepository } from './supabase/savings-account-repository';
import { SupabaseSavingsGoalRepository } from './supabase/savings-goal-repository';
import { SupabaseCheckInRepository } from './supabase/check-in-repository';
import { SupabaseAiCacheRepository } from './supabase/ai-cache-repository';

function getSupabaseClient(): SupabaseClient<Database> {
  // Today the Financial Plan runs in the browser; when/if server repos are needed,
  // swap the client here (this module is the only wiring point).
  return createSupabaseBrowserClient() as unknown as SupabaseClient<Database>;
}

export function getRepositories(): Repositories {
  const supabase = getSupabaseClient();
  return {
    planConfigRepository: new SupabasePlanConfigRepository(supabase),
    debtRepository: new SupabaseDebtRepository(supabase),
    savingsAccountRepository: new SupabaseSavingsAccountRepository(supabase),
    savingsGoalRepository: new SupabaseSavingsGoalRepository(supabase),
    checkInRepository: new SupabaseCheckInRepository(supabase),
    aiCacheRepository: new SupabaseAiCacheRepository(supabase),
  };
}

