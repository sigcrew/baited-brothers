DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_method') THEN
    CREATE TYPE public.capture_method AS ENUM ('live_camera');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catch_id_method') THEN
    CREATE TYPE public.catch_id_method AS ENUM ('closed_set_candidates', 'fallback_catalog');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catch_verification_status') THEN
    CREATE TYPE public.catch_verification_status AS ENUM ('verified', 'unverified');
  END IF;
END
$$;

ALTER TABLE public.user_catches
  ADD COLUMN IF NOT EXISTS capture_method public.capture_method,
  ADD COLUMN IF NOT EXISTS id_method public.catch_id_method,
  ADD COLUMN IF NOT EXISTS candidate_fish_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status public.catch_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_catches'::regclass
      AND conname = 'verified_catch_requires_evidence'
  ) THEN
    ALTER TABLE public.user_catches
      ADD CONSTRAINT verified_catch_requires_evidence CHECK (
        verification_status <> 'verified' OR (
          capture_method = 'live_camera'
          AND location_lat IS NOT NULL
          AND location_lng IS NOT NULL
          AND location_captured_at IS NOT NULL
          AND image_url IS NOT NULL
          AND id_method IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_catches_verified
  ON public.user_catches (user_id, verification_status, caught_at DESC);

COMMENT ON COLUMN public.user_catches.verification_status IS
  'Only verified catches unlock encyclopedia entries and contribute to discovery metrics.';
