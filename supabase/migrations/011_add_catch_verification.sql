-- 현장 조과 인증 메타데이터
CREATE TYPE capture_method AS ENUM ('live_camera');
CREATE TYPE catch_id_method AS ENUM ('closed_set_candidates', 'fallback_catalog');
CREATE TYPE catch_verification_status AS ENUM ('verified', 'unverified');

ALTER TABLE user_catches
  ADD COLUMN capture_method capture_method,
  ADD COLUMN id_method catch_id_method,
  ADD COLUMN candidate_fish_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN location_captured_at TIMESTAMPTZ,
  ADD COLUMN verification_status catch_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN verification_reason TEXT;

ALTER TABLE user_catches ADD CONSTRAINT verified_catch_requires_evidence CHECK (
  verification_status <> 'verified' OR (
    capture_method = 'live_camera'
    AND location_lat IS NOT NULL
    AND location_lng IS NOT NULL
    AND location_captured_at IS NOT NULL
    AND image_url IS NOT NULL
    AND id_method IS NOT NULL
  )
);

CREATE INDEX idx_user_catches_verified
  ON user_catches(user_id, verification_status, caught_at DESC);
