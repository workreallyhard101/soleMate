/*
  # Add submission_end_date for date range submissions

  ## Summary
  Adds an optional end date column to the submissions table so a single submission
  can cover a range of days (e.g., Mon–Sun) submitted with one proof file.

  ## Changes

  ### Modified Table: submissions
  - Add `submission_end_date` (date, nullable) — when set, this submission covers
    submission_date through submission_end_date (inclusive). When null, it is a
    single-day submission as before.

  ## Notes
  - Existing rows are unaffected (submission_end_date remains null = single day)
  - The unique constraint on (user_id, submission_date) is relaxed for range rows:
    we drop the old unique constraint and add a partial unique index only for
    single-day submissions. Range submissions may overlap dates, so uniqueness
    is enforced at the application level for overlapping ranges.
  - No data loss — purely additive change.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'submission_end_date'
  ) THEN
    ALTER TABLE submissions ADD COLUMN submission_end_date date;
  END IF;
END $$;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_id_submission_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_single_day_unique
  ON submissions (user_id, submission_date)
  WHERE submission_end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_end_date ON submissions(submission_end_date);
