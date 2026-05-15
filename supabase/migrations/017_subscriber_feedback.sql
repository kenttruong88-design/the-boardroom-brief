create table if not exists public.subscriber_feedback (
  id         uuid default gen_random_uuid() primary key,
  email      text,
  message    text not null,
  source     text default 'unsubscribed',
  created_at timestamptz default now()
);

alter table public.subscriber_feedback enable row level security;

create policy "Service role only"
  on public.subscriber_feedback
  using (false);
