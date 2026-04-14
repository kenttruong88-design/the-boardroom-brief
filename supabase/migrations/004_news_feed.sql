-- ─────────────────────────────────────────────────────────────────────────────
-- news_feed — incoming stories for the AI newsroom pipeline
-- news_intel_runs — audit log for each intel fetch run
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.news_feed (
  id               uuid default gen_random_uuid() primary key,
  headline         text not null,
  summary          text not null,
  url              text,
  source_name      text,
  pillar           text not null,
  region           text not null,
  countries        text[] default '{}',
  market_symbols   text[] default '{}',
  relevance_score  numeric default 0,
  satirical_score  numeric default 0,
  headline_hash    text unique,
  used_by_agent    text,
  used_at          timestamptz,
  fetched_at       timestamptz default now(),
  expires_at       timestamptz default now() + interval '48 hours'
);

create index if not exists news_feed_pillar_relevance_idx
  on public.news_feed (pillar, relevance_score desc);

create index if not exists news_feed_fetched_idx
  on public.news_feed (fetched_at desc);

create index if not exists news_feed_hash_idx
  on public.news_feed (headline_hash);

create index if not exists news_feed_expires_idx
  on public.news_feed (expires_at);

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.news_intel_runs (
  id                 bigserial primary key,
  ran_at             timestamptz not null default now(),
  stories_found      int not null default 0,
  stories_stored     int not null default 0,
  duplicates_skipped int not null default 0,
  searches_run       int not null default 0,
  duration_ms        int,
  errors             jsonb not null default '[]'::jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — service role only for both tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.news_feed       enable row level security;
alter table public.news_intel_runs enable row level security;

drop policy if exists "Service role only" on public.news_feed;
create policy "Service role only"
  on public.news_feed for all
  using (false)
  with check (false);

drop policy if exists "Service role only" on public.news_intel_runs;
create policy "Service role only"
  on public.news_intel_runs for all
  using (false)
  with check (false);
