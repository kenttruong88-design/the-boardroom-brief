-- Atomic increment helpers used by the Resend webhook handler.
-- These run as security definer so the service role can call them
-- without needing direct update access from the API layer.

-- Increment a named count column on newsletter_sends
create or replace function public.increment_send_count(p_send_id uuid, p_col text)
returns void language plpgsql security definer as $$
begin
  execute format(
    'update public.newsletter_sends set %I = %I + 1 where id = $1',
    p_col, p_col
  ) using p_send_id;
end;
$$;

-- Increment subscriber open count and update last_opened_at
create or replace function public.increment_subscriber_opens(p_email text, p_opened_at timestamptz)
returns void language plpgsql security definer as $$
begin
  update public.subscribers
  set
    emails_opened  = emails_opened + 1,
    last_opened_at = p_opened_at
  where email = p_email;
end;
$$;

-- Increment subscriber click count and update last_clicked_at
create or replace function public.increment_subscriber_clicks(p_email text, p_clicked_at timestamptz)
returns void language plpgsql security definer as $$
begin
  update public.subscribers
  set
    emails_clicked  = emails_clicked + 1,
    last_clicked_at = p_clicked_at
  where email = p_email;
end;
$$;
