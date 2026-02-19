-- Add channel permissions table
CREATE TABLE IF NOT EXISTS channel_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  role_id UUID REFERENCES server_roles(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_send_messages BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, role_id)
);

-- Enable RLS
ALTER TABLE channel_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for channel_permissions
CREATE POLICY "Anyone can view channel permissions in their servers"
ON channel_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM channels c
    JOIN server_members sm ON sm.server_id = c.server_id
    WHERE c.id = channel_permissions.channel_id
    AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Server owners can manage channel permissions"
ON channel_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM channels c
    JOIN servers s ON s.id = c.server_id
    WHERE c.id = channel_permissions.channel_id
    AND s.owner_id = auth.uid()
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE channel_permissions;

-- Function to check if user can view channel
CREATE OR REPLACE FUNCTION can_user_view_channel(p_user_id UUID, p_channel_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_server_id UUID;
  v_is_owner BOOLEAN;
  v_user_roles UUID[];
  v_has_permission BOOLEAN;
BEGIN
  -- Get server_id and check if user is owner
  SELECT c.server_id, s.owner_id = p_user_id
  INTO v_server_id, v_is_owner
  FROM channels c
  JOIN servers s ON s.id = c.server_id
  WHERE c.id = p_channel_id;
  
  -- Owners can always view
  IF v_is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's roles in this server
  SELECT ARRAY_AGG(ur.role_id)
  INTO v_user_roles
  FROM user_roles ur
  JOIN server_roles sr ON sr.id = ur.role_id
  WHERE ur.user_id = p_user_id
  AND sr.server_id = v_server_id;
  
  -- If no specific permissions set, default to true
  IF NOT EXISTS (
    SELECT 1 FROM channel_permissions
    WHERE channel_id = p_channel_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if any of user's roles have view permission
  SELECT COALESCE(bool_or(cp.can_view), FALSE)
  INTO v_has_permission
  FROM channel_permissions cp
  WHERE cp.channel_id = p_channel_id
  AND cp.role_id = ANY(v_user_roles);
  
  RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can send messages in channel
CREATE OR REPLACE FUNCTION can_user_send_in_channel(p_user_id UUID, p_channel_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_server_id UUID;
  v_is_owner BOOLEAN;
  v_user_roles UUID[];
  v_has_permission BOOLEAN;
BEGIN
  -- Get server_id and check if user is owner
  SELECT c.server_id, s.owner_id = p_user_id
  INTO v_server_id, v_is_owner
  FROM channels c
  JOIN servers s ON s.id = c.server_id
  WHERE c.id = p_channel_id;
  
  -- Owners can always send
  IF v_is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's roles in this server
  SELECT ARRAY_AGG(ur.role_id)
  INTO v_user_roles
  FROM user_roles ur
  JOIN server_roles sr ON sr.id = ur.role_id
  WHERE ur.user_id = p_user_id
  AND sr.server_id = v_server_id;
  
  -- If no specific permissions set, default to true
  IF NOT EXISTS (
    SELECT 1 FROM channel_permissions
    WHERE channel_id = p_channel_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if any of user's roles have send permission
  SELECT COALESCE(bool_or(cp.can_send_messages), FALSE)
  INTO v_has_permission
  FROM channel_permissions cp
  WHERE cp.channel_id = p_channel_id
  AND cp.role_id = ANY(v_user_roles);
  
  RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
