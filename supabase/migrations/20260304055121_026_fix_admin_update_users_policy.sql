/*
  # Fix admin UPDATE policy on users table

  ## Problem
  The `users_update_admin` policy checks `app_metadata.is_admin` from the JWT,
  which is never set. Admins cannot update other users' records.

  ## Fix
  Replace the JWT-based admin check with the is_admin_user() security definer function
  (already created in migration 025) that checks the users table directly.
*/

DROP POLICY IF EXISTS "users_update_admin" ON users;

CREATE POLICY "users_update_admin"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin_user() = true)
  WITH CHECK (is_admin_user() = true);
