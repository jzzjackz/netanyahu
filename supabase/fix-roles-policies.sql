-- Drop old policies that cause infinite recursion
DROP POLICY IF EXISTS "Anyone can view roles in their servers" ON server_roles;
DROP POLICY IF EXISTS "Server owners and users with manage_roles can create roles" ON server_roles;
DROP POLICY IF EXISTS "Server owners and users with manage_roles can update roles" ON server_roles;
DROP POLICY IF EXISTS "Server owners and users with manage_roles can delete roles" ON server_roles;
DROP POLICY IF EXISTS "Server owners can create roles" ON server_roles;
DROP POLICY IF EXISTS "Server owners can update roles" ON server_roles;
DROP POLICY IF EXISTS "Server owners can delete roles" ON server_roles;

DROP POLICY IF EXISTS "Anyone can view role assignments in their servers" ON user_roles;
DROP POLICY IF EXISTS "Server owners and users with manage_roles can assign roles" ON user_roles;
DROP POLICY IF EXISTS "Server owners and users with manage_roles can remove role assignments" ON user_roles;
DROP POLICY IF EXISTS "Server owners can assign roles" ON user_roles;
DROP POLICY IF EXISTS "Server owners can remove role assignments" ON user_roles;

-- Create simplified policies (no infinite recursion)
CREATE POLICY "Anyone can view roles in their servers"
  ON server_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = server_roles.server_id
      AND server_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can create roles"
  ON server_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_roles.server_id
      AND servers.owner_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can update roles"
  ON server_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_roles.server_id
      AND servers.owner_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can delete roles"
  ON server_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_roles.server_id
      AND servers.owner_id = auth.uid()
    )
  );

-- Policies for user_roles
CREATE POLICY "Anyone can view role assignments in their servers"
  ON user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM server_roles sr
      JOIN server_members sm ON sm.server_id = sr.server_id
      WHERE sr.id = user_roles.role_id
      AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can assign roles"
  ON user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_roles sr
      JOIN servers s ON s.id = sr.server_id
      WHERE sr.id = user_roles.role_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can remove role assignments"
  ON user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM server_roles sr
      JOIN servers s ON s.id = sr.server_id
      WHERE sr.id = user_roles.role_id
      AND s.owner_id = auth.uid()
    )
  );
