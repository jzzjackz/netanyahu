-- Create favorite_gifs table
CREATE TABLE IF NOT EXISTS favorite_gifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_url TEXT NOT NULL,
  gif_title TEXT,
  gif_preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gif_url)
);

-- Enable RLS
ALTER TABLE favorite_gifs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own favorites"
  ON favorite_gifs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON favorite_gifs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorite_gifs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_favorite_gifs_user_id ON favorite_gifs(user_id);
CREATE INDEX idx_favorite_gifs_created_at ON favorite_gifs(created_at DESC);
