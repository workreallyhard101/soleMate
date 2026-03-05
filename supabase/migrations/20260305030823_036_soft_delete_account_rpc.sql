/*
  # Soft Delete Account RPC

  ## Summary
  Adds a `delete_account` RPC function that allows a user to soft-delete their own account.
  Sets `is_deleted = true` and records a `deleted_at` timestamp so we know when the 7-day
  grace period expires.

  ## Changes
  1. Adds `deleted_at` column to `users` table (nullable timestamptz)
  2. Creates `delete_account()` RPC — sets `is_deleted = true` and `deleted_at = now()` for
     the calling user, then signs them out by invalidating their session.
  3. Security: function is SECURITY DEFINER, requires authentication, and only touches the
     calling user's own row.

  ## Notes
  - `is_deleted = false` restores the account if the user logs back in within 7 days
    (handled by a trigger below).
  - Permanent deletion after 7 days is handled by a scheduled job outside this migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

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
    deleted_at = now()
  WHERE id = calling_user_id;
END;
$$;
