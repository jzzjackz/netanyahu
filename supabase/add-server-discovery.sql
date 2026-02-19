-- Add server discovery fields
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN DEFAULT FALSE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS discovery_description TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Create function to update member count
CREATE OR REPLACE FUNCTION update_server_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE servers 
    SET member_count = (
      SELECT COUNT(*) FROM server_members WHERE server_id = NEW.server_id
    )
    WHERE id = NEW.server_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE servers 
    SET member_count = (
      SELECT COUNT(*) FROM server_members WHERE server_id = OLD.server_id
    )
    WHERE id = OLD.server_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update member count
DROP TRIGGER IF EXISTS update_member_count_trigger ON server_members;
CREATE TRIGGER update_member_count_trigger
AFTER INSERT OR DELETE ON server_members
FOR EACH ROW
EXECUTE FUNCTION update_server_member_count();

-- Initialize member counts for existing servers
UPDATE servers
SET member_count = (
  SELECT COUNT(*) FROM server_members WHERE server_id = servers.id
);
