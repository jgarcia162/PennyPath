-- PennyPath core schema
--
-- IMPORTANT:
-- The browser app code relies on the table/column names below (see `types/supabase.ts`).
-- Keep this migration aligned with generated Supabase types + repositories.

-- ---------------------------------------------------------------------------
-- financial_plans (one row per user; scalar config fields)
-- ---------------------------------------------------------------------------

create table if not exists public.financial_plans (
  user_id uuid references auth.users(id) on delete cascade primary key,

  monthly_take_home double precision not null default 0,
  paycheck_amount double precision not null default 0,
  paychecks_per_month integer not null default 0,

  hysa_balance double precision not null default 0,
  hysa_apy double precision not null default 0,
  cc_apr double precision not null default 0,

  jose_savings double precision not null default 0,
  sherlyna_savings double precision not null default 0,

  goal_hysa double precision not null default 0,
  hysa_goal_by_ym text not null default '',
  hysa_goal_by text not null default '',

  monthly_fixed_expenses double precision not null default 0,
  efund_months integer not null default 0,
  fun_budget double precision not null default 0,

  phase1 jsonb not null default '{}'::jsonb,
  phase2 jsonb not null default '{}'::jsonb,

  months_debt_payoff integer not null default 0,
  months_hysa_build integer not null default 0,
  debt_free_by text not null default '',

  months_to_debt_free integer not null default 0,
  months_to_hysa_goal integer not null default 0,
  net_worth_goal_k double precision not null default 0,
  phase2_hysa_result_k double precision not null default 0,

  interest_note jsonb not null default '{}'::jsonb,
  labels jsonb not null default '{}'::jsonb,

  debts_editor_sort text not null default 'saved',
  debts_progress_sort text not null default 'saved',

  working_month_ym text not null default '',
  dashboard_view_month_ym text not null default '',
  timeline_start date,

  updated_at timestamptz default now()
);

alter table public.financial_plans enable row level security;
create policy "Users can read own plan" on public.financial_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plan" on public.financial_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plan" on public.financial_plans for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- debts + payment_history (per-user collections)
-- ---------------------------------------------------------------------------

create table if not exists public.debts (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  name text not null default 'Debt',
  current double precision not null default 0,
  paid_off double precision not null default 0,
  apr_pct double precision not null default 0,
  deferred_amount double precision not null default 0,
  deferred_expires_on text not null default '',
  deferred_months_remaining integer not null default 0,
  primary key (user_id, id)
);

alter table public.debts enable row level security;
create policy "Users can read own debts" on public.debts for select using (auth.uid() = user_id);
create policy "Users can insert own debts" on public.debts for insert with check (auth.uid() = user_id);
create policy "Users can update own debts" on public.debts for update using (auth.uid() = user_id);
create policy "Users can delete own debts" on public.debts for delete using (auth.uid() = user_id);

create table if not exists public.payment_history (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  debt_id text not null,
  amount double precision not null default 0,
  at timestamptz not null,
  primary key (user_id, id),
  constraint payment_history_debt_fk foreign key (user_id, debt_id) references public.debts(user_id, id) on delete cascade
);

alter table public.payment_history enable row level security;
create policy "Users can read own payments" on public.payment_history for select using (auth.uid() = user_id);
create policy "Users can insert own payments" on public.payment_history for insert with check (auth.uid() = user_id);
create policy "Users can update own payments" on public.payment_history for update using (auth.uid() = user_id);
create policy "Users can delete own payments" on public.payment_history for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- savings_accounts + deposit_history (per-user collections)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_accounts (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  name text not null default 'Account',
  current double precision not null default 0,
  apy_pct double precision not null default 0,
  goal_ids jsonb not null default '[]'::jsonb,
  count_towards_goal boolean not null default false,
  primary key (user_id, id)
);

alter table public.savings_accounts enable row level security;
create policy "Users can read own savings accounts" on public.savings_accounts for select using (auth.uid() = user_id);
create policy "Users can insert own savings accounts" on public.savings_accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own savings accounts" on public.savings_accounts for update using (auth.uid() = user_id);
create policy "Users can delete own savings accounts" on public.savings_accounts for delete using (auth.uid() = user_id);

create table if not exists public.deposit_history (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  account_id text not null,
  amount double precision not null default 0,
  at timestamptz not null,
  primary key (user_id, id),
  constraint deposit_history_account_fk foreign key (user_id, account_id)
    references public.savings_accounts(user_id, id) on delete cascade
);

alter table public.deposit_history enable row level security;
create policy "Users can read own deposits" on public.deposit_history for select using (auth.uid() = user_id);
create policy "Users can insert own deposits" on public.deposit_history for insert with check (auth.uid() = user_id);
create policy "Users can update own deposits" on public.deposit_history for update using (auth.uid() = user_id);
create policy "Users can delete own deposits" on public.deposit_history for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- savings_goals (per-user list)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_goals (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  name text not null default 'Goal',
  target_amount double precision not null default 0,
  goal_by_ym text not null default '',
  primary key (user_id, id)
);

alter table public.savings_goals enable row level security;
create policy "Users can read own savings goals" on public.savings_goals for select using (auth.uid() = user_id);
create policy "Users can insert own savings goals" on public.savings_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own savings goals" on public.savings_goals for update using (auth.uid() = user_id);
create policy "Users can delete own savings goals" on public.savings_goals for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- check_ins (per-user journal)
-- ---------------------------------------------------------------------------

create table if not exists public.check_ins (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  date date not null,
  note text not null default '',
  created_at timestamptz default now(),
  primary key (user_id, id)
);

alter table public.check_ins enable row level security;
create policy "Users can read own check-ins" on public.check_ins for select using (auth.uid() = user_id);
create policy "Users can insert own check-ins" on public.check_ins for insert with check (auth.uid() = user_id);
create policy "Users can update own check-ins" on public.check_ins for update using (auth.uid() = user_id);
create policy "Users can delete own check-ins" on public.check_ins for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_cache (one row per user)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_cache (
  user_id uuid references auth.users(id) on delete cascade primary key,
  payoff_plan_text text,
  payoff_plan_fingerprint text,
  payoff_plan_truncated boolean,
  payoff_plan_at timestamptz,
  bill_calendar jsonb,
  bill_calendar_columns jsonb,
  updated_at timestamptz default now()
);

alter table public.ai_cache enable row level security;
create policy "Users can read own cache" on public.ai_cache for select using (auth.uid() = user_id);
create policy "Users can insert own cache" on public.ai_cache for insert with check (auth.uid() = user_id);
create policy "Users can update own cache" on public.ai_cache for update using (auth.uid() = user_id);
