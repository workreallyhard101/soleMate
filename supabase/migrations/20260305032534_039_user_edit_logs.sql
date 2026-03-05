/*
  # Create user_edit_logs table

  ## Summary
  Tracks all changes admins make to user accounts. Every field edit is recorded
  so there is a full audit trail of who changed what and when.

  ## New Tables
  - `user_edit_logs`
    - `id` (uuid, primary key)
    - `admin_user_id` (uuid) — the admin who made the change
    - `target_user_id` (uuid) — the user whose record was changed
    - `field_changed` (text) — the name of the field that was edited (e.g. full_name, is_active)
    - `old_value` (text) — the previous value
    - `new_value` (text) — the new value after the change
    - `created_at` (timestamptz) — when the change was made

  ## Security
  - RLS enabled
  - Admins can insert and read all records
  - Regular users cannot access this table
*/

CREATE TABLE IF NOT EXISTS user_edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert edit logs"
  ON user_edit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user() = true);

CREATE POLICY "Admins can read all edit logs"
  ON user_edit_logs
  FOR SELECT
  TO authenticated
  USING (is_admin_user() = true);

CREATE INDEX IF NOT EXISTS idx_user_edit_logs_admin ON user_edit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_user_edit_logs_target ON user_edit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_edit_logs_created ON user_edit_logs(created_at DESC);
