-- Agent API uses the service_role client with explicit user_id filters.
-- Tables created via SQL need grants for PostgREST / supabase-js (same as 010 for agent_api_tokens).

grant select, insert, update, delete on table public.debts to service_role;
grant select, insert, update, delete on table public.payment_history to service_role;
grant select, insert, update, delete on table public.savings_accounts to service_role;
grant select, insert, update, delete on table public.deposit_history to service_role;
grant select, update on table public.financial_plans to service_role;
