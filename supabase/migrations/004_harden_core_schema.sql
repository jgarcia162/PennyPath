-- Harden core schema to be re-runnable AND to fix older deployments where
-- tables existed with a different shape (e.g. early `financial_plans(payload)`).
--
-- This migration is intentionally defensive: it adds missing columns and
-- creates the composite uniqueness we rely on for per-user upserts.

-- ---------------------------------------------------------------------------
-- financial_plans
-- ---------------------------------------------------------------------------

create table if not exists public.financial_plans (
  user_id uuid references auth.users(id) on delete cascade primary key,
  updated_at timestamptz default now()
);

alter table public.financial_plans enable row level security;

alter table public.financial_plans add column if not exists monthly_take_home double precision not null default 0;
alter table public.financial_plans add column if not exists paycheck_amount double precision not null default 0;
alter table public.financial_plans add column if not exists paychecks_per_month integer not null default 0;
alter table public.financial_plans add column if not exists hysa_balance double precision not null default 0;
alter table public.financial_plans add column if not exists hysa_apy double precision not null default 0;
alter table public.financial_plans add column if not exists cc_apr double precision not null default 0;
alter table public.financial_plans add column if not exists jose_savings double precision not null default 0;
alter table public.financial_plans add column if not exists sherlyna_savings double precision not null default 0;
alter table public.financial_plans add column if not exists goal_hysa double precision not null default 0;
alter table public.financial_plans add column if not exists hysa_goal_by_ym text not null default '';
alter table public.financial_plans add column if not exists hysa_goal_by text not null default '';
alter table public.financial_plans add column if not exists monthly_fixed_expenses double precision not null default 0;
alter table public.financial_plans add column if not exists efund_months integer not null default 0;
alter table public.financial_plans add column if not exists fun_budget double precision not null default 0;
alter table public.financial_plans add column if not exists phase1 jsonb not null default '{}'::jsonb;
alter table public.financial_plans add column if not exists phase2 jsonb not null default '{}'::jsonb;
alter table public.financial_plans add column if not exists months_debt_payoff integer not null default 0;
alter table public.financial_plans add column if not exists months_hysa_build integer not null default 0;
alter table public.financial_plans add column if not exists debt_free_by text not null default '';
alter table public.financial_plans add column if not exists months_to_debt_free integer not null default 0;
alter table public.financial_plans add column if not exists months_to_hysa_goal integer not null default 0;
alter table public.financial_plans add column if not exists net_worth_goal_k double precision not null default 0;
alter table public.financial_plans add column if not exists phase2_hysa_result_k double precision not null default 0;
alter table public.financial_plans add column if not exists interest_note jsonb not null default '{}'::jsonb;
alter table public.financial_plans add column if not exists labels jsonb not null default '{}'::jsonb;
alter table public.financial_plans add column if not exists debts_editor_sort text not null default 'saved';
alter table public.financial_plans add column if not exists debts_progress_sort text not null default 'saved';
alter table public.financial_plans add column if not exists working_month_ym text not null default '';
alter table public.financial_plans add column if not exists dashboard_view_month_ym text not null default '';
alter table public.financial_plans add column if not exists timeline_start date;

drop policy if exists "Users can read own plan" on public.financial_plans;
drop policy if exists "Users can insert own plan" on public.financial_plans;
drop policy if exists "Users can update own plan" on public.financial_plans;
create policy "Users can read own plan" on public.financial_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plan" on public.financial_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plan" on public.financial_plans for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- debts + payment_history
-- ---------------------------------------------------------------------------

create table if not exists public.debts (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  primary key (user_id, id)
);
alter table public.debts enable row level security;
alter table public.debts add column if not exists name text not null default 'Debt';
alter table public.debts add column if not exists current double precision not null default 0;
alter table public.debts add column if not exists paid_off double precision not null default 0;
alter table public.debts add column if not exists apr_pct double precision not null default 0;
alter table public.debts add column if not exists deferred_amount double precision not null default 0;
alter table public.debts add column if not exists deferred_expires_on text not null default '';
alter table public.debts add column if not exists deferred_months_remaining integer not null default 0;
create unique index if not exists debts_user_id_id_uq on public.debts(user_id, id);

drop policy if exists "Users can read own debts" on public.debts;
drop policy if exists "Users can insert own debts" on public.debts;
drop policy if exists "Users can update own debts" on public.debts;
drop policy if exists "Users can delete own debts" on public.debts;
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
  primary key (user_id, id)
);
alter table public.payment_history enable row level security;
create unique index if not exists payment_history_user_id_id_uq on public.payment_history(user_id, id);

drop policy if exists "Users can read own payments" on public.payment_history;
drop policy if exists "Users can insert own payments" on public.payment_history;
drop policy if exists "Users can update own payments" on public.payment_history;
drop policy if exists "Users can delete own payments" on public.payment_history;
create policy "Users can read own payments" on public.payment_history for select using (auth.uid() = user_id);
create policy "Users can insert own payments" on public.payment_history for insert with check (auth.uid() = user_id);
create policy "Users can update own payments" on public.payment_history for update using (auth.uid() = user_id);
create policy "Users can delete own payments" on public.payment_history for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- savings_accounts + deposit_history
-- ---------------------------------------------------------------------------

