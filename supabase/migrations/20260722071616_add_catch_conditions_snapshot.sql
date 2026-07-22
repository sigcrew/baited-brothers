alter table public.user_catches
  add column if not exists conditions_snapshot jsonb;

comment on column public.user_catches.conditions_snapshot is
  'Immutable marine and weather conditions captured shortly after the catch is recorded.';
