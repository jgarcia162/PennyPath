-- Enforce allowed ledger_status values at the DB (columns added in 006 / 007).

alter table public.debts
  drop constraint if exists debts_ledger_status_check;

alter table public.debts
  add constraint debts_ledger_status_check
  check (ledger_status in ('active', 'completed', 'deleted'));

comment on constraint debts_ledger_status_check on public.debts is
  'Matches app DebtLedgerStatus / debt-ledger normalization.';

alter table public.savings_accounts
  drop constraint if exists savings_accounts_ledger_status_check;

alter table public.savings_accounts
  add constraint savings_accounts_ledger_status_check
  check (ledger_status in ('active', 'deleted'));

comment on constraint savings_accounts_ledger_status_check on public.savings_accounts is
  'Matches app SavingsLedgerStatus / savings-ledger normalization.';
