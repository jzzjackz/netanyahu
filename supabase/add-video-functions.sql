-- Function to increment video views
CREATE OR REPLACE FUNCTION increment_video_views(video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.videos
  SET views = views + 1
  WHERE id = video_id;
END;
$$;
