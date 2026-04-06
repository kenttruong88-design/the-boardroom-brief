-- Run in Supabase SQL Editor

create table if not exists public.social_queue (
  id              bigserial primary key,
  article_id      text not null,
  platform        text not null check (platform in ('linkedin', 'twitter')),
  content         text not null,
  scheduled_for   timestamptz,
  posted_at       timestamptz,
  buffer_post_id  text,
  created_at      timestamptz not null default now()
);

alter table public.social_queue enable row level security;

create policy "Service role only"
  on public.social_queue
  using (false);

create index if not exists social_queue_scheduled_idx on public.social_queue(scheduled_for);
create index if not exists social_queue_article_idx   on public.social_queue(article_id);
