ALTER TYPE public.capture_method
  ADD VALUE IF NOT EXISTS 'development_upload';

COMMENT ON TYPE public.capture_method IS
  'How catch evidence was captured. development_upload is only exposed by development builds.';
