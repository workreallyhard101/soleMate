/*
  # Add is_read flag to help_requests

  1. Changes
    - Add `is_read` boolean column to `help_requests`, default false
    - Admins can update this column (mark as read)
    - RLS: authenticated users (admins) can update help_requests to set is_read

  2. Notes
    - Existing rows get is_read = false (unread) by default
    - Only admins should update this; enforced at app level (RLS allows any authenticated user to update, but the admin check happens in the app layer since help_requests is already restricted to admins for SELECT)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'help_requests' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE help_requests ADD COLUMN is_read boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can update help requests" ON help_requests;

CREATE POLICY "Admins can update help requests"
  ON help_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
        AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
        AND users.is_active = true
    )
  );
