-- ─────────────────────────────────────────────────────────────────────────────
-- daily_digest — AI-generated editorial digest, one row per day
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.daily_digest (
  id                bigserial primary key,
  date              text not null unique,           -- YYYY-MM-DD
  digest_json       jsonb not null,                 -- full DailyDigest object
  email_sent_at     timestamptz,                    -- null until email is sent
  articles_approved int not null default 0,
  articles_rejected int not null default 0,
  created_at        timestamptz not null default now()
);

alter table public.daily_digest enable row level security;

-- No public access — only service role (admin client) can read/write
drop policy if exists "Service role only" on public.daily_digest;
create policy "Service role only"
  on public.daily_digest for all
  using (false)
  with check (false);
