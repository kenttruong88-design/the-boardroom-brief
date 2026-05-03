-- ── 007b_comments_repair.sql ─────────────────────────────────────────────────
-- The comments table already existed in Supabase before 007_comments.sql ran,
-- so CREATE TABLE IF NOT EXISTS was a no-op. This migration adds all the columns
-- our application expects. Safe to run multiple times (IF NOT EXISTS guards).

-- Core comment fields
ALTER TABLE comments ADD COLUMN IF NOT EXISTS article_id    TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name   TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_email  TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS body          TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- AI moderation scores
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mod_spam      NUMERIC(4,2);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mod_toxicity  NUMERIC(4,2);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mod_relevance NUMERIC(4,2);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mod_reason    TEXT;

-- Engagement + metadata
ALTER TABLE comments ADD COLUMN IF NOT EXISTS like_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS ip_hash       TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Timestamps (add if missing — some table variants only have created_at)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_article_status
  ON comments (article_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_ip_hash
  ON comments (ip_hash, created_at DESC);

-- Auto-update trigger (idempotent)
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_updated_at();

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_approved" ON comments;
CREATE POLICY "comments_select_approved"
  ON comments FOR SELECT
  USING (status = 'approved' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "comments_insert_anon" ON comments;
CREATE POLICY "comments_insert_anon"
  ON comments FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (created_at > NOW() - INTERVAL '5 minutes' AND deleted_at IS NULL)
  WITH CHECK (true);

-- comment_likes table (create if missing)
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id  UUID    NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  fingerprint TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, fingerprint)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select"  ON comment_likes;
DROP POLICY IF EXISTS "likes_insert"  ON comment_likes;
DROP POLICY IF EXISTS "likes_delete"  ON comment_likes;

CREATE POLICY "likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON comment_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "likes_delete" ON comment_likes FOR DELETE USING (true);

-- comment_bans table (create if missing)
CREATE TABLE IF NOT EXISTS comment_bans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash     TEXT,
  email       TEXT,
  reason      TEXT,
  banned_by   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comment_bans_ip    ON comment_bans (ip_hash);
CREATE INDEX IF NOT EXISTS idx_comment_bans_email ON comment_bans (email);

ALTER TABLE comment_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bans_deny_all" ON comment_bans;
CREATE POLICY "bans_deny_all" ON comment_bans FOR ALL USING (false);

-- Like count RPCs
CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE comments SET like_count = like_count + 1 WHERE id = comment_id;
$$;

CREATE OR REPLACE FUNCTION decrement_comment_likes(comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = comment_id;
$$;

-- Realtime (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
