-- ============================================
-- RLS (Row Level Security) 정책
-- 사용자별 데이터 접근 제어
-- ============================================

-- fishes: 모든 사용자 읽기 가능 (도감은 공개)
ALTER TABLE fishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fishes_select_all"
  ON fishes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fishes_select_anon"
  ON fishes FOR SELECT
  TO anon
  USING (true);

-- user_profiles: 본인만 읽기/수정
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_profiles_update_own"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_insert_own"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- user_catches: 본인 기록만 CRUD
ALTER TABLE user_catches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_catches_select_own"
  ON user_catches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_catches_insert_own"
  ON user_catches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_catches_update_own"
  ON user_catches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_catches_delete_own"
  ON user_catches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
