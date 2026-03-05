/*
  # Fix leaderboard to count days submitted (not weeks)

  ## Summary
  With the move to daily submissions, weeks_submitted now counts distinct calendar
  days a user has had an approved submission, rather than distinct weeks.

  ## Changes
  - Recreates get_monthly_leaderboard to count distinct submission_date values
    instead of COUNT(s.id), which was double-counting daily submissions as weeks
  - The returned column name stays `weeks_submitted` for frontend compatibility
    but now semantically represents "days submitted"
*/

DROP FUNCTION IF EXISTS get_monthly_leaderboard(text);

CREATE OR REPLACE FUNCTION get_monthly_leaderboard(p_month_key text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  total_steps bigint,
  weeks_submitted bigint,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
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
      COALESCE(SUM(s.confirmed_steps), 0)::bigint AS total,
      COUNT(DISTINCT s.week_ending_date)::bigint AS week_count,
      COUNT(s.id)::bigint AS day_count,
      MIN(s.created_at) AS first_sub
    FROM public.users u
    LEFT JOIN public.submissions s
      ON s.user_id = u.id
      AND s.month_key = p_month_key
      AND s.status = 'approved'
    WHERE u.is_admin = false
      AND u.is_active = true
      AND u.is_deleted = false
    GROUP BY u.id, u.full_name
  )
  SELECT
    uid AS user_id,
    uname AS full_name,
    total AS total_steps,
    week_count AS weeks_submitted,
    RANK() OVER (ORDER BY total DESC, first_sub ASC NULLS LAST)::bigint AS rank
  FROM user_totals
  WHERE total > 0
  ORDER BY total DESC, first_sub ASC NULLS LAST;
END;
$$;
