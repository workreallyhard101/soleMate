/*
  # Storage Bucket and Performance Indexes

  ## Changes
  1. Creates a private storage bucket 'proof-files' for submission uploads
  2. Adds performance indexes on frequently queried columns
  3. Adds RLS policies for the storage bucket

  ## Storage
  - Bucket 'proof-files' is private (not publicly accessible)
  - Users can upload to their own folder: proof-files/{user_id}/
  - Users can read their own files
  - Admins can read all files

  ## Indexes
  - submissions: user_id, week_ending_date, month_key, status
  - audit_logs: user_id, created_at, action
  - rate_limits: identifier + action_type (already unique, covered)
*/

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_month_key ON submissions(month_key);
CREATE INDEX IF NOT EXISTS idx_submissions_week_ending ON submissions(week_ending_date);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user_month ON submissions(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Storage bucket for proof files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-files',
  'proof-files',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY "Users can upload own proof files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proof-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can read their own files
CREATE POLICY "Users can read own proof files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proof-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: admins can read all proof files
CREATE POLICY "Admins can read all proof files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proof-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage RLS: users can delete their own pending files
CREATE POLICY "Users can delete own proof files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proof-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
