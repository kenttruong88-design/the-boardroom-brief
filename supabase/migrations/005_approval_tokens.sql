-- ─────────────────────────────────────────────────────────────────────────────
-- approval_tokens — one-click email approval without login
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.approval_tokens (
  id          bigserial primary key,
  article_id  text not null,       -- string index "0", "1", etc.
  digest_date text not null,       -- YYYY-MM-DD
  token       text unique not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists approval_tokens_token_idx on public.approval_tokens (token);
create index if not exists approval_tokens_expires_idx on public.approval_tokens (expires_at);

alter table public.approval_tokens enable row level security;

drop policy if exists "Service role only" on public.approval_tokens;
create policy "Service role only"
  on public.approval_tokens for all
  using (false)
  with check (false);
