-- Add model column to claude_usage for per-model cost tracking
ALTER TABLE public.claude_usage
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514';
