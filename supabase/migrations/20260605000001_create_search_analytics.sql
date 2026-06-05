-- search_analytics
-- Logs every search query made through /api/search.
-- Used by the editorial dashboard to surface top queries, zero-result gaps,
-- and daily volume trends. Also feeds the journalist agent topic-selector.

create table if not exists public.search_analytics (
  id            bigint      generated always as identity primary key,
  query         text        not null,
  result_count  integer     not null default 0,
  pillar_filter text,
  created_at    timestamptz not null default now()
);

-- Service-role only — no public read/write
alter table public.search_analytics enable row level security;

-- Fast range scans for the analytics dashboard (last N days)
create index if not exists search_analytics_created_at_idx
  on public.search_analytics (created_at desc);

-- Zero-result gap queries
create index if not exists search_analytics_zero_results_idx
  on public.search_analytics (result_count, created_at desc)
  where result_count = 0;

-- Top-query aggregation by normalised query text
create index if not exists search_analytics_query_idx
  on public.search_analytics (lower(query), created_at desc);
