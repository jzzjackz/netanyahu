-- Video platform tables for AllInOne Vidz

-- Videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration int, -- in seconds
  views int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Video likes/dislikes
CREATE TABLE IF NOT EXISTS public.video_reactions (
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

-- Video comments
CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subscriptions (follow channels)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  subscriber_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (subscriber_id, channel_id),
  CHECK (subscriber_id != channel_id)
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Videos policies (anyone can view, authenticated can upload)
CREATE POLICY "videos_select_all" ON public.videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "videos_insert_authenticated" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "videos_update_own" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = uploader_id);
CREATE POLICY "videos_delete_own" ON public.videos FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

-- Video reactions policies
CREATE POLICY "video_reactions_select_all" ON public.video_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "video_reactions_insert_own" ON public.video_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_reactions_update_own" ON public.video_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "video_reactions_delete_own" ON public.video_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Video comments policies
CREATE POLICY "video_comments_select_all" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "video_comments_insert_authenticated" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_comments_update_own" ON public.video_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "video_comments_delete_own" ON public.video_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "subscriptions_select_all" ON public.subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid() = subscriber_id);
