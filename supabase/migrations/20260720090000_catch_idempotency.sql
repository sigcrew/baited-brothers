ALTER TABLE public.user_catches
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS user_catches_user_request_unique
  ON public.user_catches (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.user_catches.client_request_id IS
  'Client-generated idempotency key that prevents duplicate saves after retries.';
