/*
  # Admin RPC Functions

  1. New Functions
    - `get_admin_stats` - Returns aggregate stats for the admin dashboard
    - `admin_approve_submission` - Approves a submission by ID with optional note
    - `admin_reject_submission` - Rejects a submission by ID with optional note
    - `admin_flag_submission` - Flags a submission by ID with optional note
    - `freeze_month` - Freezes current month, auto-rejects pending, advances month

  2. Security
    - All functions check is_admin() before executing
    - Uses SECURITY DEFINER to allow controlled elevated access
*/

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month text;
  v_result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT value INTO v_current_month FROM settings WHERE key = 'current_month_key' LIMIT 1;
  IF v_current_month IS NULL THEN
    v_current_month := to_char(now(), 'YYYY-MM');
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM users WHERE is_deleted = false),
    'active_users', (SELECT count(*) FROM users WHERE is_active = true AND is_deleted = false),
    'total_submissions_this_month', (SELECT count(*) FROM submissions WHERE month_key = v_current_month),
    'pending_count', (SELECT count(*) FROM submissions WHERE status = 'pending'),
    'flagged_count', (SELECT count(*) FROM submissions WHERE status = 'flagged'),
    'approved_count', (SELECT count(*) FROM submissions WHERE status = 'approved' AND month_key = v_current_month),
    'current_month', v_current_month
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_approve_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE submissions
  SET status = 'approved',
      admin_note = p_note,
      updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_approved', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE submissions
  SET status = 'rejected',
      admin_note = p_note,
      updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_rejected', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION admin_flag_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE submissions
  SET status = 'flagged',
      admin_note = p_note,
      updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_flagged', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION freeze_month(p_current_month_key text, p_new_month_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE submissions
  SET status = 'rejected',
      admin_note = 'Auto-rejected: month frozen',
      updated_at = now()
  WHERE status = 'pending' AND month_key = p_current_month_key;

  UPDATE settings
  SET value = p_new_month_key, updated_at = now()
  WHERE key = 'current_month_key';

  INSERT INTO audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'month_frozen', json_build_object('previous_month', p_current_month_key, 'new_month', p_new_month_key));
END;
$$;
