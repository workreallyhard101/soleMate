/*
  # Add daily submission support

  ## Summary
  Changes the submission model from one-per-week to one-per-day, allowing users
  to upload a separate proof file for each individual day of the week.

  ## Changes

  ### Modified Table: submissions
  - Add `submission_date` (date) — the specific calendar day this submission covers
  - Backfill existing rows: set submission_date = week_ending_date for backwards compatibility
  - Drop old unique constraint: (user_id, week_ending_date)
  - Add new unique constraint: (user_id, submission_date)
  - week_ending_date is kept for grouping submissions by week and month calculations

  ## Notes
  - Existing submissions are preserved; submission_date defaults to week_ending_date
  - The leaderboard/monthly totals continue to aggregate by week_ending_date
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'submission_date'
  ) THEN
    ALTER TABLE submissions ADD COLUMN submission_date date;
  END IF;
END $$;

UPDATE submissions
SET submission_date = week_ending_date::date
WHERE submission_date IS NULL;

ALTER TABLE submissions ALTER COLUMN submission_date SET NOT NULL;
ALTER TABLE submissions ALTER COLUMN submission_date SET DEFAULT CURRENT_DATE;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_id_week_ending_date_key;

ALTER TABLE submissions ADD CONSTRAINT submissions_user_id_submission_date_key
  UNIQUE (user_id, submission_date);

CREATE INDEX IF NOT EXISTS idx_submissions_submission_date ON submissions(submission_date);
