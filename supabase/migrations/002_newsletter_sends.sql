-- Run in Supabase SQL Editor after 001_initial_schema.sql

create table if not exists public.newsletter_sends (
  id               bigserial primary key,
  sent_at          timestamptz not null default now(),
  article_ids      text[],
  subscriber_count integer not null default 0,
  success_count    integer not null default 0,
  failure_count    integer not null default 0
);

-- Only service role / admin can read/write send logs
alter table public.newsletter_sends enable row level security;

create policy "Service role only"
  on public.newsletter_sends
  using (false);
