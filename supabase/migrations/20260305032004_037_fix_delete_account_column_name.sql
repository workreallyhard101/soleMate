/*
  # Fix delete_account RPC — use correct column name

  ## Summary
  The delete_account function was referencing a non-existent column `deleted_at`.
  The actual column on the users table is `account_deletion_date`.
  This recreates the function using the correct column name so soft-deletes actually work.

  ## Changes
  1. Recreates `delete_account()` using `account_deletion_date` instead of `deleted_at`

  ## Notes
  - Without this fix, calling delete_account() would raise a column-not-found error,
    leaving is_deleted = false and the user still appearing on the leaderboard.
*/

CREATE OR REPLACE FUNCTION delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid;
BEGIN
  calling_user_id := auth.uid();

  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.users
  SET
    is_deleted = true,
    account_deletion_date = now()
  WHERE id = calling_user_id;
END;
$$;
