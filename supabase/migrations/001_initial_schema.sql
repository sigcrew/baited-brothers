-- ============================================
-- 낚시정보앱 MVP - 초기 스키마
-- 개발 계획 문서 기준 (Phase 0)
-- ============================================

-- 물고기 카테고리 (Enum 대신 테이블로 확장 가능)
CREATE TYPE fish_category AS ENUM (
  'flatfish',    -- 광어류
  'rockfish',    -- 우럭류
  'seabass',     -- 농어류
  'mackerel',    -- 고등어류
  'other'        -- 기타
);

-- fishes: 물고기 도감 마스터 데이터
CREATE TABLE fishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ko TEXT,
  description TEXT,
  category fish_category NOT NULL DEFAULT 'other',
  image_url TEXT,
  min_size_cm NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_profiles: Supabase Auth 연동 (auth.users 확장)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_catches: 사용자별 잡은 물고기 기록
CREATE TABLE user_catches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fish_id UUID NOT NULL REFERENCES fishes(id) ON DELETE RESTRICT,
  size_cm NUMERIC(5,2),
  caught_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location_name TEXT,
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  memo TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fish_id, size_cm, caught_at)
);

-- 인덱스
CREATE INDEX idx_fishes_category ON fishes(category);
CREATE INDEX idx_fishes_name ON fishes(name);
CREATE INDEX idx_user_catches_user_id ON user_catches(user_id);
CREATE INDEX idx_user_catches_fish_id ON user_catches(fish_id);
CREATE INDEX idx_user_catches_caught_at ON user_catches(caught_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fishes_updated_at
  BEFORE UPDATE ON fishes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_catches_updated_at
  BEFORE UPDATE ON user_catches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auth 가입 시 user_profiles 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
