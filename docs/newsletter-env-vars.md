# Newsletter — Environment Variables

Required for the newsletter system to function in production.

## Vercel / .env.local

| Variable | Where to get it | Example |
|---|---|---|
| `RESEND_API_KEY` | resend.com → API Keys | `re_...` |
| `RESEND_WEBHOOK_SECRET` | resend.com → Webhooks → signing secret | `whsec_...` |
| `EDITOR_EMAIL` | Your email address | `you@yourdomain.com` |
| `NEXT_PUBLIC_SITE_URL` | Your production domain | `https://alignmenttimes.com` |
| `CRON_SECRET` | Generate with `openssl rand -hex 32` | `abc123...` |

`FROM_EMAIL` and `FROM_NAME` are hardcoded in the sender (`hello@alignmenttimes.com` / `The Alignment Times`). Update `app/lib/newsletter/sender.ts` if your sending address changes.

## Resend dashboard setup

### 1. Verify your sending domain

- Go to resend.com → Domains → Add Domain
- Add DNS records (MX, SPF, DKIM) at your DNS provider
- Wait for verification (usually under 30 minutes)

### 2. Create the webhook endpoint

- Go to resend.com → Webhooks → Add Endpoint
- URL: `https://yourdomain.com/api/newsletter/webhook`
- Copy the **signing secret** → set as `RESEND_WEBHOOK_SECRET`

### 3. Enable these webhook events

- `email.bounced`
- `email.complained`
- `email.opened`
- `email.clicked`
- `email.delivered`

## Supabase — required RPCs

The webhook handler calls three Postgres functions that must exist.
Run this migration in the Supabase SQL editor:

```sql
-- Increment a count column on newsletter_sends
create or replace function increment_send_count(p_send_id uuid, p_col text)
returns void language plpgsql security definer as $$
begin
  execute format(
    'update public.newsletter_sends set %I = %I + 1 where id = $1',
    p_col, p_col
  ) using p_send_id;
end;
$$;

-- Increment subscriber open count and update last_opened_at
create or replace function increment_subscriber_opens(p_email text, p_opened_at timestamptz)
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
create or replace function increment_subscriber_clicks(p_email text, p_clicked_at timestamptz)
returns void language plpgsql security definer as $$
begin
  update public.subscribers
  set
    emails_clicked  = emails_clicked + 1,
    last_clicked_at = p_clicked_at
  where email = p_email;
end;
$$;
```
