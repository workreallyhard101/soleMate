/*
  # Restore Account on Login Within Grace Period

  ## Summary
  Adds an RPC function that restores a soft-deleted account if the user logs back in within 7 days.

  ## New Functions
  - `restore_account()` — SECURITY DEFINER RPC callable by any authenticated user
    - Checks if the calling user's account is marked as deleted
    - Checks if `account_deletion_date` is within 7 days from now
    - If so, clears `is_deleted`, clears `account_deletion_date`, and sets `is_active = true`
    - Returns a boolean: true = restored, false = not eligible (already active, or past grace period)

  ## Security
  - SECURITY DEFINER so it can update the users row bypassing RLS
  - Only operates on the calling user's own row
  - Grace period check is server-side (cannot be spoofed by client)
*/

CREATE OR REPLACE FUNCTION restore_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid;
  deletion_date timestamptz;
  was_deleted boolean;
BEGIN
  calling_user_id := auth.uid();

  IF calling_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT is_deleted, account_deletion_date
  INTO was_deleted, deletion_date
  FROM users
  WHERE id = calling_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF was_deleted IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF deletion_date IS NULL OR now() > deletion_date + INTERVAL '7 days' THEN
    RETURN false;
  END IF;

  UPDATE users
  SET
    is_deleted = false,
    is_active = true,
    account_deletion_date = NULL
  WHERE id = calling_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_account() TO authenticated;
