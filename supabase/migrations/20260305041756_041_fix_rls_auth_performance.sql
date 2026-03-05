/*
  # Fix RLS auth() performance and mutable search paths

  ## Summary
  1. Wraps all auth.uid() calls in RLS policies with (select auth.uid()) to prevent
     per-row re-evaluation, improving query performance at scale.
  2. Recreates all affected policies with corrected expressions.
  3. Fixes mutable search_path on all public functions by adding SET search_path = ''.

  ## Affected Tables
  - public.submissions (select, insert, update, delete)
  - public.audit_logs (insert)
  - public.user_preferences (select, insert, update)
  - public.users (insert, select, update)
  - public.help_requests (select, update, delete admin policies)

  ## Affected Functions
  - update_updated_at, is_admin, admin_approve_submission, admin_reject_submission,
    admin_flag_submission, get_admin_stats, is_admin_user, admin_set_user_admin,
    check_help_request_rate_limit, get_monthly_leaderboard
*/

-- ============================================================
-- submissions policies
-- ============================================================
DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;
DROP POLICY IF EXISTS "submissions_delete" ON public.submissions;

CREATE POLICY "submissions_select"
  ON public.submissions FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())) OR public.is_admin());

CREATE POLICY "submissions_insert"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "submissions_update"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (
    ((user_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['pending'::text, 'flagged'::text])))
    OR public.is_admin()
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid())) OR public.is_admin()
  );

CREATE POLICY "submissions_delete"
  ON public.submissions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- audit_logs policies
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())) OR (user_id IS NULL));

-- ============================================================
-- user_preferences policies
-- ============================================================
DROP POLICY IF EXISTS "Users can read own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- users policies
-- ============================================================
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================
-- help_requests admin policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can view help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Admins can update help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Admins can delete help requests" ON public.help_requests;

CREATE POLICY "Admins can view help requests"
  ON public.help_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND is_admin = true AND is_deleted = false
    )
  );

CREATE POLICY "Admins can update help requests"
  ON public.help_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND is_admin = true AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND is_admin = true AND is_active = true
    )
  );

CREATE POLICY "Admins can delete help requests"
  ON public.help_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND is_admin = true AND is_active = true
    )
  );

-- ============================================================
-- Fix mutable search_path on functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT is_admin FROM public.users WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.submissions
  SET status = 'approved',
    admin_note = p_note,
    updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_approved', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.submissions
  SET status = 'rejected',
    admin_note = p_note,
    updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_rejected', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_flag_submission(p_submission_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.submissions
  SET status = 'flagged',
    admin_note = p_note,
    updated_at = now()
  WHERE id = p_submission_id;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (auth.uid(), 'submission_flagged', json_build_object('submission_id', p_submission_id, 'note', p_note));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_month text;
  v_result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT value INTO v_current_month FROM public.settings WHERE key = 'current_month_key' LIMIT 1;
  IF v_current_month IS NULL THEN
    v_current_month := to_char(now(), 'YYYY-MM');
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.users WHERE is_deleted = false),
    'active_users', (SELECT count(*) FROM public.users WHERE is_active = true AND is_deleted = false),
    'total_submissions_this_month', (SELECT count(*) FROM public.submissions WHERE month_key = v_current_month),
    'pending_count', (SELECT count(*) FROM public.submissions WHERE status = 'pending'),
    'flagged_count', (SELECT count(*) FROM public.submissions WHERE status = 'flagged'),
    'approved_count', (SELECT count(*) FROM public.submissions WHERE status = 'approved' AND month_key = v_current_month),
    'current_month', v_current_month
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid() LIMIT 1) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.users SET is_admin = p_is_admin WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_help_request_rate_limit(submitter_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.help_requests
  WHERE email = submitter_email
  AND created_at > now() - interval '1 hour';

  RETURN recent_count < 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(p_month_key text)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, total_steps bigint, weeks_submitted bigint, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH user_totals AS (
    SELECT
      u.id AS uid,
      u.full_name AS uname,
      u.avatar_url AS uavatar,
      COALESCE(SUM(s.confirmed_steps), 0)::bigint AS total,
      COUNT(DISTINCT s.week_ending_date)::bigint AS week_count,
      MIN(s.created_at) AS first_sub
    FROM public.users u
    LEFT JOIN public.submissions s
      ON s.user_id = u.id
      AND s.month_key = p_month_key
      AND s.status = 'approved'
    WHERE u.is_active = true
      AND u.is_deleted = false
    GROUP BY u.id, u.full_name, u.avatar_url
  )
  SELECT
    uid AS user_id,
    uname AS full_name,
    uavatar AS avatar_url,
    total AS total_steps,
    week_count AS weeks_submitted,
    RANK() OVER (ORDER BY total DESC, first_sub ASC NULLS LAST)::bigint AS rank
  FROM user_totals
  WHERE total > 0
  ORDER BY total DESC, first_sub ASC NULLS LAST;
END;
$$;
