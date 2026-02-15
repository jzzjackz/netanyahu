-- Add profile customization and status features

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'invisible')),
ADD COLUMN IF NOT EXISTS custom_status TEXT,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- Create mentions table to track @mentions
CREATE TABLE IF NOT EXISTS public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create DM mentions table
CREATE TABLE IF NOT EXISTS public.dm_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_mentions ENABLE ROW LEVEL SECURITY;

-- Mentions policies
CREATE POLICY "mentions_select" ON public.mentions
  FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid());

CREATE POLICY "mentions_insert" ON public.mentions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "mentions_update" ON public.mentions
  FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid());

-- DM Mentions policies
CREATE POLICY "dm_mentions_select" ON public.dm_mentions
  FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid());

CREATE POLICY "dm_mentions_insert" ON public.dm_mentions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "dm_mentions_update" ON public.dm_mentions
  FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid());

-- Add realtime for mentions
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_mentions;

-- Create storage bucket for avatars and banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for banners
CREATE POLICY "Banner images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

CREATE POLICY "Users can upload their own banner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own banner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own banner"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update last_seen timestamp
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = NOW()
  WHERE id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen when user sends a message
CREATE TRIGGER update_last_seen_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();

CREATE TRIGGER update_last_seen_on_dm
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();
