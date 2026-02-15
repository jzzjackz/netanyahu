-- Enable realtime for messages tables
-- This allows real-time subscriptions to work

-- Add messages table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add direct_messages table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Add profiles table to realtime publication for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Optionally add other tables you want realtime updates for
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
