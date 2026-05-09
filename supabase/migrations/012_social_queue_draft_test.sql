-- Add 'draft_test' status so test routes can insert rows that
-- the publisher cron will never pick up (it only reads 'pending').

ALTER TABLE public.social_queue
  DROP CONSTRAINT IF EXISTS social_queue_status_check;

ALTER TABLE public.social_queue
  ADD CONSTRAINT social_queue_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'draft_test'));
