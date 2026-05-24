-- Debt payment_history: payment vs charge (purchase); optional memo.
alter table public.payment_history
  add column if not exists kind text not null default 'payment';

alter table public.payment_history
  add column if not exists memo text not null default '';

alter table public.payment_history
  drop constraint if exists payment_history_kind_check;

alter table public.payment_history
  add constraint payment_history_kind_check
  check (kind in ('payment', 'charge'));

comment on column public.payment_history.kind is 'payment | charge';
comment on column public.payment_history.memo is 'Optional note (e.g. merchant)';

-- Savings deposit_history: deposit vs withdrawal; optional memo.
alter table public.deposit_history
  add column if not exists kind text not null default 'deposit';

alter table public.deposit_history
  add column if not exists memo text not null default '';

alter table public.deposit_history
  drop constraint if exists deposit_history_kind_check;

alter table public.deposit_history
  add constraint deposit_history_kind_check
  check (kind in ('deposit', 'withdrawal'));

comment on column public.deposit_history.kind is 'deposit | withdrawal';
comment on column public.deposit_history.memo is 'Optional note';
