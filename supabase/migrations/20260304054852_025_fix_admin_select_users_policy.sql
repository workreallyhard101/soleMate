/*
  # Fix admin SELECT policy on users table

  ## Problem
  The existing `users_select_admin` policy checks `app_metadata.is_admin` from the JWT,
  but admin status is stored in the `users` table's `is_admin` column — not in auth metadata.
  This means admins can only see their own row, not all users.

  ## Fix
  Replace the JWT-based admin check with a subquery against the users table itself.
  Use a security definer function to avoid infinite recursion.
*/

DROP POLICY IF EXISTS "users_select_admin" ON users;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM users WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE POLICY "users_select_admin"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin_user() = true);
