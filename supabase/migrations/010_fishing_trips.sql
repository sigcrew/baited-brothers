-- ============================================
-- 출조 일정 (fishing_trips)
-- 홈: 계획(planned) → 완료(done) / 취소(canceled)
-- ============================================

CREATE TYPE trip_status AS ENUM (
  'planned',
  'done',
  'canceled'
);

CREATE TABLE fishing_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  memo TEXT,
  status trip_status NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fishing_trips_done_needs_completed_at CHECK (
    (status = 'done' AND completed_at IS NOT NULL)
    OR (status <> 'done')
  )
);

CREATE INDEX idx_fishing_trips_user_id ON fishing_trips(user_id);
CREATE INDEX idx_fishing_trips_user_status_scheduled
  ON fishing_trips(user_id, status, scheduled_at);

CREATE TRIGGER fishing_trips_updated_at
  BEFORE UPDATE ON fishing_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE fishing_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fishing_trips_select_own"
  ON fishing_trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "fishing_trips_insert_own"
  ON fishing_trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fishing_trips_update_own"
  ON fishing_trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fishing_trips_delete_own"
  ON fishing_trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
