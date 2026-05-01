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

-- Legacy: early deployments stored the entire plan in `financial_plans.payload` (jsonb).
-- Keep the column if it already exists and use it to backfill scalar columns.
alter table public.financial_plans add column if not exists payload jsonb;

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

-- Backfill scalars from legacy JSON payload (idempotent: does not overwrite non-default values).
update public.financial_plans
set
  monthly_take_home = case
    when monthly_take_home = 0 and (payload->>'monthlyTakeHome') ~ '^-?\\d' then (payload->>'monthlyTakeHome')::double precision
    else monthly_take_home
  end,
  paycheck_amount = case
    when paycheck_amount = 0 and (payload->>'paycheckAmount') ~ '^-?\\d' then (payload->>'paycheckAmount')::double precision
    else paycheck_amount
  end,
  paychecks_per_month = case
    when paychecks_per_month = 0 and (payload->>'paychecksPerMonth') ~ '^-?\\d' then (payload->>'paychecksPerMonth')::integer
    else paychecks_per_month
  end,
  hysa_balance = case
    when hysa_balance = 0 and (payload->>'hysaBalance') ~ '^-?\\d' then (payload->>'hysaBalance')::double precision
    else hysa_balance
  end,
  hysa_apy = case
    when hysa_apy = 0 and (payload->>'hysaApy') ~ '^-?\\d' then (payload->>'hysaApy')::double precision
    else hysa_apy
  end,
  cc_apr = case
    when cc_apr = 0 and (payload->>'ccApr') ~ '^-?\\d' then (payload->>'ccApr')::double precision
    else cc_apr
  end,
  jose_savings = case
    when jose_savings = 0 and (payload->>'joseSavings') ~ '^-?\\d' then (payload->>'joseSavings')::double precision
    else jose_savings
  end,
  sherlyna_savings = case
    when sherlyna_savings = 0 and (payload->>'sherlynaSavings') ~ '^-?\\d' then (payload->>'sherlynaSavings')::double precision
    else sherlyna_savings
  end,
  goal_hysa = case
    when goal_hysa = 0 and (payload->>'goalHysa') ~ '^-?\\d' then (payload->>'goalHysa')::double precision
    else goal_hysa
  end,
  hysa_goal_by_ym = case
    when hysa_goal_by_ym = '' and (payload->>'hysaGoalByYm') ~ '^\\d{4}-\\d{2}$' then (payload->>'hysaGoalByYm')
    else hysa_goal_by_ym
  end,
  hysa_goal_by = case
    when hysa_goal_by = '' and payload ? 'hysaGoalBy' then coalesce(nullif(payload->>'hysaGoalBy', ''), hysa_goal_by)
    else hysa_goal_by
  end,
  monthly_fixed_expenses = case
    when monthly_fixed_expenses = 0 and (payload->>'monthlyFixedExpenses') ~ '^-?\\d' then (payload->>'monthlyFixedExpenses')::double precision
    else monthly_fixed_expenses
  end,
  efund_months = case
    when efund_months = 0 and (payload->>'efundMonths') ~ '^-?\\d' then (payload->>'efundMonths')::integer
    else efund_months
  end,
  fun_budget = case
    when fun_budget = 0 and (payload->>'funBudget') ~ '^-?\\d' then (payload->>'funBudget')::double precision
    else fun_budget
  end,
  phase1 = case
    when phase1 = '{}'::jsonb and payload ? 'phase1' then (payload->'phase1')::jsonb
    else phase1
  end,
  phase2 = case
    when phase2 = '{}'::jsonb and payload ? 'phase2' then (payload->'phase2')::jsonb
    else phase2
  end,
  months_debt_payoff = case
    when months_debt_payoff = 0 and (payload->>'monthsDebtPayoff') ~ '^-?\\d' then (payload->>'monthsDebtPayoff')::integer
    else months_debt_payoff
  end,
  months_hysa_build = case
    when months_hysa_build = 0 and (payload->>'monthsHysaBuild') ~ '^-?\\d' then (payload->>'monthsHysaBuild')::integer
    else months_hysa_build
  end,
  debt_free_by = case
    when debt_free_by = '' and payload ? 'debtFreeBy' then coalesce(nullif(payload->>'debtFreeBy', ''), debt_free_by)
    else debt_free_by
  end,
  months_to_debt_free = case
    when months_to_debt_free = 0 and (payload->>'monthsToDebtFree') ~ '^-?\\d' then (payload->>'monthsToDebtFree')::integer
    else months_to_debt_free
  end,
  months_to_hysa_goal = case
    when months_to_hysa_goal = 0 and (payload->>'monthsToHysaGoal') ~ '^-?\\d' then (payload->>'monthsToHysaGoal')::integer
    else months_to_hysa_goal
  end,
  net_worth_goal_k = case
    when net_worth_goal_k = 0 and (payload->>'netWorthGoalK') ~ '^-?\\d' then (payload->>'netWorthGoalK')::double precision
    else net_worth_goal_k
  end,
  phase2_hysa_result_k = case
    when phase2_hysa_result_k = 0 and (payload->>'phase2HysaResultK') ~ '^-?\\d' then (payload->>'phase2HysaResultK')::double precision
    else phase2_hysa_result_k
  end,
  interest_note = case
    when interest_note = '{}'::jsonb and payload ? 'interestNote' then (payload->'interestNote')::jsonb
    else interest_note
  end,
  labels = case
    when labels = '{}'::jsonb and payload ? 'labels' then (payload->'labels')::jsonb
    else labels
  end,
  debts_editor_sort = case
    when debts_editor_sort = 'saved' and payload ? 'debtsEditorSort' then coalesce(nullif(payload->>'debtsEditorSort', ''), debts_editor_sort)
    else debts_editor_sort
  end,
  debts_progress_sort = case
    when debts_progress_sort = 'saved' and payload ? 'debtsProgressSort' then coalesce(nullif(payload->>'debtsProgressSort', ''), debts_progress_sort)
    else debts_progress_sort
  end,
  working_month_ym = case
    when working_month_ym = '' and (payload->>'workingMonthYm') ~ '^\\d{4}-\\d{2}$' then (payload->>'workingMonthYm')
    else working_month_ym
  end,
  dashboard_view_month_ym = case
    when dashboard_view_month_ym = '' and (payload->>'dashboardViewMonthYm') ~ '^\\d{4}-\\d{2}$' then (payload->>'dashboardViewMonthYm')
    else dashboard_view_month_ym
  end,
  timeline_start = case
    when timeline_start is null and (payload->>'timelineStart') ~ '^\\d{4}-\\d{2}-\\d{2}$' then (payload->>'timelineStart')::date
    else timeline_start
  end
where payload is not null and payload <> '{}'::jsonb;

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

-- Remove orphan payments before adding composite FK.
delete from public.payment_history ph
where not exists (
  select 1
  from public.debts d
  where d.user_id = ph.user_id and d.id = ph.debt_id
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_history_debt_fk') then
    alter table public.payment_history
      add constraint payment_history_debt_fk
      foreign key (user_id, debt_id) references public.debts(user_id, id) on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payment_history_debt_fk' and convalidated = false) then
    alter table public.payment_history validate constraint payment_history_debt_fk;
  end if;
end $$;

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

-- Remove orphan deposits before adding composite FK.
delete from public.deposit_history dh
where not exists (
  select 1
  from public.savings_accounts a
  where a.user_id = dh.user_id and a.id = dh.account_id
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deposit_history_account_fk') then
    alter table public.deposit_history
      add constraint deposit_history_account_fk
      foreign key (user_id, account_id) references public.savings_accounts(user_id, id) on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'deposit_history_account_fk' and convalidated = false) then
    alter table public.deposit_history validate constraint deposit_history_account_fk;
  end if;
end $$;

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

