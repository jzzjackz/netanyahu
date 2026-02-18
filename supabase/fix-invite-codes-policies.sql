-- Add policies for invite_codes table

-- Anyone can view invite codes (needed to use them)
CREATE POLICY "Anyone can view invite codes"
  ON invite_codes FOR SELECT
  USING (true);

-- Server members can create invite codes for their servers
CREATE POLICY "Server members can create invites"
  ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = invite_codes.server_id
      AND server_members.user_id = auth.uid()
    )
  );

-- Admins can create invite codes for any server
CREATE POLICY "Admins can create any invite"
  ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Users can delete their own invite codes
CREATE POLICY "Users can delete own invites"
  ON invite_codes FOR DELETE
  USING (auth.uid() = created_by);
