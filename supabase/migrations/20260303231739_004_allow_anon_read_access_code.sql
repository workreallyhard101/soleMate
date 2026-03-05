/*
  # Allow anonymous access code verification

  ## Summary
  The access code gate is shown before login, so unauthenticated (anon) users
  must be able to read the `access_code` setting to verify the code they enter.
  The existing SELECT policy only allows authenticated admins to read that row,
  causing the query to return null for everyone else and the validation to always fail.

  ## Changes
  - Add a new SELECT policy on `settings` that allows the `anon` role to read
    only the `access_code` row (no other settings rows are exposed).
*/

CREATE POLICY "Anon can read access_code setting"
  ON settings FOR SELECT
  TO anon
  USING (key = 'access_code');
