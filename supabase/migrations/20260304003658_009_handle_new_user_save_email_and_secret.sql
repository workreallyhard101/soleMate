/*
  # Update handle_new_user trigger to save email and secret_phrase_hash

  ## Summary
  The trigger now also saves the user's email and secret_phrase_hash (base64-encoded)
  from auth metadata into the users table on signup.

  ## Changes
  - `handle_new_user` function updated to populate `email` and `secret_phrase_hash`
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, secret_phrase_hash, is_admin, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE
      WHEN NEW.raw_user_meta_data->>'secret_phrase' IS NOT NULL
      THEN encode(convert_to(NEW.raw_user_meta_data->>'secret_phrase', 'UTF8'), 'base64')
      ELSE ''
    END,
    false,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
