ALTER TABLE public.user_catches
  ADD COLUMN trip_id uuid NULL
  REFERENCES public.fishing_trips(id) ON DELETE SET NULL;

CREATE INDEX idx_user_catches_trip_caught_at
  ON public.user_catches(trip_id, caught_at DESC)
  WHERE trip_id IS NOT NULL;

COMMENT ON COLUMN public.user_catches.trip_id IS
  'Optional fishing trip that this catch belongs to.';

DROP POLICY IF EXISTS "user_catches_insert_own" ON public.user_catches;
CREATE POLICY "user_catches_insert_own"
  ON public.user_catches FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      trip_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.fishing_trips
        WHERE fishing_trips.id = trip_id
          AND fishing_trips.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "user_catches_update_own" ON public.user_catches;
CREATE POLICY "user_catches_update_own"
  ON public.user_catches FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      trip_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.fishing_trips
        WHERE fishing_trips.id = trip_id
          AND fishing_trips.user_id = (SELECT auth.uid())
      )
    )
  );
