/*
  # Fix get_monthly_leaderboard RPC

  ## Summary
  The existing function references the old `profiles` table (renamed to `users`)
  and the old `role` column (replaced by `is_admin`). This migration:

  1. Drops and recreates the function with the correct table/column references
  2. Queries `users` table instead of `profiles`
  3. Filters by `is_admin = false` and `is_deleted = false`
  4. Returns `weeks_submitted` column (matching frontend expectations)
  5. Only includes users with at least 1 approved submission

  ## Security
  - SECURITY DEFINER so it can read user names across RLS boundaries
  - Still requires authentication (auth.uid() IS NULL check)
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
    WHERE u.is_admin = false
      AND u.is_active = true
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
