/*
  # Fix delete_account: auto-revoke admin on soft delete

  ## Summary
  When a user deletes their account, their admin privileges should be automatically revoked.
  Previously the delete_account function only set is_deleted = true, leaving is_admin = true.

  ## Changes
  1. Recreates delete_account() to also set is_admin = false on deletion

  ## Security
  - SECURITY DEFINER, requires authentication
  - Only touches the calling user's own row
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
    is_admin = false,
    account_deletion_date = now()
  WHERE id = calling_user_id;
END;
$$;
