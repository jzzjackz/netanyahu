-- Run this in Supabase SQL Editor to create all tables and RLS.

-- Profiles (one per auth user, created on signup or first login)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  status text default 'offline' check (status in ('online','offline','idle','dnd')),
  created_at timestamptz default now()
);

-- Servers (guilds)
create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  icon_url text,
  created_at timestamptz default now()
);

-- Server membership
create type public.server_role as enum ('owner', 'admin', 'mod', 'member');

create table if not exists public.server_members (
  server_id uuid references public.servers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.server_role not null default 'member',
  joined_at timestamptz default now(),
  primary key (server_id, user_id)
);

-- Channels
create type public.channel_type as enum ('text', 'voice');

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers(id) on delete cascade,
  name text not null,
  type public.channel_type not null default 'text',
  position int not null default 0,
  created_at timestamptz default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now(),
  edited_at timestamptz
);

-- Friend requests (add friend by username → lookup profile → create request)
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references auth.users(id) on delete cascade,
  to_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique(from_user_id, to_user_id)
);

-- Direct conversations (between two users, for DMs)
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid references auth.users(id) on delete cascade,
  user_b_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);

-- Direct messages
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now(),
  edited_at timestamptz
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.friend_requests enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

-- Profiles: anyone authenticated can read (for username search); users can update own
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Servers: members can read; authenticated can create; owner can update/delete
create policy "servers_select_members" on public.servers for select to authenticated
  using (exists (select 1 from public.server_members m where m.server_id = servers.id and m.user_id = auth.uid()));
create policy "servers_insert" on public.servers for insert to authenticated with check (auth.uid() = owner_id);
create policy "servers_update_owner" on public.servers for update to authenticated using (auth.uid() = owner_id);
create policy "servers_delete_owner" on public.servers for delete to authenticated using (auth.uid() = owner_id);

-- Server members: members can read; owner/admin can insert; owner can delete
create policy "server_members_select" on public.server_members for select to authenticated
  using (exists (select 1 from public.server_members m where m.server_id = server_members.server_id and m.user_id = auth.uid()));
create policy "server_members_insert_owner_admin" on public.server_members for insert to authenticated
  with check (
    exists (
      select 1 from public.server_members sm
      where sm.server_id = server_members.server_id and sm.user_id = auth.uid() and sm.role in ('owner','admin')
    )
    or (
      not exists (select 1 from public.server_members sm2 where sm2.server_id = server_members.server_id)
      and exists (select 1 from public.servers s where s.id = server_members.server_id and s.owner_id = auth.uid())
    )
  );
create policy "server_members_delete_self_or_admin" on public.server_members for delete to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.server_members sm
    where sm.server_id = server_members.server_id and sm.user_id = auth.uid() and sm.role in ('owner','admin')
  ));

-- Channels: server members can read; owner/admin can insert/update/delete
create policy "channels_select" on public.channels for select to authenticated
  using (exists (select 1 from public.server_members m where m.server_id = channels.server_id and m.user_id = auth.uid()));
create policy "channels_insert" on public.channels for insert to authenticated
  with check (exists (
    select 1 from public.server_members m where m.server_id = channels.server_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  ));
create policy "channels_update" on public.channels for update to authenticated
  using (exists (
    select 1 from public.server_members m where m.server_id = channels.server_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  ));
create policy "channels_delete" on public.channels for delete to authenticated
  using (exists (
    select 1 from public.server_members m where m.server_id = channels.server_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  ));

-- Messages: channel members can read/insert
create policy "messages_select" on public.messages for select to authenticated
  using (exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = messages.channel_id and m.user_id = auth.uid()
  ));
create policy "messages_insert" on public.messages for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from public.channels c
    join public.server_members m on m.server_id = c.server_id
    where c.id = messages.channel_id and m.user_id = auth.uid()
  ));
create policy "messages_update_author" on public.messages for update to authenticated using (author_id = auth.uid());
create policy "messages_delete_author" on public.messages for delete to authenticated using (author_id = auth.uid());

-- Friend requests: participants can read; authenticated can create (from_user = self)
create policy "friend_requests_select" on public.friend_requests for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "friend_requests_insert" on public.friend_requests for insert to authenticated with check (from_user_id = auth.uid());
create policy "friend_requests_update_to_user" on public.friend_requests for update to authenticated using (to_user_id = auth.uid());

-- Direct conversations: participants can read; authenticated can insert (if both are friends we allow)
create policy "direct_conversations_select" on public.direct_conversations for select to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid());
create policy "direct_conversations_insert" on public.direct_conversations for insert to authenticated
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

-- Direct messages: conversation participants can read/insert
create policy "direct_messages_select" on public.direct_messages for select to authenticated
  using (exists (
    select 1 from public.direct_conversations dc
    where dc.id = direct_messages.conversation_id and (dc.user_a_id = auth.uid() or dc.user_b_id = auth.uid())
  ));
create policy "direct_messages_insert" on public.direct_messages for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from public.direct_conversations dc
    where dc.id = direct_messages.conversation_id and (dc.user_a_id = auth.uid() or dc.user_b_id = auth.uid())
  ));

-- Realtime: In Supabase Dashboard go to Database > Replication. Add "messages" and "direct_messages"
-- to the publication so realtime subscriptions work for new messages.
