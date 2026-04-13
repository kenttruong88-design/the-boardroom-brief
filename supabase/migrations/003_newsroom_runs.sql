-- ─────────────────────────────────────────────────────────────────────────────
-- newsroom_runs — audit log of every agent pipeline execution
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.newsroom_runs (
  id                      bigserial primary key,
  date                    text not null,                    -- YYYY-MM-DD
  agents_triggered        int not null default 0,
  total_articles_written  int not null default 0,
  passed_review           int not null default 0,
  failed_review           int not null default 0,
  digest_sent_at          timestamptz,
  total_duration_ms       int,
  errors                  jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now()
);

alter table public.newsroom_runs enable row level security;

-- Service role only — no public access
drop policy if exists "Service role only" on public.newsroom_runs;
create policy "Service role only"
  on public.newsroom_runs for all
  using (false)
  with check (false);
