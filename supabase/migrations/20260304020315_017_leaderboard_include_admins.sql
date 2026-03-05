/*
  # Fix leaderboard to include admin users

  ## Summary
  The leaderboard was filtering out users with is_admin = true, which excluded
  admin users from appearing in rankings even when they have approved submissions.
  Since admins can also participate in the competition, this migration removes
  the is_admin filter so all active, non-deleted users appear on the leaderboard.

  ## Changes
  - Drop and recreate get_monthly_leaderboard to remove the `is_admin = false` filter
  - All active, non-deleted users now appear if they have approved submissions
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
      COUNT(s.id)::bigint AS sub_count,
      MIN(s.created_at) AS first_sub
    FROM public.users u
    LEFT JOIN public.submissions s
      ON s.user_id = u.id
      AND s.month_key = p_month_key
      AND s.status = 'approved'
    WHERE u.is_active = true
      AND u.is_deleted = false
    GROUP BY u.id, u.full_name
  )
  SELECT
    uid AS user_id,
    uname AS full_name,
    total AS total_steps,
    sub_count AS weeks_submitted,
    RANK() OVER (ORDER BY total DESC, first_sub ASC NULLS LAST)::bigint AS rank
  FROM user_totals
  WHERE total > 0
  ORDER BY total DESC, first_sub ASC NULLS LAST;
END;
$$;
