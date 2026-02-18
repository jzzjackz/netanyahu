-- Create server_roles table
CREATE TABLE IF NOT EXISTS server_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#99aab5',
  position INTEGER DEFAULT 0,
  -- Permissions
  manage_server BOOLEAN DEFAULT FALSE,
  manage_roles BOOLEAN DEFAULT FALSE,
  manage_channels BOOLEAN DEFAULT FALSE,
  kick_members BOOLEAN DEFAULT FALSE,
  ban_members BOOLEAN DEFAULT FALSE,
  create_invite BOOLEAN DEFAULT FALSE,
  manage_messages BOOLEAN DEFAULT FALSE,
  send_messages BOOLEAN DEFAULT TRUE,
  read_messages BOOLEAN DEFAULT TRUE,
  mention_everyone BOOLEAN DEFAULT FALSE,
  add_reactions BOOLEAN DEFAULT TRUE,
  view_audit_log BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, name)
);

-- Create user_roles table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES server_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- Enable RLS
ALTER TABLE server_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for server_roles
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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE server_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_roles;

-- Create default @everyone role for existing servers
INSERT INTO server_roles (server_id, name, color, position, send_messages, read_messages, add_reactions)
SELECT id, '@everyone', '#99aab5', 0, true, true, true
FROM servers
WHERE NOT EXISTS (
  SELECT 1 FROM server_roles WHERE server_id = servers.id AND name = '@everyone'
);
