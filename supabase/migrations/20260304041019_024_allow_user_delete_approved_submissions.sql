/*
  # Allow users to delete their own approved submissions

  1. Changes
    - Adds a DELETE RLS policy on the submissions table
    - Users can only delete submissions they own and that are approved
*/

CREATE POLICY "submissions_delete"
  ON submissions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'approved');
