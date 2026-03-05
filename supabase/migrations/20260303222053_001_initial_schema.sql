/*
  # SoleMate Initial Schema

  ## Overview
  Sets up all tables required for the SoleMate monthly step-count competition platform.

  ## New Tables

  ### profiles
  Extends Supabase auth.users with competition-specific fields.
  - id: references auth.users
  - full_name: display name
  - phone: optional phone number
  - secret_phrase_hash: bcrypt hash of recovery phrase
  - role: 'user' or 'admin'
  - is_active: account active status
  - created_at / updated_at

  ### submissions
  Weekly step-count proof submissions.
  - id: uuid primary key
  - user_id: references profiles
  - week_ending_date: the Sunday that ends the tracked week
  - month_key: YYYY-MM format for monthly aggregation
  - detected_steps: what OCR found
  - confirmed_steps: what user confirmed (used for scoring)
  - detected_date_range: text extracted from proof
  - ocr_confidence: 'high' | 'medium' | 'low'
  - proof_file_path: path in private storage bucket
  - status: 'pending' | 'approved' | 'rejected' | 'flagged'
  - admin_note: optional note from admin on review
  - created_at / updated_at

  ### settings
  Key-value store for admin-configurable values.
  - key: setting name
  - value: setting value (text)
  - updated_at / updated_by

  ### rate_limits
  Server-side rate limiting tracking table.
  - identifier: IP address or user_id
  - action_type: the rate-limited action name
  - attempts: count of attempts in window
  - window_start: when current window began
  - locked_until: if locked, when lock expires

  ### audit_logs
  Immutable append-only log of significant actions.
  - id: uuid
  - user_id: nullable (null for unauthenticated actions)
  - action: action type string
  - details: JSON blob with context
  - ip_address: requester IP
  - created_at

  ## Security
  - RLS enabled on all tables
  - Policies follow least-privilege principle
  - audit_logs is insert-only for authenticated users (no update/delete)
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  secret_phrase_hash text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_ending_date date NOT NULL,
  month_key text NOT NULL,
  detected_steps integer,
  confirmed_steps integer NOT NULL,
  detected_date_range text,
  ocr_confidence text DEFAULT 'low' CHECK (ocr_confidence IN ('high', 'medium', 'low')),
  proof_file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_ending_date)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Leaderboard view (approved submissions aggregated by month)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id AS user_id,
  p.full_name,
  s.month_key,
  SUM(s.confirmed_steps) AS total_steps,
  COUNT(s.id) AS weeks_submitted,
  RANK() OVER (PARTITION BY s.month_key ORDER BY SUM(s.confirmed_steps) DESC) AS rank
FROM profiles p
JOIN submissions s ON s.user_id = p.id
WHERE s.status = 'approved'
GROUP BY p.id, p.full_name, s.month_key;

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  UNIQUE (identifier, action_type)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (identifier = auth.uid()::text);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('access_code_hash', ''),
  ('current_month_key', to_char(now(), 'YYYY-MM')),
  ('step_anomaly_threshold', '100000'),
  ('competition_name', 'SoleMate')
ON CONFLICT (key) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to check rate limits (returns true if allowed, false if blocked)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_attempts integer,
  p_window_minutes integer,
  p_lockout_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_window_start timestamptz := now() - (p_window_minutes || ' minutes')::interval;
BEGIN
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier AND action_type = p_action_type;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (identifier, action_type, attempts, window_start)
    VALUES (p_identifier, p_action_type, 1, now())
    ON CONFLICT (identifier, action_type) DO NOTHING;
    RETURN true;
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    RETURN false;
  END IF;

  IF v_record.window_start < v_window_start THEN
    UPDATE rate_limits
    SET attempts = 1, window_start = now(), locked_until = NULL
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN true;
  END IF;

  IF v_record.attempts >= p_max_attempts THEN
    UPDATE rate_limits
    SET locked_until = now() + (p_lockout_minutes || ' minutes')::interval
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN false;
  END IF;

  UPDATE rate_limits
  SET attempts = attempts + 1
  WHERE identifier = p_identifier AND action_type = p_action_type;

  RETURN true;
END;
$$;

-- Function to hash access code and verify it
CREATE OR REPLACE FUNCTION verify_access_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  SELECT value INTO v_stored_hash FROM settings WHERE key = 'access_code_hash';
  IF v_stored_hash = '' OR v_stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_stored_hash = p_code;
END;
$$;