create table if not exists public.savings_accounts (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  primary key (user_id, id)
);
alter table public.savings_accounts enable row level security;
alter table public.savings_accounts add column if not exists name text not null default 'Account';
alter table public.savings_accounts add column if not exists current double precision not null default 0;
alter table public.savings_accounts add column if not exists apy_pct double precision not null default 0;
alter table public.savings_accounts add column if not exists goal_ids jsonb not null default '[]'::jsonb;
alter table public.savings_accounts add column if not exists count_towards_goal boolean not null default false;
create unique index if not exists savings_accounts_user_id_id_uq on public.savings_accounts(user_id, id);

drop policy if exists "Users can read own savings accounts" on public.savings_accounts;
drop policy if exists "Users can insert own savings accounts" on public.savings_accounts;
drop policy if exists "Users can update own savings accounts" on public.savings_accounts;
drop policy if exists "Users can delete own savings accounts" on public.savings_accounts;
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
  primary key (user_id, id)
);
alter table public.deposit_history enable row level security;
create unique index if not exists deposit_history_user_id_id_uq on public.deposit_history(user_id, id);

drop policy if exists "Users can read own deposits" on public.deposit_history;
drop policy if exists "Users can insert own deposits" on public.deposit_history;
drop policy if exists "Users can update own deposits" on public.deposit_history;
drop policy if exists "Users can delete own deposits" on public.deposit_history;
create policy "Users can read own deposits" on public.deposit_history for select using (auth.uid() = user_id);
create policy "Users can insert own deposits" on public.deposit_history for insert with check (auth.uid() = user_id);
create policy "Users can update own deposits" on public.deposit_history for update using (auth.uid() = user_id);
create policy "Users can delete own deposits" on public.deposit_history for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- savings_goals
-- ---------------------------------------------------------------------------

create table if not exists public.savings_goals (
  user_id uuid references auth.users(id) on delete cascade not null,
  id text not null,
  primary key (user_id, id)
);
alter table public.savings_goals enable row level security;
alter table public.savings_goals add column if not exists name text not null default 'Goal';
alter table public.savings_goals add column if not exists target_amount double precision not null default 0;
alter table public.savings_goals add column if not exists goal_by_ym text not null default '';
create unique index if not exists savings_goals_user_id_id_uq on public.savings_goals(user_id, id);

drop policy if exists "Users can read own savings goals" on public.savings_goals;
drop policy if exists "Users can insert own savings goals" on public.savings_goals;
drop policy if exists "Users can update own savings goals" on public.savings_goals;
drop policy if exists "Users can delete own savings goals" on public.savings_goals;
create policy "Users can read own savings goals" on public.savings_goals for select using (auth.uid() = user_id);
create policy "Users can insert own savings goals" on public.savings_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own savings goals" on public.savings_goals for update using (auth.uid() = user_id);
create policy "Users can delete own savings goals" on public.savings_goals for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- check_ins
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
create unique index if not exists check_ins_user_id_id_uq on public.check_ins(user_id, id);

drop policy if exists "Users can read own check-ins" on public.check_ins;
drop policy if exists "Users can insert own check-ins" on public.check_ins;
drop policy if exists "Users can update own check-ins" on public.check_ins;
drop policy if exists "Users can delete own check-ins" on public.check_ins;
create policy "Users can read own check-ins" on public.check_ins for select using (auth.uid() = user_id);
create policy "Users can insert own check-ins" on public.check_ins for insert with check (auth.uid() = user_id);
create policy "Users can update own check-ins" on public.check_ins for update using (auth.uid() = user_id);
create policy "Users can delete own check-ins" on public.check_ins for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_cache (minimal: other columns are optional; repo handles nulls)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_cache (
  user_id uuid references auth.users(id) on delete cascade primary key,
  updated_at timestamptz default now()
);
alter table public.ai_cache enable row level security;
alter table public.ai_cache add column if not exists payoff_plan_text text;
alter table public.ai_cache add column if not exists payoff_plan_fingerprint text;
alter table public.ai_cache add column if not exists payoff_plan_truncated boolean;
alter table public.ai_cache add column if not exists payoff_plan_at timestamptz;
alter table public.ai_cache add column if not exists bill_calendar jsonb;
alter table public.ai_cache add column if not exists bill_calendar_columns jsonb;

drop policy if exists "Users can read own cache" on public.ai_cache;
drop policy if exists "Users can insert own cache" on public.ai_cache;
drop policy if exists "Users can update own cache" on public.ai_cache;
create policy "Users can read own cache" on public.ai_cache for select using (auth.uid() = user_id);
create policy "Users can insert own cache" on public.ai_cache for insert with check (auth.uid() = user_id);
create policy "Users can update own cache" on public.ai_cache for update using (auth.uid() = user_id);

