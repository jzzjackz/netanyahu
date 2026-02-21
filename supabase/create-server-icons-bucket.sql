-- Create server-icons storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('server-icons', 'server-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for server-icons bucket
CREATE POLICY "Anyone can view server icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'server-icons');

CREATE POLICY "Server owners can upload icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'server-icons' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Server owners can update their icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'server-icons' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Server owners can delete their icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'server-icons' AND
  auth.uid() IS NOT NULL
);
