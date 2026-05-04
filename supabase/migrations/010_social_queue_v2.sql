-- Social media automation tables (v2)
-- Replaces the minimal social_queue from 004_social_queue.sql

-- Drop old table (safe: no FK references to it)
drop table if exists public.social_queue cascade;

-- ─────────────────────────────────────────────
-- 1. social_queue
-- ─────────────────────────────────────────────
create table public.social_queue (
  id                uuid default gen_random_uuid() primary key,
  article_id        text not null,
  article_slug      text not null,
  article_headline  text not null,
  platform          text not null check (platform in ('linkedin', 'twitter', 'instagram')),
  content           text not null,
  hashtags          text[] default '{}',
  image_url         text,
  article_url       text not null,
  scheduled_for     timestamptz not null,
  status            text default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  buffer_post_id    text,
  platform_post_id  text,
  sent_at           timestamptz,
  error             text,

  -- Analytics (populated 24 hrs after posting)
  impressions       int default 0,
  likes             int default 0,
  comments          int default 0,
  shares            int default 0,
  clicks            int default 0,
  analytics_fetched_at timestamptz,

  -- Meta
  generated_by      text default 'auto' check (generated_by in ('auto', 'manual')),
  pillar            text,
  created_at        timestamptz default now()
);

create index on public.social_queue (scheduled_for, status);
create index on public.social_queue (article_id);
create index on public.social_queue (platform, status);
create index on public.social_queue (status) where status = 'pending';

alter table public.social_queue enable row level security;
create policy "Service role only" on public.social_queue using (false);

-- ─────────────────────────────────────────────
-- 2. social_runs
-- ─────────────────────────────────────────────
create table public.social_runs (
  id              uuid default gen_random_uuid() primary key,
  ran_at          timestamptz default now(),
  trigger         text default 'cron' check (trigger in ('cron', 'manual')),
  articles_found  int default 0,
  posts_generated int default 0,
  posts_queued    int default 0,
  posts_sent      int default 0,
  errors          jsonb default '[]',
  duration_ms     int
);

alter table public.social_runs enable row level security;
create policy "Service role only" on public.social_runs using (false);

-- ─────────────────────────────────────────────
-- 3. social_analytics_log
-- ─────────────────────────────────────────────
create table public.social_analytics_log (
  id              uuid default gen_random_uuid() primary key,
  queue_id        uuid references public.social_queue(id),
  platform        text,
  fetched_at      timestamptz default now(),
  impressions     int,
  likes           int,
  comments        int,
  shares          int,
  clicks          int,
  engagement_rate numeric
);

alter table public.social_analytics_log enable row level security;
create policy "Service role only" on public.social_analytics_log using (false);
