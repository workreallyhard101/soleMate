/*
  # Auto-create profile row on user signup

  ## Problem
  When a new user registers, the client-side upsert to `profiles` runs before
  the session is fully established, so RLS rejects it silently and no profile
  row is created.

  ## Solution
  Add a Postgres trigger on `auth.users` that fires AFTER INSERT and immediately
  inserts the corresponding `profiles` row using the data passed via
  `raw_user_meta_data` (where the frontend already sends `full_name`).

  ## Changes
  - New function: `handle_new_user()` — SECURITY DEFINER function that inserts
    into profiles using the new auth user's id and metadata
  - New trigger: `on_auth_user_created` on `auth.users` AFTER INSERT

  ## Notes
  - Uses SECURITY DEFINER so it bypasses RLS and always succeeds
  - `full_name` is read from `new.raw_user_meta_data->>'full_name'`
  - `role` defaults to 'user', `is_active` defaults to true
  - ON CONFLICT DO NOTHING ensures idempotency (safe if row already exists)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
