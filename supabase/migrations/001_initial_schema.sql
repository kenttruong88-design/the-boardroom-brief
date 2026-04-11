-- ─────────────────────────────────────────────────────────────────────────────
-- The Alignment Times — Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. profiles — extends Supabase auth.users
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text,
  plan            text not null default 'free',
  country_code    text,
  created_at      timestamptz not null default now()
);

-- 2. subscribers — newsletter signups (independent of auth)
create table if not exists public.subscribers (
  id                  bigserial primary key,
  email               text unique not null,
  confirmed           boolean not null default false,
  confirmation_token  text unique,
  plan                text not null default 'free',
  segments            text[],
  source              text,
  subscribed_at       timestamptz not null default now(),
  unsubscribed_at     timestamptz
);

-- 3. article_views — reading analytics
create table if not exists public.article_views (
  id                bigserial primary key,
  article_sanity_id text not null,
  user_id           uuid references public.profiles(id) on delete set null,
  session_id        text,
  read_pct          integer check (read_pct between 0 and 100),
  created_at        timestamptz not null default now()
);

-- 4. market_cache — cached market data
create table if not exists public.market_cache (
  id          bigserial primary key,
  symbol      text not null,
  name        text,
  price       numeric,
  change_pct  numeric,
  economy_id  text,
  pulled_at   timestamptz not null default now()
);

create unique index if not exists market_cache_symbol_idx on public.market_cache(symbol);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.subscribers    enable row level security;
alter table public.article_views  enable row level security;
alter table public.market_cache   enable row level security;

-- profiles: users can read and update only their own row
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- subscribers: anyone can insert (signup form); users can read their own row
create policy "Anyone can subscribe"
  on public.subscribers for insert
  with check (true);

create policy "Subscribers can view own record"
  on public.subscribers for select
  using (email = (select email from auth.users where id = auth.uid()));

-- article_views: users can insert their own views; read own views
create policy "Users can log article views"
  on public.article_views for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can view own article views"
  on public.article_views for select
  using (auth.uid() = user_id);

-- market_cache: public read, no direct user writes
create policy "Public can read market cache"
  on public.market_cache for select
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: auto-create profile on new user signup
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
