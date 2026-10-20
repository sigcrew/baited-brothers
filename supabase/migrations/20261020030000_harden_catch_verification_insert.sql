-- 조과 인증 위조 차단 + 공개 카탈로그 버킷 쓰기 차단.
--
-- 1) protect_catch_verification_fields: 기존 INSERT 분기는 captured_at이 없고
--    photo_library가 아닌 행(= development_upload, 레거시 live_camera)에 한해
--    클라이언트가 보낸 verification_status를 그대로 통과시켰다. 그 결과 본인 JWT만
--    있으면 verification_status='verified'를 직접 INSERT해 도감·배지·현장 인증
--    스탬프를 위조할 수 있었다. "한 릴리스 동안의 레거시 유예"는 끝났으므로
--    service_role이 아닌 모든 INSERT는 무조건 서버 판정 대기(pending)로 시작한다.
-- 2) fish_images_admin_write: 003_storage.sql에서 만든 정책이 한 번도 삭제되지
--    않아 인증 사용자 누구나 공개 버킷 fish-images에 업로드할 수 있었다.
--    카탈로그 이미지는 service_role(스크립트)만 쓴다.

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

      -- 모든 클라이언트 INSERT는 서버 판정(verify-catch) 전까지 pending이다.
      -- capture_method나 captured_at 유무와 무관하게 예외를 두지 않는다.
      new.verification_status := 'pending';
      new.verification_reason := null;
      new.image_hash := null;
      new.verification_version := null;
      new.verified_at := null;

      if new.fish_id is null then
        new.id_method := null;
        new.verification_status := 'general_record';
        new.verification_reason := 'species_outside_catalog';
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

-- 레거시 'verified' 값은 서버(service_role)만 남길 수 있다. 클라이언트 INSERT는
-- 위 트리거가 pending으로 덮으므로 이 제약은 service_role 경로의 실수를 막는
-- 2차 방어선이다: verified는 증거(이미지·어종 판별 방법)가 있을 때만 허용한다.
alter table public.user_catches
  drop constraint if exists legacy_verified_catch_requires_evidence;

alter table public.user_catches
  add constraint legacy_verified_catch_requires_evidence check (
    verification_status <> 'verified'::public.catch_verification_status
    or (
      (image_path is not null or image_url is not null)
      and id_method is not null
      and capture_method <> 'development_upload'::public.capture_method
    )
  ) not valid;

comment on constraint legacy_verified_catch_requires_evidence
  on public.user_catches is
  'development_upload 행은 verified가 될 수 없다. 기존 행은 검증하지 않는다(not valid).';

-- 공개 카탈로그 버킷은 service_role 스크립트만 쓴다.
drop policy if exists "fish_images_admin_write" on storage.objects;
