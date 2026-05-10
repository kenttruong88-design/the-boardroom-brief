-- Add 'pending_approval' status so auto-generated posts require human
-- approval before the publish cron can pick them up.

ALTER TABLE public.social_queue
  DROP CONSTRAINT IF EXISTS social_queue_status_check;

ALTER TABLE public.social_queue
  ADD CONSTRAINT social_queue_status_check
  CHECK (status IN ('pending_approval', 'pending', 'sending', 'sent', 'failed', 'cancelled', 'draft_test'));
