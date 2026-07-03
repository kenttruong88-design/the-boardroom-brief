-- 020_newsletter_send_log_dedup.sql
-- Prevents duplicate delivery records for the same subscriber within a
-- single newsletter send, so a retried/forced send can't double-log
-- (or double-count) a recipient who already succeeded.

create unique index if not exists newsletter_send_log_send_subscriber_uniq
  on public.newsletter_send_log (send_id, subscriber_id);
