-- v1 core loop data model:
-- 1. Allow an owned catch's species to be corrected while preserving evidence.
-- 2. Allow general records for species outside the reviewed FIELD 60 catalog.
-- 3. Enforce the AI identification rolling 24-hour quota on the server.

alter table public.user_catches
  drop column if exists collection_eligible,
  drop column if exists ranking_eligible;

alter table public.user_catches
  alter column fish_id drop not null,
  add column if not exists custom_species_name text,
  add column if not exists original_fish_id uuid
    references public.fishes(id) on delete restrict,
  add column if not exists original_custom_species_name text,
  add column if not exists species_corrected_at timestamptz;

alter table public.user_catches
  add constraint user_catches_species_present check (
    (
      fish_id is not null
      and custom_species_name is null
    )
    or (
      fish_id is null
      and custom_species_name is not null
      and char_length(btrim(custom_species_name)) between 1 and 80
    )
  ),
  add constraint user_catches_original_custom_species_name_valid check (
    original_custom_species_name is null
    or char_length(btrim(original_custom_species_name)) between 1 and 80
  );

alter table public.user_catches
  add column collection_eligible boolean generated always as (
    fish_id is not null
    and verification_status in (
      'verified',
      'field_verified',
      'metadata_verified'
    )
  ) stored,
  add column ranking_eligible boolean generated always as (
    fish_id is not null
    and species_corrected_at is null
    and verification_status in ('verified', 'field_verified')
  ) stored;

create index if not exists user_catches_species_corrected_at_idx
  on public.user_catches (user_id, species_corrected_at desc)
  where species_corrected_at is not null;

