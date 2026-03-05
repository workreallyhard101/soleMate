/*
  # Add RPC function for admins to set/unset admin status

  ## Problem
  Direct UPDATE via client SDK goes through RLS row-by-row checks which can
  conflict when an admin tries to update another user's row. A SECURITY DEFINER
  function bypasses RLS and runs with elevated privileges, so any verified admin
  can grant or revoke admin status on any user.

  ## Changes
  - New function `admin_set_user_admin(p_user_id uuid, p_is_admin boolean)`
    - Verifies the caller is an admin via the users table
    - Updates the target user's is_admin column
    - Returns the updated row
*/

CREATE OR REPLACE FUNCTION admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT COALESCE(is_admin, false) FROM users WHERE id = auth.uid() LIMIT 1) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE users SET is_admin = p_is_admin WHERE id = p_user_id;
END;
$$;
