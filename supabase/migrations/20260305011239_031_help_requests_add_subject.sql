/*
  # Add subject column to help_requests

  1. Changes
    - Add `subject` column (text, not null, default '') to `help_requests`
    - Max length enforced at application level (80 chars)
    - Existing rows get an empty subject by default

  2. Notes
    - Subject is mandatory in the form but defaults to '' to avoid breaking existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'help_requests' AND column_name = 'subject'
  ) THEN
    ALTER TABLE help_requests ADD COLUMN subject text NOT NULL DEFAULT '';
  END IF;
END $$;