create table if not exists private.catch_species_changes (
  id bigint generated always as identity primary key,
  catch_id uuid not null
    references public.user_catches(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  changed_by uuid
    references auth.users(id) on delete set null,
  old_fish_id uuid
    references public.fishes(id) on delete restrict,
  old_custom_species_name text,
  new_fish_id uuid
    references public.fishes(id) on delete restrict,
  new_custom_species_name text,
  changed_at timestamptz not null default now()
);

create index if not exists catch_species_changes_catch_changed_at_idx
  on private.catch_species_changes (catch_id, changed_at desc);

alter table private.catch_species_changes enable row level security;
revoke all on table private.catch_species_changes
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.catch_species_changes to service_role;

create or replace function public.protect_catch_verification_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  species_changed boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      -- Clients may choose a reviewed catalog species or a free-text general
      -- record, but they cannot forge correction or verification history.
      new.custom_species_name := nullif(btrim(new.custom_species_name), '');
      new.original_fish_id := null;
      new.original_custom_species_name := null;
      new.species_corrected_at := null;

      -- captured_at이 없는 기존 배포 앱의 live_camera 저장은 한 릴리스 동안
      -- 레거시 동작을 유지한다. v2 앱과 사진 보관함 경로는 서버 판정을 강제한다.
      if new.captured_at is not null or new.capture_method = 'photo_library' then
        new.verification_status := 'pending';
        new.verification_reason := null;
        new.image_hash := null;
        new.verification_version := null;
        new.verified_at := null;
      end if;

      if new.fish_id is null then
        new.id_method := null;
        new.verification_status := 'general_record';
        new.verification_reason := 'species_outside_catalog';
        new.image_hash := null;
        new.verification_version := null;
        new.verified_at := null;
      end if;
    else
      new.custom_species_name := nullif(btrim(new.custom_species_name), '');
      species_changed :=
        old.fish_id is distinct from new.fish_id
        or old.custom_species_name is distinct from new.custom_species_name;

      new.user_id := old.user_id;
      new.capture_method := old.capture_method;
      new.captured_at := old.captured_at;
      new.location_lat := old.location_lat;
      new.location_lng := old.location_lng;
      new.location_accuracy_m := old.location_accuracy_m;
      new.location_captured_at := old.location_captured_at;
      new.image_path := old.image_path;
      new.image_url := old.image_url;
      new.thumbnail_path := old.thumbnail_path;
      new.candidate_fish_ids := old.candidate_fish_ids;
      new.client_request_id := old.client_request_id;
      new.verification_status := old.verification_status;
      new.verification_reason := old.verification_reason;
      new.image_hash := old.image_hash;
      new.verification_version := old.verification_version;
      new.verified_at := old.verified_at;
      new.original_fish_id := old.original_fish_id;
      new.original_custom_species_name := old.original_custom_species_name;
      new.species_corrected_at := old.species_corrected_at;

      if species_changed then
        if old.species_corrected_at is null then
          new.original_fish_id := old.fish_id;
          new.original_custom_species_name := old.custom_species_name;
        end if;
        new.species_corrected_at := now();

        -- A correction is always an explicit user choice, never a fresh AI
        -- assertion. Outside-catalog species are general records. A correction
        -- back to a reviewed species is re-verified by the existing endpoint.
        if new.fish_id is null then
          new.id_method := null;
          new.verification_status := 'general_record';
          new.verification_reason := 'species_outside_catalog';
          new.image_hash := null;
          new.verification_version := null;
          new.verified_at := null;
        else
          new.id_method := 'fallback_catalog';
          if old.verification_status = 'general_record'
            and new.image_path is not null
          then
            new.verification_status := 'pending';
            new.verification_reason := null;
            new.image_hash := null;
            new.verification_version := null;
            new.verified_at := null;
          end if;
        end if;
      else
        new.id_method := old.id_method;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_catch_verification_fields()
  from public, anon, authenticated;

create or replace function private.audit_catch_species_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.fish_id is distinct from new.fish_id
    or old.custom_species_name is distinct from new.custom_species_name
  then
    insert into private.catch_species_changes (
      catch_id,
      user_id,
      changed_by,
      old_fish_id,
      old_custom_species_name,
      new_fish_id,
      new_custom_species_name
    )
    values (
      new.id,
      new.user_id,
      auth.uid(),
      old.fish_id,
      old.custom_species_name,
      new.fish_id,
      new.custom_species_name
    );
  end if;
  return new;
end;
$$;

revoke all on function private.audit_catch_species_change()
  from public, anon, authenticated;
grant execute on function private.audit_catch_species_change()
  to service_role;

drop trigger if exists audit_catch_species_change
  on public.user_catches;

create trigger audit_catch_species_change
after update of fish_id, custom_species_name on public.user_catches
for each row execute function private.audit_catch_species_change();

create table if not exists private.ai_identification_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists ai_identification_requests_user_requested_idx
  on private.ai_identification_requests (user_id, requested_at desc);

alter table private.ai_identification_requests enable row level security;
revoke all on table private.ai_identification_requests
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.ai_identification_requests to service_role;

create or replace function public.consume_ai_identification_quota()
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_count integer;
  oldest_request timestamptz;
  quota_limit constant integer := 30;
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Serialize quota consumption for this user so parallel requests cannot
  -- exceed the rolling-window limit.
  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text, 20260730)
  );

  delete from private.ai_identification_requests
  where user_id = current_user_id
    and requested_at <= now() - interval '24 hours';

  select count(*)::integer, min(requested_at)
  into request_count, oldest_request
  from private.ai_identification_requests
  where user_id = current_user_id;

  if request_count >= quota_limit then
    return query
    select
      false,
      0,
      oldest_request + interval '24 hours';
    return;
  end if;

  insert into private.ai_identification_requests (user_id)
  values (current_user_id);

  return query
  select
    true,
    quota_limit - request_count - 1,
    case
      when request_count + 1 >= quota_limit
        then coalesce(oldest_request, now()) + interval '24 hours'
      else null::timestamptz
    end;
end;
$$;

revoke all on function public.consume_ai_identification_quota()
  from public, anon;
grant execute on function public.consume_ai_identification_quota()
  to authenticated, service_role;

