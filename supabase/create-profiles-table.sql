-- Create profiles table that links to Supabase Auth
-- This replaces the custom users table approach

-- First, create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  status text DEFAULT 'offline' CHECK (status IN ('online','offline','idle','dnd')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "profiles_select_authenticated" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);
