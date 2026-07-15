ALTER TABLE public.fishing_trips
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

COMMENT ON COLUMN public.fishing_trips.cover_image_url IS
  '다가오는 출조를 홈 히어로에 표시할 공개 커버 이미지 URL';

COMMENT ON COLUMN public.fishing_trips.cover_image_path IS
  'user-uploads 버킷에서 커버 교체·삭제에 사용하는 객체 경로';

DROP POLICY IF EXISTS "fishing_trips_select_own" ON public.fishing_trips;
CREATE POLICY "fishing_trips_select_own"
  ON public.fishing_trips FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "fishing_trips_insert_own" ON public.fishing_trips;
CREATE POLICY "fishing_trips_insert_own"
  ON public.fishing_trips FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "fishing_trips_update_own" ON public.fishing_trips;
CREATE POLICY "fishing_trips_update_own"
  ON public.fishing_trips FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "fishing_trips_delete_own" ON public.fishing_trips;
CREATE POLICY "fishing_trips_delete_own"
  ON public.fishing_trips FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
