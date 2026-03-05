/*
  # Merge multiple permissive policies on users table

  ## Summary
  The users table had two SELECT policies (users_select_own + users_select_admin)
  and two UPDATE policies (users_update_own + users_update_admin) for the authenticated
  role, which causes the "multiple permissive policies" warning and can degrade performance.

  Each pair is merged into a single policy that covers both the own-record and admin cases.

  ## Changes
  - DROP users_select_own + users_select_admin → CREATE unified users_select
  - DROP users_update_own + users_update_admin → CREATE unified users_update
*/

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;

CREATE POLICY "users_select"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR (public.is_admin_user() = true)
  );

CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR (public.is_admin_user() = true)
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR (public.is_admin_user() = true)
  );
