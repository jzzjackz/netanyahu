-- Add more profile customization fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_color TEXT DEFAULT '#5865f2';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
