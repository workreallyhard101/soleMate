/*
  # Fix submissions delete policy

  ## Changes
  - Drops the existing restrictive delete policy that only allowed deleting 'approved' submissions
  - Adds a new policy allowing users to delete any of their own submissions regardless of status
*/

DROP POLICY IF EXISTS "submissions_delete" ON submissions;

CREATE POLICY "submissions_delete"
  ON submissions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
