-- Single-row settings table for the social media pipeline
create table if not exists public.social_settings (
  id                int primary key default 1 check (id = 1),
  auto_post_enabled boolean not null default false,
  updated_at        timestamptz default now()
);

-- Seed the one row
insert into public.social_settings (id, auto_post_enabled)
values (1, false)
on conflict do nothing;

alter table public.social_settings enable row level security;
create policy "Service role only" on public.social_settings
  for all using (false) with check (false);
