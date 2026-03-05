/*
  # Fix leaderboard to include all users regardless of admin status

  ## Change
  - Updated `get_monthly_leaderboard` to remove the `is_admin = false` filter
  - All active, non-deleted users with approved submissions now appear on the leaderboard
*/

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
    week_count AS weeks_submitted,
    RANK() OVER (ORDER BY total DESC, first_sub ASC NULLS LAST)::bigint AS rank
  FROM user_totals
  WHERE total > 0
  ORDER BY total DESC, first_sub ASC NULLS LAST;
END;
$$;
