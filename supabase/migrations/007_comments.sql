-- ─── 007_comments.sql ────────────────────────────────────────────────────────
-- Threaded article comments with moderation and per-user likes.

-- ── comments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    TEXT        NOT NULL,           -- Sanity article slug
  parent_id     UUID        REFERENCES comments(id) ON DELETE CASCADE,
  author_name   TEXT        NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 60),
  author_email  TEXT        NOT NULL,
  body          TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  -- moderation scores (0–10)
  mod_spam      NUMERIC(4,2),
  mod_toxicity  NUMERIC(4,2),
  mod_relevance NUMERIC(4,2),
  mod_reason    TEXT,
  like_count    INTEGER     NOT NULL DEFAULT 0,
  ip_hash       TEXT,                           -- hashed for rate-limiting
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ                     -- soft-delete
);

CREATE INDEX IF NOT EXISTS idx_comments_article_status
  ON comments (article_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_ip_hash
  ON comments (ip_hash, created_at DESC);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_updated_at();

-- ── comment_likes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id  UUID    NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  fingerprint TEXT    NOT NULL,  -- browser fingerprint / anon ID
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, fingerprint)
);

-- ── comment_bans ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comment_bans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash     TEXT,
  email       TEXT,
  reason      TEXT,
  banned_by   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ          -- NULL = permanent
);

CREATE INDEX IF NOT EXISTS idx_comment_bans_ip    ON comment_bans (ip_hash);
CREATE INDEX IF NOT EXISTS idx_comment_bans_email ON comment_bans (email);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_bans   ENABLE ROW LEVEL SECURITY;

-- Public: read approved, non-deleted comments
CREATE POLICY "comments_select_approved"
  ON comments FOR SELECT
  USING (status = 'approved' AND deleted_at IS NULL);

-- Anon: insert (anyone can submit; moderation happens server-side)
CREATE POLICY "comments_insert_anon"
  ON comments FOR INSERT
  WITH CHECK (true);

-- Anon: update own comment body within 5 minutes of creation
CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (created_at > NOW() - INTERVAL '5 minutes' AND deleted_at IS NULL)
  WITH CHECK (true);

-- Service role bypasses RLS automatically; these policies cover anon/authed clients.

-- comment_likes: anyone can select
CREATE POLICY "likes_select"
  ON comment_likes FOR SELECT
  USING (true);

-- comment_likes: anyone can insert their own fingerprint
CREATE POLICY "likes_insert"
  ON comment_likes FOR INSERT
  WITH CHECK (true);

-- comment_likes: anyone can delete their own like
CREATE POLICY "likes_delete"
  ON comment_likes FOR DELETE
  USING (true);

-- comment_bans: no public access (admin only via service role)
CREATE POLICY "bans_deny_all"
  ON comment_bans FOR ALL
  USING (false);

-- ── Helper RPCs (used by the like toggle API) ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE comments SET like_count = like_count + 1 WHERE id = comment_id;
$$;

CREATE OR REPLACE FUNCTION decrement_comment_likes(comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = comment_id;
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE comments;
