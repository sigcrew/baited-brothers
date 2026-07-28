-- 조과 인증 v2: 서버가 현장 촬영과 사진 보관함 메타데이터를 구분해 판정한다.
-- 원격 적용 버전: 20260728025227
-- 기존 verified/unverified 값은 구버전 앱과 레거시 데이터 식별을 위해 유지한다.

alter table public.user_catches
  drop constraint if exists verified_catch_requires_evidence;

alter type public.capture_method rename to capture_method_legacy;

create type public.capture_method as enum (
  'live_camera',
  'photo_library',
  'development_upload'
);

alter table public.user_catches
  alter column capture_method type public.capture_method
  using capture_method::text::public.capture_method;

drop type public.capture_method_legacy;

alter table public.user_catches
  alter column verification_status drop default;

alter type public.catch_verification_status rename to catch_verification_status_legacy;

create type public.catch_verification_status as enum (
  'verified',
  'unverified',
  'pending',
  'field_verified',
  'metadata_verified',
  'general_record'
);

alter table public.user_catches
  alter column verification_status type public.catch_verification_status
  using verification_status::text::public.catch_verification_status,
  alter column verification_status set default 'pending';

drop type public.catch_verification_status_legacy;

alter table public.user_catches
  add column if not exists captured_at timestamptz,
  add column if not exists location_accuracy_m numeric(8, 2),
  add column if not exists image_hash text,
  add column if not exists verification_version integer,
  add column if not exists verified_at timestamptz,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists collection_eligible boolean generated always as (
    verification_status in ('verified', 'field_verified', 'metadata_verified')
  ) stored,
  add column if not exists ranking_eligible boolean generated always as (
    verification_status in ('verified', 'field_verified')
  ) stored;

alter table public.user_catches
  add constraint user_catches_location_accuracy_valid
    check (location_accuracy_m is null or location_accuracy_m >= 0),
  add constraint user_catches_image_hash_valid
    check (image_hash is null or image_hash ~ '^[0-9a-f]{64}$'),
  add constraint verified_catch_requires_evidence check (
    verification_status not in ('field_verified', 'metadata_verified')
    or (
      (image_path is not null or image_url is not null)
      and id_method is not null
      and captured_at is not null
      and location_lat is not null
      and location_lng is not null
      and image_hash is not null
      and verification_version is not null
      and verified_at is not null
      and (
        (
          verification_status = 'field_verified'
          and capture_method = 'live_camera'
          and location_accuracy_m is not null
          and location_captured_at is not null
        )
        or (
          verification_status = 'metadata_verified'
          and capture_method = 'photo_library'
        )
      )
    )
  );

create unique index if not exists user_catches_verified_image_hash_uidx
  on public.user_catches (image_hash)
  where verification_status in ('field_verified', 'metadata_verified');

create or replace function public.protect_catch_verification_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      -- captured_at이 없는 기존 배포 앱의 live_camera 저장은 한 릴리스 동안
      -- 레거시 동작을 유지한다. v2 앱과 사진 보관함 경로는 서버 판정을 강제한다.
      if new.captured_at is not null or new.capture_method = 'photo_library' then
        new.verification_status := 'pending';
        new.verification_reason := null;
        new.image_hash := null;
        new.verification_version := null;
        new.verified_at := null;
      end if;
    else
      new.user_id := old.user_id;
      new.fish_id := old.fish_id;
      new.capture_method := old.capture_method;
      new.captured_at := old.captured_at;
      new.location_lat := old.location_lat;
      new.location_lng := old.location_lng;
      new.location_accuracy_m := old.location_accuracy_m;
      new.location_captured_at := old.location_captured_at;
      new.image_path := old.image_path;
      new.image_url := old.image_url;
      new.thumbnail_path := old.thumbnail_path;
      new.id_method := old.id_method;
      new.candidate_fish_ids := old.candidate_fish_ids;
      new.client_request_id := old.client_request_id;
      new.verification_status := old.verification_status;
      new.verification_reason := old.verification_reason;
      new.image_hash := old.image_hash;
      new.verification_version := old.verification_version;
      new.verified_at := old.verified_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_catch_verification_fields
  on public.user_catches;

create trigger protect_catch_verification_fields
before insert or update on public.user_catches
for each row execute function public.protect_catch_verification_fields();

revoke all on function public.protect_catch_verification_fields() from public;

comment on column public.user_catches.captured_at is
  '사진 셔터 또는 사진 보관함 원본 메타데이터의 촬영 시각';
comment on column public.user_catches.location_accuracy_m is
  '인앱 카메라 촬영 시 확보한 수평 위치 정확도(미터)';
comment on column public.user_catches.image_hash is
  '서버가 원본 업로드에서 계산한 SHA-256';
comment on column public.user_catches.verification_version is
  '서버 조과 인증 규칙 버전';
comment on column public.user_catches.verified_at is
  '서버가 인증 판정을 완료한 시각';
comment on column public.user_catches.uploaded_at is
  '촬영 장소와 무관한 서버 업로드 시각';
comment on column public.user_catches.collection_eligible is
  '도감·배지·개인 최대어 반영 여부. 사진 보관함 메타데이터 인증을 포함한다.';
comment on column public.user_catches.ranking_eligible is
  '랭킹 반영 여부. 사진 보관함 메타데이터 인증은 제외한다.';
