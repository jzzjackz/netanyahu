-- Enable realtime for voice channel presence
-- Voice channels already exist in the channels table with type='voice'
-- This just ensures realtime is enabled for any voice-related features

-- Enable realtime on channels table if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE channels;

-- No additional tables needed - voice channels use the existing channels table
-- Voice call state is managed via Supabase Realtime broadcast channels
-- Private calls use direct_conversations table which already exists

-- Verify channels table has the type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'channels' AND column_name = 'type'
  ) THEN
    ALTER TABLE channels ADD COLUMN type text DEFAULT 'text';
  END IF;
END $$;

COMMENT ON COLUMN channels.type IS 'Channel type: text or voice';
