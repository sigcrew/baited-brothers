ALTER TABLE public.user_catches
  DROP CONSTRAINT IF EXISTS verified_catch_requires_evidence;

ALTER TABLE public.user_catches
  ADD CONSTRAINT verified_catch_requires_evidence CHECK (
    verification_status <> 'verified' OR (
      image_url IS NOT NULL
      AND id_method IS NOT NULL
      AND (
        (
          capture_method = 'live_camera'
          AND location_lat IS NOT NULL
          AND location_lng IS NOT NULL
          AND location_captured_at IS NOT NULL
        )
        OR
        (
          capture_method = 'development_upload'
          AND location_lat IS NULL
          AND location_lng IS NULL
          AND location_captured_at IS NULL
        )
      )
    )
  );

COMMENT ON CONSTRAINT verified_catch_requires_evidence
  ON public.user_catches IS
  'Camera catches require capture-time GPS; development uploads require an image and intentionally omit location.';
