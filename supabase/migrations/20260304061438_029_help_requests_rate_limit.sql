/*
  # Add rate limiting to help_requests

  1. Changes
    - Add `ip_address` column (text, nullable) to store submitter IP for rate limiting
    - Add DB-level rate limit function: max 3 help requests per email per hour
    - Drop and recreate the INSERT policy to enforce the rate limit via a check function

  2. Rate Limit Logic
    - A single email address can submit at most 3 help requests within any rolling 60-minute window
    - Exceeding this returns a policy violation error
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'help_requests' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE help_requests ADD COLUMN ip_address text DEFAULT '';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_help_request_rate_limit(submitter_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM help_requests
  WHERE email = submitter_email
    AND created_at > now() - interval '1 hour';

  RETURN recent_count < 3;
END;
$$;

DROP POLICY IF EXISTS "Anyone can submit a help request" ON help_requests;

CREATE POLICY "Anyone can submit a help request with rate limit"
  ON help_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    check_help_request_rate_limit(email)
  );
