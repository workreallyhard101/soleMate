/*
  # Fix infinite recursion in users table RLS policies

  ## Problem
  The users table has duplicate and conflicting SELECT policies that cause infinite
  recursion. Policies that check admin status by querying the users table itself
  (SELECT 1 FROM users WHERE ...) create a recursive loop when RLS tries to evaluate them.

  Additionally, the is_admin() function queries public.profiles which no longer exists
  (renamed to users in migration 008), causing further failures.

  ## Changes

  ### 1. Drop all existing users table policies (all conflicting/duplicate ones)
  ### 2. Fix is_admin() to use auth.jwt() app_metadata — no table query, no recursion
  ### 3. Recreate clean, non-recursive RLS policies

  ## Security
  - Users can always read/update their own record
  - Admins are identified via JWT app_metadata (set by the handle_new_user trigger or admin action)
  - No self-referencing table queries in any policy
*/

-- Step 1: Drop all existing policies on users table
DROP POLICY IF EXISTS "Admins can read all records" ON public.users;
DROP POLICY IF EXISTS "Admins can update all records" ON public.users;
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "profiles_insert" ON public.users;
DROP POLICY IF EXISTS "profiles_select" ON public.users;
DROP POLICY IF EXISTS "profiles_update" ON public.users;

-- Step 2: Fix is_admin() to use JWT metadata (no table query = no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

-- Step 3: Recreate clean non-recursive policies

-- Anyone authenticated can insert their own row (for signup trigger)
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can read their own record; admins can read all (via JWT, no recursion)
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- Users can update their own record; admins can update all
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- Service role can do anything (for triggers/functions running as service role)
CREATE POLICY "users_service_role_all"
  ON public.users FOR SELECT
  TO service_role
  USING (true);
