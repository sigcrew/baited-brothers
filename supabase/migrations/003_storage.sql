-- ============================================
-- Storage 버킷 설정
-- 물고기 이미지, 프로필 사진
-- ============================================

-- 물고기 도감 이미지 (공개 읽기)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fish-images',
  'fish-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 프로필/캐치 이미지 (인증된 사용자만 업로드, 본인만)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- fish-images: 모든 사용자 읽기
CREATE POLICY "fish_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fish-images');

CREATE POLICY "fish_images_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fish-images');

-- user-uploads: 본인 폴더만 접근
CREATE POLICY "user_uploads_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_uploads_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_uploads_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_uploads_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
