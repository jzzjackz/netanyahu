-- Fix platform_bans RLS policies to allow users to check their own ban status

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all bans" ON platform_bans;
DROP POLICY IF EXISTS "Admins can create bans" ON platform_bans;
DROP POLICY IF EXISTS "Admins can delete bans" ON platform_bans;

-- Recreate policies with proper logic
CREATE POLICY "Users can view their own ban and admins can view all"
  ON platform_bans FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can create bans"
  ON platform_bans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete bans"
  ON platform_bans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
