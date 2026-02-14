-- Fix server policies to allow proper server creation and listing

-- Drop existing server policies
DROP POLICY IF EXISTS "servers_select_members" ON public.servers;
DROP POLICY IF EXISTS "servers_insert" ON public.servers;
DROP POLICY IF EXISTS "servers_update_owner" ON public.servers;
DROP POLICY IF EXISTS "servers_delete_owner" ON public.servers;

-- New policies that work correctly
-- Allow users to see servers they're members of OR servers they own
CREATE POLICY "servers_select_members" ON public.servers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = servers.id AND m.user_id = auth.uid())
    OR owner_id = auth.uid()
  );

-- Allow any authenticated user to create a server (they become owner)
CREATE POLICY "servers_insert" ON public.servers FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = owner_id);

-- Allow owner to update their server
CREATE POLICY "servers_update_owner" ON public.servers FOR UPDATE TO authenticated 
  USING (auth.uid() = owner_id);

-- Allow owner to delete their server
CREATE POLICY "servers_delete_owner" ON public.servers FOR DELETE TO authenticated 
  USING (auth.uid() = owner_id);
