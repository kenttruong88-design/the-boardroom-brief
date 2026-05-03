-- ── 008_comment_features.sql ─────────────────────────────────────────────────
-- notification preferences + engagement counts

-- User notification preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_on_replies BOOLEAN NOT NULL DEFAULT TRUE;

-- Cached comment counts per article — used for "Most discussed" engagement sort
CREATE TABLE IF NOT EXISTS article_comment_counts (
  article_id  TEXT        PRIMARY KEY,
  count       INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: public read, no writes (service role only via function)
ALTER TABLE article_comment_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acc_select"
  ON article_comment_counts FOR SELECT
  USING (true);

-- Nightly refresh function — upserts live counts into the cache table
CREATE OR REPLACE FUNCTION refresh_article_comment_counts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO article_comment_counts (article_id, count, updated_at)
  SELECT
    article_id,
    COUNT(*)::integer,
    NOW()
  FROM comments
  WHERE status = 'approved'
    AND deleted_at IS NULL
  GROUP BY article_id
  ON CONFLICT (article_id) DO UPDATE SET
    count      = EXCLUDED.count,
    updated_at = EXCLUDED.updated_at;
END;
$$;
