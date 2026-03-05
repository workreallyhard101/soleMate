/*
  # Drop freeze_month function

  Removes the freeze_month RPC function entirely as the feature is no longer needed.
*/

DROP FUNCTION IF EXISTS freeze_month(text, text);
