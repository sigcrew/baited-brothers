REVOKE ALL ON TABLE public.fishing_trips FROM anon;
REVOKE ALL ON TABLE public.user_catches FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "user_catches_select_own" ON public.user_catches;
CREATE POLICY "user_catches_select_own"
  ON public.user_catches FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_catches_delete_own" ON public.user_catches;
CREATE POLICY "user_catches_delete_own"
  ON public.user_catches FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
