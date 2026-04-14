-- ─────────────────────────────────────────────────────────────────────────────
-- pipeline_jobs — tracks manual and cron pipeline runs with live progress
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pipeline_jobs (
  id                uuid         default gen_random_uuid() primary key,
  triggered_by      text         default 'manual',   -- 'manual' | 'cron'
  status            text         default 'pending',  -- pending | running | complete | failed | cancelled
  progress          jsonb        default '{}',       -- per-stage progress object
  log               text[]       default '{}',       -- timestamped log lines
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       int,
  articles_written  int          default 0,
  articles_passed   int          default 0,
  articles_rejected int          default 0,
  error             text,
  created_at        timestamptz  default now()
);

create index if not exists pipeline_jobs_status_idx
  on public.pipeline_jobs (status, created_at desc);

create index if not exists pipeline_jobs_created_idx
  on public.pipeline_jobs (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — service role only
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pipeline_jobs enable row level security;

drop policy if exists "Service role only" on public.pipeline_jobs;
create policy "Service role only"
  on public.pipeline_jobs for all
  using (false)
  with check (false);
