create table public.marine_conditions_cache (
  cache_key text primary key,
  payload jsonb not null,
  cached_at timestamptz not null default now(),
  fresh_until timestamptz not null,
  stale_until timestamptz not null,
  constraint marine_conditions_cache_expiry_order
    check (cached_at <= fresh_until and fresh_until <= stale_until)
);

comment on table public.marine_conditions_cache is
  'Server-only cache for public weather and marine observation APIs.';

alter table public.marine_conditions_cache enable row level security;

revoke all on table public.marine_conditions_cache from anon, authenticated;
grant select, insert, update, delete on table public.marine_conditions_cache to service_role;

create index marine_conditions_cache_stale_until_idx
  on public.marine_conditions_cache (stale_until);
