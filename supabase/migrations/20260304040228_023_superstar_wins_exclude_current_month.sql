/*
  # Fix Superstar Wins: Exclude Current Month

  ## Summary
  Updates get_superstar_wins() to only count wins from fully completed months.
  The current calendar month is always excluded from the win calculation so that
  a user cannot "win" a month that is still in progress.

  ## Changes
  - Drops and recreates get_superstar_wins()
  - Adds a WHERE filter: s.month_key < to_char(now(), 'YYYY-MM')
*/

DROP FUNCTION IF EXISTS get_superstar_wins();

CREATE OR REPLACE FUNCTION get_superstar_wins()
RETURNS TABLE (
  user_id uuid,
  win_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH monthly_totals AS (
    SELECT
      s.user_id,
      s.month_key,
      SUM(s.confirmed_steps)::bigint AS total_steps,
      MIN(s.created_at) AS first_sub
    FROM public.submissions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.status = 'approved'
      AND u.is_deleted = false
      AND s.month_key < v_current_month
    GROUP BY s.user_id, s.month_key
  ),
  monthly_ranks AS (
    SELECT
      mt.user_id,
      mt.month_key,
      RANK() OVER (
        PARTITION BY mt.month_key
        ORDER BY mt.total_steps DESC, mt.first_sub ASC
      ) AS month_rank
    FROM monthly_totals mt
  )
  SELECT
    mr.user_id,
    COUNT(*)::bigint AS win_count
  FROM monthly_ranks mr
  WHERE mr.month_rank = 1
  GROUP BY mr.user_id
  ORDER BY win_count DESC;
END;
$$;
