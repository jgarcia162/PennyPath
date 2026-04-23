-- Financial plan: one row per user
create table financial_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  payload jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table financial_plans enable row level security;
create policy "Users can read own plan" on financial_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plan" on financial_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plan" on financial_plans for update using (auth.uid() = user_id);

-- AI cache: one row per user
create table ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  payoff_plan text,
  bill_calendar jsonb,
  bill_calendar_columns jsonb,
  updated_at timestamptz default now()
);
alter table ai_cache enable row level security;
create policy "Users can read own cache" on ai_cache for select using (auth.uid() = user_id);
create policy "Users can insert own cache" on ai_cache for insert with check (auth.uid() = user_id);
create policy "Users can update own cache" on ai_cache for update using (auth.uid() = user_id);
