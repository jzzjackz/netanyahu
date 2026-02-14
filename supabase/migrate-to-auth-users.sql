-- Migration to use Supabase Auth instead of custom users table
-- WARNING: This will delete all existing data. Only run on a fresh database or backup first!

-- Drop existing tables that reference the old users table
DROP TABLE IF EXISTS public.invite_codes CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.server_members CASCADE;
DROP TABLE IF EXISTS public.servers CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create profiles table (links to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  status text DEFAULT 'offline' CHECK (status IN ('online','offline','idle','dnd')),
  created_at timestamptz DEFAULT now()
);

-- Servers table with uuid
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  icon_url text,
  created_at timestamptz DEFAULT now()
);

-- Server members with uuid
CREATE TABLE public.server_members (
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

-- Channels with uuid
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Messages with uuid
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz
);

-- Invite codes with uuid
CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Friend requests (already using uuid from schema.sql)
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

-- Direct conversations
CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

-- Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Servers policies
CREATE POLICY "servers_select_members" ON public.servers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = servers.id AND m.user_id = auth.uid()));
CREATE POLICY "servers_insert" ON public.servers FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "servers_update_owner" ON public.servers FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "servers_delete_owner" ON public.servers FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Server members policies
CREATE POLICY "server_members_select" ON public.server_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = server_members.server_id AND m.user_id = auth.uid()));
CREATE POLICY "server_members_insert_authenticated" ON public.server_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "server_members_delete_self_or_admin" ON public.server_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.server_members sm
    WHERE sm.server_id = server_members.server_id AND sm.user_id = auth.uid() AND sm.role IN ('owner','admin')
  ));

-- Channels policies
CREATE POLICY "channels_select" ON public.channels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.server_members m WHERE m.server_id = channels.server_id AND m.user_id = auth.uid()));
CREATE POLICY "channels_insert" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.server_members m WHERE m.server_id = channels.server_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  ));
CREATE POLICY "channels_update" ON public.channels FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.server_members m WHERE m.server_id = channels.server_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  ));
CREATE POLICY "channels_delete" ON public.channels FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.server_members m WHERE m.server_id = channels.server_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  ));

-- Messages policies
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.server_members m ON m.server_id = c.server_id
    WHERE c.id = messages.channel_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.server_members m ON m.server_id = c.server_id
    WHERE c.id = messages.channel_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "messages_update_author" ON public.messages FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "messages_delete_author" ON public.messages FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Invite codes policies
CREATE POLICY "invite_codes_select_authenticated" ON public.invite_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "invite_codes_insert_owner_admin" ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.server_members m WHERE m.server_id = invite_codes.server_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  ));
CREATE POLICY "invite_codes_delete_owner" ON public.invite_codes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = invite_codes.server_id AND s.owner_id = auth.uid()));

-- Friend requests policies
CREATE POLICY "friend_requests_select" ON public.friend_requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "friend_requests_insert" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "friend_requests_update_to_user" ON public.friend_requests FOR UPDATE TO authenticated USING (to_user_id = auth.uid());

-- Direct conversations policies
CREATE POLICY "direct_conversations_select" ON public.direct_conversations FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
CREATE POLICY "direct_conversations_insert" ON public.direct_conversations FOR INSERT TO authenticated
  WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Direct messages policies
CREATE POLICY "direct_messages_select" ON public.direct_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id AND (dc.user_a_id = auth.uid() OR dc.user_b_id = auth.uid())
  ));
CREATE POLICY "direct_messages_insert" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id AND (dc.user_a_id = auth.uid() OR dc.user_b_id = auth.uid())
  ));
