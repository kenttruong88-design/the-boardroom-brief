-- Run in Supabase SQL Editor

create table if not exists public.claude_usage (
  id              bigserial primary key,
  called_from     text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  estimated_cost  numeric(10, 6) not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.claude_usage enable row level security;

-- Service role only
create policy "Service role only"
  on public.claude_usage
  using (false);
