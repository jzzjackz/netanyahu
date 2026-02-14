-- Enable RLS for direct messages and conversations

-- Enable RLS on tables
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "direct_conversations_select" ON public.direct_conversations;
DROP POLICY IF EXISTS "direct_conversations_insert" ON public.direct_conversations;
DROP POLICY IF EXISTS "direct_messages_select" ON public.direct_messages;
DROP POLICY IF EXISTS "direct_messages_insert" ON public.direct_messages;

-- DIRECT_CONVERSATIONS policies
-- Users can see conversations they're part of
CREATE POLICY "direct_conversations_select" ON public.direct_conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Users can create conversations
CREATE POLICY "direct_conversations_insert" ON public.direct_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- DIRECT_MESSAGES policies
-- Users can see messages in conversations they're part of
CREATE POLICY "direct_messages_select" ON public.direct_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_conversations
      WHERE id = conversation_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );

-- Users can insert messages in conversations they're part of
CREATE POLICY "direct_messages_insert" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.direct_conversations
      WHERE id = conversation_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );
