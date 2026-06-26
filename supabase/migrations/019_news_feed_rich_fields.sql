-- 019_news_feed_rich_fields.sql
-- Adds richer extraction fields to news_feed so journalists have
-- concrete facts, quotes, and angles to write from.

ALTER TABLE news_feed
  ADD COLUMN IF NOT EXISTS key_facts    jsonb,        -- string[] of specific facts/numbers
  ADD COLUMN IF NOT EXISTS notable_quote text,         -- direct quote from the story, if any
  ADD COLUMN IF NOT EXISTS suggested_angle text;       -- editorial angle suggested by intel agent
