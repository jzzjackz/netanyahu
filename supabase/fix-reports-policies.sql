-- Fix user_reports RLS policies to allow admins to see all reports

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own reports" ON user_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON user_reports;
DROP POLICY IF EXISTS "Users can create reports" ON user_reports;
DROP POLICY IF EXISTS "Admins can update report status" ON user_reports;

-- Recreate policies with proper logic
CREATE POLICY "Users and admins can view reports"
  ON user_reports FOR SELECT
  USING (
    auth.uid() = reporter_id 
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can create reports"
  ON user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update report status"
  ON user_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
