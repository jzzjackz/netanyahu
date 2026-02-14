-- Temporarily disable RLS to test if that's the issue
-- WARNING: This makes your data publicly accessible. Only for testing!

ALTER TABLE public.servers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
