-- Soft-delete savings rows (same semantics as debts ledger_status).

alter table public.savings_accounts
  add column if not exists ledger_status text not null default 'active';

comment on column public.savings_accounts.ledger_status is 'active | deleted';
