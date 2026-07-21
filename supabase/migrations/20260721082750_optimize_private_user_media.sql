-- 사용자 사진을 비공개 경로 기반으로 전환하고 목록용 썸네일 경로를 분리한다.

alter table public.user_catches
  add column if not exists image_path text,
  add column if not exists thumbnail_path text;

alter table public.fishing_trips
  add column if not exists cover_thumbnail_path text;

alter table public.user_catches
  drop constraint if exists verified_catch_requires_evidence;

alter table public.user_catches
  add constraint verified_catch_requires_evidence check (
    verification_status <> 'verified'::public.catch_verification_status
    or (
      (image_path is not null or image_url is not null)
      and id_method is not null
      and (
        (
          capture_method = 'live_camera'::public.capture_method
          and location_lat is not null
          and location_lng is not null
          and location_captured_at is not null
        )
        or (
          capture_method = 'development_upload'::public.capture_method
          and location_lat is null
          and location_lng is null
          and location_captured_at is null
        )
      )
    )
  );

update public.user_catches
set image_path = nullif(
  split_part(image_url, '/storage/v1/object/public/user-uploads/', 2),
  ''
)
where image_path is null
  and image_url like '%/storage/v1/object/public/user-uploads/%';

update public.fishing_trips
set cover_image_path = nullif(
  split_part(cover_image_url, '/storage/v1/object/public/user-uploads/', 2),
  ''
)
where cover_image_path is null
  and cover_image_url like '%/storage/v1/object/public/user-uploads/%';

-- 비공개 전환 후 만료된 공개 URL을 DB에 남기지 않는다.
update public.user_catches
set image_url = null
where image_path is not null;

update public.fishing_trips
set cover_image_url = null
where cover_image_path is not null;

update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{avatar_url}',
  'null'::jsonb,
  true
)
where nullif(raw_user_meta_data->>'avatar_path', '') is not null;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'user-uploads';

drop policy if exists "user_uploads_read" on storage.objects;
drop policy if exists "user_uploads_insert" on storage.objects;
drop policy if exists "user_uploads_update" on storage.objects;
drop policy if exists "user_uploads_delete" on storage.objects;

create policy "user_uploads_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user_uploads_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on column public.user_catches.image_path is
  '비공개 user-uploads 버킷의 상세 사진 객체 경로';
comment on column public.user_catches.thumbnail_path is
  '비공개 user-uploads 버킷의 목록용 480px 썸네일 객체 경로';
comment on column public.fishing_trips.cover_thumbnail_path is
  '비공개 user-uploads 버킷의 출조 커버 썸네일 객체 경로';
