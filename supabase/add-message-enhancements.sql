-- Add message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Add pinned messages tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id);

-- Add thread support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_count INTEGER DEFAULT 0;

-- Enable RLS on reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for message_reactions
CREATE POLICY "Anyone can view reactions in their channels"
ON message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    LEFT JOIN channels c ON c.id = m.channel_id
    LEFT JOIN server_members sm ON sm.server_id = c.server_id
    LEFT JOIN direct_conversations dc ON dc.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
    AND (
      sm.user_id = auth.uid()
      OR dc.user_a_id = auth.uid()
      OR dc.user_b_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can add their own reactions"
ON message_reactions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
ON message_reactions FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Function to update thread count
CREATE OR REPLACE FUNCTION update_thread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.thread_id IS NOT NULL THEN
    UPDATE messages 
    SET thread_count = thread_count + 1
    WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' AND OLD.thread_id IS NOT NULL THEN
    UPDATE messages 
    SET thread_count = GREATEST(thread_count - 1, 0)
    WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for thread count
DROP TRIGGER IF EXISTS update_thread_count_trigger ON messages;
CREATE TRIGGER update_thread_count_trigger
AFTER INSERT OR DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_count();
