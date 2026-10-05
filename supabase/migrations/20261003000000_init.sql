-- Legart schema: profiles, private user photos, attempts (recorded results), challenges, shares.
-- Run once on a fresh Supabase project (SQL editor, or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 32),
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'vi')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Player'), 32),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- private photos
create table if not exists public.user_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 60),
  storage_path text not null,
  width int,
  height int,
  aspect text not null default '1:1',
  focus_x real not null default 0.5,
  focus_y real not null default 0.5,
  created_at timestamptz not null default now()
);
create index if not exists user_images_owner_idx on public.user_images (owner_id, created_at desc);

-- ---------------------------------------------------------------- challenges
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_id uuid references auth.users (id) on delete cascade,
  source_kind text not null check (source_kind in ('library', 'image')),
  artwork_id text,
  image_path text,
  title jsonb not null,
  rows int not null,
  cols int not null,
  shape text not null check (shape in ('square', 'jigsaw')),
  mode text not null check (mode in ('easy', 'hard', 'expert')),
  preview text not null check (preview in ('always', 'hold', 'off')),
  seed bigint not null,
  mosaic jsonb not null,
  questions jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- attempts (recorded results)
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  guest_name text,
  challenge_id uuid references public.challenges (id) on delete set null,
  artwork_id text,
  source_kind text,
  title jsonb,
  pieces int not null,
  rows int not null,
  cols int not null,
  shape text not null check (shape in ('square', 'jigsaw')),
  mode text not null check (mode in ('easy', 'hard', 'expert')),
  preview text not null check (preview in ('always', 'hold', 'off')),
  seed bigint not null,
  server_started_at timestamptz not null default now(),
  server_finished_at timestamptz,
  duration_ms int,
  penalty_ms int,
  total_ms int,
  moves int,
  peeks int,
  hints int,
  quiz_correct int,
  quiz_total int,
  score int,
  status text not null default 'started' check (status in ('started', 'ranked', 'unranked', 'flagged')),
  flag_reason text,
  -- id of the record in the browser, used to avoid duplicate imports of guest history
  client_id text,
  created_at timestamptz not null default now(),
  constraint attempts_user_client_unique unique (user_id, client_id)
);
create index if not exists attempts_board_idx on public.attempts (artwork_id, pieces, shape, mode, preview, status, total_ms);
create index if not exists attempts_challenge_idx on public.attempts (challenge_id, status, total_ms);
create index if not exists attempts_user_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_started_idx on public.attempts (status, created_at) where status = 'started';

-- ---------------------------------------------------------------- shares
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  image_path text not null,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row level security
-- The browser uses the anon key and only needs: own profile, own photos, public challenge/share reads.
-- Attempts, challenges and shares are written by the Next.js server with the service-role key.
alter table public.profiles enable row level security;
alter table public.user_images enable row level security;
alter table public.challenges enable row level security;
alter table public.attempts enable row level security;
alter table public.shares enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles for select using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own images" on public.user_images;
create policy "own images" on public.user_images for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "challenges are public" on public.challenges;
create policy "challenges are public" on public.challenges for select using (true);

drop policy if exists "own attempts" on public.attempts;
create policy "own attempts" on public.attempts for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "shares are public" on public.shares;
create policy "shares are public" on public.shares for select using (true);

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-images', 'user-images', false, 10485760, array['image/jpeg']),
  ('public-images', 'public-images', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- user-images/<user id>/<image id>.jpg — only the owner can read or write
drop policy if exists "user images: read own" on storage.objects;
create policy "user images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "user images: upload own" on storage.objects;
create policy "user images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "user images: delete own" on storage.objects;
create policy "user images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- public-images is written only by the server (service role) and is readable through its public URL.

-- ---------------------------------------------------------------- housekeeping
-- Attempts opened but never finished are useless after a day. Call this from a cron job (see DEPLOY.md).
create or replace function public.cleanup_stale_attempts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.attempts where status = 'started' and created_at < now() - interval '1 day';
$$;
revoke execute on function public.cleanup_stale_attempts() from public, anon, authenticated;
