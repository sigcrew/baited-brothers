-- Keep review, developer, and QA accounts out of product KPIs. This flag is
-- administrative: authenticated clients may read their own value but cannot
-- update it.
alter table public.user_profiles
  add column analytics_excluded boolean not null default false;

comment on column public.user_profiles.analytics_excluded is
  'Administrative flag. When true, this account is excluded from product analytics and aggregate KPI reports.';

revoke update on table public.user_profiles from authenticated;
grant update (display_name, avatar_url, updated_at)
  on table public.user_profiles to authenticated;

drop policy if exists "analytics_events_insert_own"
  on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce(
      (
        select not profile.analytics_excluded
        from public.user_profiles as profile
        where profile.id = (select auth.uid())
      ),
      false
    )
  );

-- Expand the strict event allow-list for the record/save and permission
-- funnels. Photos, coordinates, notes, and other content remain prohibited
-- from the properties payload.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events
  add constraint analytics_events_event_name_check check (
    event_name in (
      'app_opened',
      'collection_viewed',
      'fish_detail_viewed',
      'catch_card_opened',
      'catch_flow_started',
      'location_choice_selected',
      'camera_opened',
      'photo_captured',
      'analysis_result_viewed',
      'catch_save_started',
      'catch_save_succeeded',
      'catch_save_failed',
      'photo_upload_failed',
      'photo_library_save_succeeded',
      'photo_library_save_failed',
      'permission_prompted',
      'permission_result',
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
  );

-- Long-lived, anonymous daily event aggregates. Empty dimension strings avoid
-- nullable primary-key columns while preserving stable grouping.
create table public.analytics_daily (
  metric_date date not null,
  event_name text not null,
  platform text not null,
  app_version text not null,
  build_number text not null,
  event_count bigint not null check (event_count >= 0),
  user_count bigint not null check (user_count >= 0),
  refreshed_at timestamptz not null default now(),
  primary key (
    metric_date,
    event_name,
    platform,
    app_version,
    build_number
  )
);

create index analytics_daily_event_date_idx
  on public.analytics_daily (event_name, metric_date desc);

alter table public.analytics_daily enable row level security;
revoke all on table public.analytics_daily from public, anon, authenticated;
grant select, insert, update, delete
  on table public.analytics_daily to service_role;

comment on table public.analytics_daily is
  'Anonymous daily product-event aggregates retained after raw events expire.';

-- Monthly headline KPIs preserve correct distinct-user counts that cannot be
-- reconstructed by summing daily unique-user totals.
create table public.analytics_monthly (
  month_start date not null,
  metric_name text not null,
  metric_value numeric not null check (metric_value >= 0),
  refreshed_at timestamptz not null default now(),
  primary key (month_start, metric_name)
);

alter table public.analytics_monthly enable row level security;
revoke all on table public.analytics_monthly from public, anon, authenticated;
grant select, insert, update, delete
  on table public.analytics_monthly to service_role;

comment on table public.analytics_monthly is
  'Anonymous monthly product KPIs, including exact distinct-user counts.';

-- Signup-cohort retention is kept without user identifiers.
create table public.analytics_cohort_monthly (
  cohort_month date not null,
  activity_month date not null,
  cohort_size bigint not null check (cohort_size >= 0),
  retained_users bigint not null check (retained_users >= 0),
  retention_rate numeric not null check (
    retention_rate >= 0 and retention_rate <= 1
  ),
  refreshed_at timestamptz not null default now(),
  primary key (cohort_month, activity_month),
  check (activity_month >= cohort_month)
);

create index analytics_cohort_activity_idx
  on public.analytics_cohort_monthly (activity_month desc, cohort_month);

alter table public.analytics_cohort_monthly enable row level security;
revoke all on table public.analytics_cohort_monthly
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.analytics_cohort_monthly to service_role;

comment on table public.analytics_cohort_monthly is
  'Anonymous monthly retention by signup cohort. No user identifiers are stored.';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.refresh_analytics_aggregates()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_from date := current_date - 3;
  month_from date := (
    date_trunc('month', current_date) - interval '1 month'
  )::date;
begin
  delete from public.analytics_daily
  where metric_date >= daily_from;

  insert into public.analytics_daily (
    metric_date,
    event_name,
    platform,
    app_version,
    build_number,
    event_count,
    user_count,
    refreshed_at
  )
  select
    event.occurred_at::date,
    event.event_name,
    event.platform,
    event.app_version,
    coalesce(event.build_number, ''),
    count(*),
    count(distinct event.user_id),
    now()
  from public.analytics_events as event
  join public.user_profiles as profile on profile.id = event.user_id
  where event.occurred_at >= daily_from
    and not profile.analytics_excluded
  group by
    event.occurred_at::date,
    event.event_name,
    event.platform,
    event.app_version,
    coalesce(event.build_number, '');

  delete from public.analytics_monthly
  where month_start >= month_from;

  insert into public.analytics_monthly (
    month_start,
    metric_name,
    metric_value,
    refreshed_at
  )
  with month_bounds as (
    select
      month_start::date,
      (month_start + interval '1 month')::date as month_end
    from generate_series(
      month_from::timestamp,
      date_trunc('month', current_date),
      interval '1 month'
    ) as series(month_start)
  ),
  meaningful_activity as (
    select event.user_id, event.occurred_at
    from public.analytics_events as event
    join public.user_profiles as profile on profile.id = event.user_id
    where not profile.analytics_excluded
      and event.event_name in (
        'fish_detail_viewed',
        'catch_card_opened',
        'ai_analysis_started',
        'catch_save_succeeded',
        'trip_created',
        'trip_completed'
      )
    union all
    select catch.user_id, catch.created_at
    from public.user_catches as catch
    join public.user_profiles as profile on profile.id = catch.user_id
    where not profile.analytics_excluded
    union all
    select trip.user_id, trip.created_at
    from public.fishing_trips as trip
    join public.user_profiles as profile on profile.id = trip.user_id
    where not profile.analytics_excluded
  ),
  metrics as (
    select bounds.month_start, 'new_users'::text as metric_name,
      count(user_row.id)::numeric as metric_value
    from month_bounds as bounds
    left join auth.users as user_row
      on user_row.created_at >= bounds.month_start
      and user_row.created_at < bounds.month_end
    left join public.user_profiles as profile on profile.id = user_row.id
    where profile.id is null or not profile.analytics_excluded
    group by bounds.month_start

    union all

    select bounds.month_start, 'meaningful_active_users',
      count(distinct activity.user_id)::numeric
    from month_bounds as bounds
    left join meaningful_activity as activity
      on activity.occurred_at >= bounds.month_start
      and activity.occurred_at < bounds.month_end
    group by bounds.month_start

    union all

    select bounds.month_start, 'catches_created',
      count(catch.id)::numeric
    from month_bounds as bounds
    left join public.user_catches as catch
      on catch.created_at >= bounds.month_start
      and catch.created_at < bounds.month_end
    left join public.user_profiles as profile on profile.id = catch.user_id
    where profile.id is null or not profile.analytics_excluded
    group by bounds.month_start

    union all

    select bounds.month_start, 'catch_creators',
      count(distinct catch.user_id)::numeric
    from month_bounds as bounds
    left join public.user_catches as catch
      on catch.created_at >= bounds.month_start
      and catch.created_at < bounds.month_end
    left join public.user_profiles as profile on profile.id = catch.user_id
    where profile.id is null or not profile.analytics_excluded
    group by bounds.month_start

    union all

    select bounds.month_start, 'trips_created',
      count(trip.id)::numeric
    from month_bounds as bounds
    left join public.fishing_trips as trip
      on trip.created_at >= bounds.month_start
      and trip.created_at < bounds.month_end
    left join public.user_profiles as profile on profile.id = trip.user_id
    where profile.id is null or not profile.analytics_excluded
    group by bounds.month_start

    union all

    select bounds.month_start, 'trip_creators',
      count(distinct trip.user_id)::numeric
    from month_bounds as bounds
    left join public.fishing_trips as trip
      on trip.created_at >= bounds.month_start
      and trip.created_at < bounds.month_end
    left join public.user_profiles as profile on profile.id = trip.user_id
    where profile.id is null or not profile.analytics_excluded
    group by bounds.month_start
  )
  select month_start, metric_name, metric_value, now()
  from metrics;

  delete from public.analytics_cohort_monthly
  where activity_month >= month_from;

  insert into public.analytics_cohort_monthly (
    cohort_month,
    activity_month,
    cohort_size,
    retained_users,
    retention_rate,
    refreshed_at
  )
  with activity_months as (
    select month_start::date as activity_month
    from generate_series(
      month_from::timestamp,
      date_trunc('month', current_date),
      interval '1 month'
    ) as series(month_start)
  ),
  cohorts as (
    select
      user_row.id as user_id,
      date_trunc('month', user_row.created_at)::date as cohort_month
    from auth.users as user_row
    join public.user_profiles as profile on profile.id = user_row.id
    where not profile.analytics_excluded
  ),
  cohort_sizes as (
    select cohort_month, count(*) as cohort_size
    from cohorts
    group by cohort_month
  ),
  meaningful_activity as (
    select event.user_id, event.occurred_at
    from public.analytics_events as event
    where event.event_name in (
      'fish_detail_viewed',
      'catch_card_opened',
      'ai_analysis_started',
      'catch_save_succeeded',
      'trip_created',
      'trip_completed'
    )
    union all
    select catch.user_id, catch.created_at
    from public.user_catches as catch
    union all
    select trip.user_id, trip.created_at
    from public.fishing_trips as trip
  ),
  retained as (
    select
      cohort.cohort_month,
      month.activity_month,
      count(distinct activity.user_id) as retained_users
    from cohorts as cohort
    join activity_months as month
      on month.activity_month >= cohort.cohort_month
    left join meaningful_activity as activity
      on activity.user_id = cohort.user_id
      and activity.occurred_at >= month.activity_month
      and activity.occurred_at < month.activity_month + interval '1 month'
    group by cohort.cohort_month, month.activity_month
  )
  select
    retained.cohort_month,
    retained.activity_month,
    size.cohort_size,
    retained.retained_users,
    retained.retained_users::numeric / nullif(size.cohort_size, 0),
    now()
  from retained
  join cohort_sizes as size using (cohort_month);
end;
$$;

revoke all on function private.refresh_analytics_aggregates()
  from public, anon, authenticated, service_role;

-- Backfill all currently retained raw events before the first scheduled run.
insert into public.analytics_daily (
  metric_date,
  event_name,
  platform,
  app_version,
  build_number,
  event_count,
  user_count
)
select
  event.occurred_at::date,
  event.event_name,
  event.platform,
  event.app_version,
  coalesce(event.build_number, ''),
  count(*),
  count(distinct event.user_id)
from public.analytics_events as event
join public.user_profiles as profile on profile.id = event.user_id
where not profile.analytics_excluded
group by
  event.occurred_at::date,
  event.event_name,
  event.platform,
  event.app_version,
  coalesce(event.build_number, '');

select private.refresh_analytics_aggregates();

select cron.schedule(
  'refresh-product-analytics-daily',
  '47 2 * * *',
  $$select private.refresh_analytics_aggregates()$$
);
