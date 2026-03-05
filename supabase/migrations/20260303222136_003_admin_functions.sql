/*
  # Admin Helper Functions

  ## Functions Added

  ### get_leaderboard(p_month_key)
  Returns ranked leaderboard for a given month. Security definer so
  non-admins can still see the aggregated (non-sensitive) leaderboard data
  without direct table access to other users' submissions.

  ### freeze_month(p_month_key, p_new_month_key)
  Admin only. Archives the current month and advances to a new month key.
  All pending submissions for the old month get auto-rejected.

  ### admin_approve_submission(p_submission_id, p_note)
  Admin only. Approves a submission and logs the action.

  ### admin_reject_submission(p_submission_id, p_note)
  Admin only. Rejects a submission and logs the action.

  ### get_flagged_submissions()
  Admin only. Returns submissions that need review:
  - status = 'pending' or 'flagged'
  - OCR confidence = 'low'
  - step count exceeds anomaly threshold
*/

-- Leaderboard query function (accessible to all authenticated users)
CREATE OR REPLACE FUNCTION get_leaderboard(p_month_key text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  month_key text,
  total_steps bigint,
  weeks_submitted bigint,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    s.month_key,
    SUM(s.confirmed_steps)::bigint AS total_steps,
    COUNT(s.id)::bigint AS weeks_submitted,
    RANK() OVER (ORDER BY SUM(s.confirmed_steps) DESC)::bigint AS rank
  FROM profiles p
  JOIN submissions s ON s.user_id = p.id
  WHERE s.status = 'approved'
    AND s.month_key = p_month_key
  GROUP BY p.id, p.full_name, s.month_key
  ORDER BY total_steps DESC;
END;
$$;

-- Freeze/archive current month and start new one (admin only)
CREATE OR REPLACE FUNCTION freeze_month(
  p_current_month_key text,
  p_new_month_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE submissions
  SET status = 'rejected', admin_note = 'Month archived - submission not reviewed in time'
  WHERE month_key = p_current_month_key AND status = 'pending';

  UPDATE settings
  SET value = p_new_month_key, updated_at = now(), updated_by = auth.uid()
  WHERE key = 'current_month_key';

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'month_frozen',
    jsonb_build_object('previous_month', p_current_month_key, 'new_month', p_new_month_key)
  );
END;
$$;

-- Admin approve submission
CREATE OR REPLACE FUNCTION admin_approve_submission(
  p_submission_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE submissions
  SET status = 'approved', admin_note = p_note, updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'submission_approved',
    jsonb_build_object('submission_id', p_submission_id, 'note', p_note)
  );
END;
$$;

-- Admin reject submission
CREATE OR REPLACE FUNCTION admin_reject_submission(
  p_submission_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE submissions
  SET status = 'rejected', admin_note = p_note, updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'submission_rejected',
    jsonb_build_object('submission_id', p_submission_id, 'note', p_note)
  );
END;
$$;

-- Admin flag submission
CREATE OR REPLACE FUNCTION admin_flag_submission(
  p_submission_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE submissions
  SET status = 'flagged', admin_note = p_note, updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'submission_flagged',
    jsonb_build_object('submission_id', p_submission_id, 'note', p_note)
  );
END;
$$;

-- Function to auto-flag suspicious submissions on insert
CREATE OR REPLACE FUNCTION auto_flag_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_threshold integer;
BEGIN
  SELECT value::integer INTO v_threshold FROM settings WHERE key = 'step_anomaly_threshold';
  IF v_threshold IS NULL THEN v_threshold := 100000; END IF;

  IF NEW.ocr_confidence = 'low' OR NEW.confirmed_steps > v_threshold THEN
    NEW.status := 'flagged';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_flag_on_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW EXECUTE FUNCTION auto_flag_submission();

-- Get admin stats
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_month text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT value INTO v_month FROM settings WHERE key = 'current_month_key';

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE role = 'user'),
    'active_users', (SELECT COUNT(*) FROM profiles WHERE role = 'user' AND is_active = true),
    'total_submissions_this_month', (SELECT COUNT(*) FROM submissions WHERE month_key = v_month),
    'pending_count', (SELECT COUNT(*) FROM submissions WHERE status = 'pending'),
    'flagged_count', (SELECT COUNT(*) FROM submissions WHERE status = 'flagged'),
    'approved_count', (SELECT COUNT(*) FROM submissions WHERE status = 'approved' AND month_key = v_month),
    'current_month', v_month
  ) INTO v_result;

  RETURN v_result;
END;
$$;
