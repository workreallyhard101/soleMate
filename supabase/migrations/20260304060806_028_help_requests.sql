/*
  # Create help_requests table

  1. New Tables
    - `help_requests`
      - `id` (uuid, primary key)
      - `name` (text) - submitter's name
      - `email` (text) - submitter's email
      - `request` (text) - the help request message
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `help_requests`
    - Anyone (including unauthenticated) can INSERT
    - Only admins can SELECT (via is_admin check on users table)
*/

CREATE TABLE IF NOT EXISTS help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  request text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a help request"
  ON help_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view help requests"
  ON help_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
      AND users.is_deleted = false
    )
  );
