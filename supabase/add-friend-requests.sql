-- Run this in Supabase SQL Editor if you already have the OG tables but NOT friend_requests.

-- Friend requests table
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references auth.users(id) on delete cascade,
  to_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique(from_user_id, to_user_id)
);

alter table public.friend_requests enable row level security;

create policy "friend_requests_select" on public.friend_requests for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "friend_requests_insert" on public.friend_requests for insert to authenticated with check (from_user_id = auth.uid());
create policy "friend_requests_update_to_user" on public.friend_requests for update to authenticated using (to_user_id = auth.uid());
