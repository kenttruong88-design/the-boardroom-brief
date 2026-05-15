-- Newsletter schema v2: full subscriber lifecycle + per-send tracking
-- Drops the old thin subscribers and newsletter_sends tables and replaces them.

drop table if exists public.newsletter_sends cascade;
drop table if exists public.subscribers cascade;

-- ── 1. subscribers ────────────────────────────────────────────────────────────
create table public.subscribers (
  id                   uuid default gen_random_uuid() primary key,
  email                text unique not null,
  first_name           text,
  status               text default 'pending',
                       -- pending | confirmed | unsubscribed | bounced | complained
  confirmation_token   text unique,
  confirmation_sent_at timestamptz,
  confirmed_at         timestamptz,
  unsubscribed_at      timestamptz,
  unsubscribe_token    text unique default gen_random_uuid()::text,

  -- Preferences
  segments             text[] default '{all}',
                       -- all | markets-floor | macro-mondays |
                       --  c-suite-circus | global-office | water-cooler
  economies            text[] default '{}',
  frequency            text default 'daily',  -- daily | weekly

  -- Source tracking
  source               text default 'website',
                       -- website | article | api | import
  source_article_slug  text,
  ip_hash              text,

  -- Stats
  emails_sent          int default 0,
  emails_opened        int default 0,
  emails_clicked       int default 0,
  last_opened_at       timestamptz,
  last_clicked_at      timestamptz,

  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create index on public.subscribers (status);
create index on public.subscribers (confirmation_token);
create index on public.subscribers (unsubscribe_token);
create index on public.subscribers (created_at desc);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscribers_updated_at
  before update on public.subscribers
  for each row execute procedure public.set_updated_at();

-- ── 2. newsletter_sends ───────────────────────────────────────────────────────
create table public.newsletter_sends (
  id                uuid default gen_random_uuid() primary key,
  send_date         date unique not null,
  subject           text,
  articles_included text[],                  -- Sanity article IDs
  subscriber_count  int default 0,
  sent_count        int default 0,
  failed_count      int default 0,
  open_count        int default 0,
  click_count       int default 0,
  unsubscribe_count int default 0,
  bounce_count      int default 0,
  resend_batch_ids  text[] default '{}',     -- Resend batch IDs
  status            text default 'pending',  -- pending | sending | sent | failed
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       int,
  error             text,
  created_at        timestamptz default now()
);

-- ── 3. newsletter_send_log ────────────────────────────────────────────────────
create table public.newsletter_send_log (
  id              uuid default gen_random_uuid() primary key,
  send_id         uuid references public.newsletter_sends(id),
  subscriber_id   uuid references public.subscribers(id),
  email           text not null,
  resend_email_id text,                      -- returned by Resend
  status          text default 'sent',       -- sent | bounced | complained
  opened_at       timestamptz,
  first_click_at  timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz default now()
);

create index on public.newsletter_send_log (send_id);
create index on public.newsletter_send_log (subscriber_id);
create index on public.newsletter_send_log (resend_email_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.subscribers        enable row level security;
alter table public.newsletter_sends   enable row level security;
alter table public.newsletter_send_log enable row level security;

-- Public insert so the signup form works without auth
create policy "Anyone can subscribe"
  on public.subscribers for insert
  with check (true);

-- Send logs are internal only
create policy "Service role only"
  on public.newsletter_sends
  using (false);

create policy "Service role only"
  on public.newsletter_send_log
  using (false);
