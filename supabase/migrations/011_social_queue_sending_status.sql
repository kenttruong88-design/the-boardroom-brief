-- Add 'sending' as a valid status so the publisher cron can claim a row
-- before calling Buffer, preventing double-sends on overlapping cron runs.

ALTER TABLE public.social_queue
  DROP CONSTRAINT IF EXISTS social_queue_status_check;

ALTER TABLE public.social_queue
  ADD CONSTRAINT social_queue_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'));