create or replace function private.core_loop_retention_snapshot(
  snapshot_at timestamptz default now()
)
returns table (
  activation_date date,
  activated_users bigint,
  retained_users bigint,
  retention_rate numeric,
  decision_ready boolean
)
language sql
security definer
set search_path = ''
as $$
  with eligible_catches as (
    select
      catch.id,
      catch.user_id,
      catch.fish_id,
      catch.trip_id,
      catch.caught_at,
      row_number() over (
        partition by catch.user_id
        order by catch.caught_at, catch.id
      ) as activation_order
    from public.user_catches as catch
    join public.user_profiles as profile
      on profile.id = catch.user_id
    where catch.collection_eligible
      and catch.fish_id is not null
      and not profile.analytics_excluded
      and catch.caught_at <= snapshot_at
  ),
  activations as (
    select *
    from eligible_catches
    where activation_order = 1
      and caught_at <= snapshot_at - interval '60 days'
  ),
  outcomes as (
    select
      activation.user_id,
      activation.caught_at::date as activation_date,
      exists (
        select 1
        from eligible_catches as later
        where later.user_id = activation.user_id
          and later.caught_at > activation.caught_at
          and later.caught_at <= activation.caught_at + interval '60 days'
          and later.fish_id <> activation.fish_id
          and (
            (
              activation.trip_id is not null
              and later.trip_id is not null
              and later.trip_id <> activation.trip_id
            )
            or (
              (activation.trip_id is null or later.trip_id is null)
              and later.caught_at >= activation.caught_at + interval '24 hours'
            )
          )
      ) as retained
    from activations as activation
  )
  select
    outcome.activation_date,
    count(*) as activated_users,
    count(*) filter (where outcome.retained) as retained_users,
    count(*) filter (where outcome.retained)::numeric
      / nullif(count(*), 0) as retention_rate,
    count(*) >= 100 as decision_ready
  from outcomes as outcome
  group by outcome.activation_date
  order by outcome.activation_date;
$$;

revoke all on function private.core_loop_retention_snapshot(timestamptz)
  from public, anon, authenticated, service_role;

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  category text not null check (
    category in (
      'identification',
      'recording',
      'collection',
      'map_marine',
      'other'
    )
  ),
  message text not null check (
    char_length(btrim(message)) between 1 and 500
  ),
  app_version text not null,
  build_number text,
  platform text not null check (
    platform in ('ios', 'android', 'web')
  ),
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_user_created_at_idx
  on public.user_feedback (user_id, created_at desc);

alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from public, anon;
grant select, insert on table public.user_feedback to authenticated;
grant select, insert, update, delete
  on table public.user_feedback to service_role;

create policy "user_feedback_select_own"
  on public.user_feedback for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_feedback_insert_own"
  on public.user_feedback for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

comment on column public.user_catches.custom_species_name is
  'Reviewed catalog 밖의 어종을 위한 사용자 입력 이름. 개인 도감과 랭킹에는 반영하지 않는다.';
comment on column public.user_catches.original_fish_id is
  '최초 어종 정정 전의 도감 어종. 이후 정정에서도 변경하지 않는다.';
comment on column public.user_catches.original_custom_species_name is
  '최초 어종 정정 전의 도감 밖 사용자 입력 이름.';
comment on column public.user_catches.species_corrected_at is
  '사용자가 어종을 마지막으로 정정한 시각. 정정 기록은 랭킹에서 제외한다.';
comment on column public.user_catches.collection_eligible is
  '도감 어종이며 인증된 기록의 개인 도감·배지·최대어 반영 여부.';
comment on column public.user_catches.ranking_eligible is
  '도감 어종이며 현장 인증되고 어종 정정 이력이 없는 기록의 랭킹 반영 여부.';
comment on table private.catch_species_changes is
  '사용자 조과 어종 정정 감사 이력. 클라이언트에서 직접 접근할 수 없다.';
comment on table private.ai_identification_requests is
  '사용자별 AI 식별 요청의 24시간 롤링 한도 집계 원본. 클라이언트에서 직접 접근할 수 없다.';
comment on table public.user_feedback is
  '사진·좌표·연락처를 받지 않는 앱 내 최소 정보 문제 신고.';
comment on function private.core_loop_retention_snapshot(timestamptz) is
  '성숙한 60일 코호트의 다른 출조·새 어종 재해금률. 활성 사용자 100명 이상일 때 decision_ready=true.';
