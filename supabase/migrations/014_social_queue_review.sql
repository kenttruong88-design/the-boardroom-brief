-- Add AI review fields to social_queue
alter table public.social_queue
  add column if not exists review_score  numeric(4,1),
  add column if not exists review_passed boolean,
  add column if not exists review_notes  text;
