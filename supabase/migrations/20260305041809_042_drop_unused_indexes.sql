/*
  # Drop unused indexes

  ## Summary
  Removes indexes that have never been used according to pg_stat_user_indexes.
  These indexes consume disk space and slow down writes without providing query benefits.

  ## Dropped Indexes
  - idx_submissions_user_id
  - idx_submissions_month_key
  - idx_submissions_month_status
  - idx_audit_logs_user_id
  - idx_audit_logs_created_at
  - idx_rate_limits_lookup
  - idx_submissions_submission_date
  - idx_submissions_end_date
  - idx_user_edit_logs_admin
*/

DROP INDEX IF EXISTS public.idx_submissions_user_id;
DROP INDEX IF EXISTS public.idx_submissions_month_key;
DROP INDEX IF EXISTS public.idx_submissions_month_status;
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_rate_limits_lookup;
DROP INDEX IF EXISTS public.idx_submissions_submission_date;
DROP INDEX IF EXISTS public.idx_submissions_end_date;
DROP INDEX IF EXISTS public.idx_user_edit_logs_admin;
