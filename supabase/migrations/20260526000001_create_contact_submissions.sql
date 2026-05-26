-- contact_submissions
-- Stores contact form messages for editorial and operational follow-up.
-- ip_hash is a truncated SHA-256 of the sender IP (+ salt) — used for
-- rate limiting only; never used for identification.

create table if not exists public.contact_submissions (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  email       text        not null,
  subject     text        not null,
  message     text        not null,
  ip_hash     text        not null default '',
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Only service-role may read/write — no public access
alter table public.contact_submissions enable row level security;

-- Index for rate-limit query (ip_hash + created_at range scan)
create index if not exists contact_submissions_ip_hash_created_at
  on public.contact_submissions (ip_hash, created_at desc);
