-- Agent API tokens for Claude Code / MCP (hashed at rest; service role validates).

create table if not exists public.agent_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Agent token',
  token_hash text not null unique,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_api_tokens_user_id_idx on public.agent_api_tokens (user_id);
create index if not exists agent_api_tokens_token_hash_idx on public.agent_api_tokens (token_hash);

alter table public.agent_api_tokens enable row level security;

-- Users manage their own tokens via the dashboard (future); service role used by Agent API lookup.
drop policy if exists "Users can read own agent tokens" on public.agent_api_tokens;
create policy "Users can read own agent tokens"
  on public.agent_api_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own agent tokens" on public.agent_api_tokens;
create policy "Users can insert own agent tokens"
  on public.agent_api_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own agent tokens" on public.agent_api_tokens;
create policy "Users can update own agent tokens"
  on public.agent_api_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own agent tokens" on public.agent_api_tokens;
create policy "Users can delete own agent tokens"
  on public.agent_api_tokens for delete
  using (auth.uid() = user_id);
