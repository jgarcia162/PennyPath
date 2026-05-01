-- User-scoped misc state that used to live in localStorage:
-- - milestone badges unlocks
-- - month wrap archives + one-step rollback payload

create table if not exists financial_plan_state (
  user_id uuid references auth.users(id) on delete cascade primary key,
  badges jsonb not null default '{}'::jsonb,
  month_wrap_archives jsonb not null default '[]'::jsonb,
  month_wrap_rollback jsonb,
  updated_at timestamptz default now()
);

alter table financial_plan_state enable row level security;

-- Make migration re-runnable (common when iterating on schema).
drop policy if exists "Users can read own plan state" on financial_plan_state;
drop policy if exists "Users can insert own plan state" on financial_plan_state;
drop policy if exists "Users can update own plan state" on financial_plan_state;

create policy "Users can read own plan state"
on financial_plan_state for select
using (auth.uid() = user_id);

create policy "Users can insert own plan state"
on financial_plan_state for insert
with check (auth.uid() = user_id);

create policy "Users can update own plan state"
on financial_plan_state for update
using (auth.uid() = user_id);

