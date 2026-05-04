-- Debt archive: active vs paid-off vs soft-deleted; lifetime payoff stats.

alter table public.debts
  add column if not exists ledger_status text not null default 'active';

comment on column public.debts.ledger_status is 'active | completed | deleted';

alter table public.financial_plans
  add column if not exists debts_paid_off_lifetime_count integer not null default 0;

comment on column public.financial_plans.debts_paid_off_lifetime_count is
  'Increments when a debt first reaches paid-off (completed); not decremented when archived to deleted.';
