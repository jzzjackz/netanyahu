-- Add server bans table
CREATE TABLE IF NOT EXISTS public.server_bans (
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  banned_at timestamptz DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

-- Enable RLS
ALTER TABLE public.server_bans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "server_bans_select_all" ON public.server_bans 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "server_bans_insert_admin" ON public.server_bans 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "server_bans_delete_admin" ON public.server_bans 
  FOR DELETE TO authenticated 
  USING (true);
