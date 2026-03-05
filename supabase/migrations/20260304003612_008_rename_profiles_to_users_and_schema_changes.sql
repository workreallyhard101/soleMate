/*
  # Rename profiles to users, add is_admin, add account_deletion_date, drop role

  ## Summary
  This migration restructures the core user table:

  1. Renames the `profiles` table to `users`
  2. Adds `is_admin` boolean column (replaces the `role` text column)
  3. Adds `account_deletion_date` timestamptz column (nullable)
  4. Drops the `role` column

  ## Changes

  ### Table Rename
  - `profiles` → `users`

  ### New Columns
  - `is_admin` (boolean, NOT NULL, DEFAULT false) — replaces the old role/check constraint
  - `account_deletion_date` (timestamptz, nullable) — scheduled account deletion date

  ### Removed Columns
  - `role` text column and its CHECK constraint are dropped

  ### Updated Constraints / References
  - The FK constraint `profiles_id_fkey` is recreated as part of the rename
  - The trigger function `handle_new_user` is updated to use the new table name and columns

  ### Security
  - RLS is re-enabled on the new table name
  - All existing RLS policies are dropped and recreated pointing at `users`

  ## Notes
  - Uses ALTER TABLE ... RENAME to preserve data and constraints
  - Existing rows will have is_admin = false by default (safe migration)
  - Any previous admin users identified by role='admin' will have is_admin set to true
*/

ALTER TABLE public.profiles RENAME TO users;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE public.users SET is_admin = true WHERE role = 'admin';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users DROP COLUMN role;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_deletion_date'
  ) THEN
    ALTER TABLE public.users ADD COLUMN account_deletion_date timestamptz;
  END IF;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.users;

CREATE POLICY "Users can read own record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all records"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  );

CREATE POLICY "Admins can update all records"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, is_admin, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    false,
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
