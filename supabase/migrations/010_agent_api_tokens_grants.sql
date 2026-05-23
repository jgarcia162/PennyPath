-- PostgREST / Supabase API roles need explicit grants on tables created via SQL.
-- Without these, inserts fail with "permission denied for table agent_api_tokens"
-- even when using the service_role key from server scripts.

grant select, insert, update, delete on table public.agent_api_tokens to authenticated;
grant select, insert, update, delete on table public.agent_api_tokens to service_role;
