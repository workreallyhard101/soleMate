/*
  # Update handle_new_user trigger to also save phone from metadata

  ## Summary
  Extends the trigger to populate the phone field from user metadata on signup,
  so email-based signups with a phone number also have it stored in the users table.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, phone, secret_phrase_hash, is_admin, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
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
