/*
  # Add admin delete policy for help_requests

  ## Changes
  - Adds a DELETE RLS policy on help_requests allowing active admins to delete any help request
*/

CREATE POLICY "Admins can delete help requests"
  ON help_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
        AND users.is_active = true
    )
  );
