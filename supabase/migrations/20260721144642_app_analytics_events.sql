-- Minimal, first-party product analytics.
-- Business outcomes such as catches and trips remain in their source tables.
-- This table stores only interaction events that cannot be reconstructed later.
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 80),
  event_name text not null check (
    event_name in (
      'app_opened',
      'collection_viewed',
      'fish_detail_viewed',
      'catch_card_opened',
      'ai_analysis_started',
      'ai_analysis_succeeded',
      'ai_analysis_rejected',
      'ai_analysis_failed',
      'ai_candidate_confirmed',
      'manual_species_confirmed',
      'catch_created',
      'catch_updated',
      'catch_deleted',
      'trip_created',
      'trip_updated',
      'trip_completed',
      'trip_canceled',
      'trip_deleted'
    )
  ),
  properties jsonb not null default '{}'::jsonb check (
    jsonb_typeof(properties) = 'object'
    and octet_length(properties::text) <= 4096
  ),
  app_version text not null check (char_length(app_version) between 1 and 32),
  build_number text,
  platform text not null check (char_length(platform) between 1 and 16),
  occurred_at timestamptz not null default now()
);

create index analytics_events_user_occurred_idx
  on public.analytics_events (user_id, occurred_at desc);
create index analytics_events_name_occurred_idx
  on public.analytics_events (event_name, occurred_at desc);

alter table public.analytics_events enable row level security;

-- Clients may append their own events, but may not read, alter, or delete raw
-- analytics rows. Administrative reporting uses the Dashboard/service role.
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.analytics_events from public, anon, authenticated;
grant insert on table public.analytics_events to authenticated;
grant select, insert, update, delete on table public.analytics_events to service_role;

comment on table public.analytics_events is
  'First-party product interaction events. Raw rows are retained for up to 90 days and cascade-delete with the user.';
comment on column public.analytics_events.properties is
  'Flat, non-sensitive metadata only. Do not store photos, coordinates, notes, email addresses, or tokens.';

-- Enforce the published 90-day raw-event retention period. Aggregated reports
-- must not include user identifiers before raw events are removed.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-analytics-events-90d',
  '17 3 * * *',
  $$delete from public.analytics_events where occurred_at < now() - interval '90 days'$$
);
