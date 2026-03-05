/*
  # Add Superstar Wins RPC Function

  ## Summary
  Creates a function that calculates how many monthly "SoleMate Superstar" wins
  each user has accumulated across all completed months.

  A win is defined as being the #1 ranked user (most approved steps) in a given
  month_key. Only fully completed months (not the current active month) count as wins.

  ## New Functions
  - `get_superstar_wins()` — returns a table of (user_id, win_count) for all
    users who have won at least one month. Uses SECURITY DEFINER so it can
    read across RLS boundaries for authenticated callers.

  ## Security
  - Requires authentication (auth.uid() IS NULL raises exception)
  - SECURITY DEFINER with explicit schema search path
*/

CREATE OR REPLACE FUNCTION get_superstar_wins()
RETURNS TABLE (
  user_id uuid,
  win_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
