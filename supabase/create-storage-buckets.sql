-- Create storage buckets for videos and thumbnails

-- Create videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create thumbnails bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for videos bucket
CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'videos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Set up storage policies for thumbnails bucket
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
