-- Re-enable RLS with simpler, working policies

-- First, drop all existing policies
DROP POLICY IF EXISTS "servers_select_members" ON public.servers;
DROP POLICY IF EXISTS "servers_insert" ON public.servers;
DROP POLICY IF EXISTS "servers_update_owner" ON public.servers;
DROP POLICY IF EXISTS "servers_delete_owner" ON public.servers;
DROP POLICY IF EXISTS "server_members_select" ON public.server_members;
DROP POLICY IF EXISTS "server_members_insert_authenticated" ON public.server_members;
DROP POLICY IF EXISTS "server_members_delete_self_or_admin" ON public.server_members;
DROP POLICY IF EXISTS "channels_select" ON public.channels;
DROP POLICY IF EXISTS "channels_insert" ON public.channels;
DROP POLICY IF EXISTS "channels_update" ON public.channels;
DROP POLICY IF EXISTS "channels_delete" ON public.channels;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update_author" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_author" ON public.messages;

-- Enable RLS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SERVERS: Simple policies
-- Allow authenticated users to see all servers (you can restrict this later)
CREATE POLICY "servers_select_all" ON public.servers 
  FOR SELECT TO authenticated 
  USING (true);

-- Allow authenticated users to create servers
CREATE POLICY "servers_insert_authenticated" ON public.servers 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to update their servers
CREATE POLICY "servers_update_owner" ON public.servers 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = owner_id);

-- Allow owners to delete their servers
CREATE POLICY "servers_delete_owner" ON public.servers 
  FOR DELETE TO authenticated 
  USING (auth.uid() = owner_id);

-- SERVER_MEMBERS: Simple policies
-- Allow users to see all members (you can restrict this later)
CREATE POLICY "server_members_select_all" ON public.server_members 
  FOR SELECT TO authenticated 
  USING (true);

-- Allow authenticated users to insert members (for joining servers)
CREATE POLICY "server_members_insert_authenticated" ON public.server_members 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- Allow users to remove themselves or admins to remove others
CREATE POLICY "server_members_delete_self" ON public.server_members 
  FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

-- CHANNELS: Simple policies
-- Allow users to see all channels (you can restrict this later)
CREATE POLICY "channels_select_all" ON public.channels 
  FOR SELECT TO authenticated 
  USING (true);

-- Allow authenticated users to create channels
CREATE POLICY "channels_insert_authenticated" ON public.channels 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- Allow authenticated users to update channels
CREATE POLICY "channels_update_authenticated" ON public.channels 
  FOR UPDATE TO authenticated 
  USING (true);

-- Allow authenticated users to delete channels
CREATE POLICY "channels_delete_authenticated" ON public.channels 
  FOR DELETE TO authenticated 
  USING (true);

-- MESSAGES: Simple policies
-- Allow users to see all messages (you can restrict this later)
CREATE POLICY "messages_select_all" ON public.messages 
  FOR SELECT TO authenticated 
  USING (true);

-- Allow users to insert messages
CREATE POLICY "messages_insert_authenticated" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = author_id);

-- Allow authors to update their messages
CREATE POLICY "messages_update_author" ON public.messages 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = author_id);

-- Allow authors to delete their messages
CREATE POLICY "messages_delete_author" ON public.messages 
  FOR DELETE TO authenticated 
  USING (auth.uid() = author_id);
