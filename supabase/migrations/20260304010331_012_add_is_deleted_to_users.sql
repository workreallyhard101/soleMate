/*
  # Add is_deleted column to users table

  1. Modified Tables
    - `users`
      - `is_deleted` (boolean, NOT NULL, DEFAULT false) - soft delete flag

  2. Notes
    - Non-destructive change, existing rows default to false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE users ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;
