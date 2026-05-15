# Newsletter — Pre-deployment Checklist

Work through this top to bottom before sending to real subscribers.

## Infrastructure

- [ ] Resend domain verified — DNS records added and propagated
- [ ] `FROM_EMAIL` set to verified domain address in sender.ts
- [ ] Resend webhook endpoint created, pointing to `/api/newsletter/webhook`
- [ ] `RESEND_WEBHOOK_SECRET` set in Vercel environment variables
- [ ] `RESEND_API_KEY` set in Vercel environment variables
- [ ] `CRON_SECRET` set in Vercel environment variables
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain (no trailing slash)
- [ ] `EDITOR_EMAIL` set for test sends
- [ ] Supabase RPC functions deployed (see newsletter-env-vars.md)

## End-to-end flow tests

- [ ] Subscribe with a real email → confirmation email arrives
- [ ] Click confirmation link → redirected to `/welcome?subscribed=true`
- [ ] Welcome email arrives after confirmation
- [ ] Preferences page loads at `/preferences?token=<unsubscribe_token>`
- [ ] Unsubscribe link works — subscriber status updates to `unsubscribed`
- [ ] Subscriber shows as `confirmed` in the newsletter dashboard

## Test send

- [ ] Send test Morning Brief via `/test` dashboard → email arrives
- [ ] Email renders correctly in Gmail
- [ ] Email renders correctly in Apple Mail
- [ ] Check spam score at mail-tester.com — target 9+/10
- [ ] All article links resolve (no 404s)
- [ ] Unsubscribe link is present and working
- [ ] Preferences link is present and working

## CAN-SPAM / GDPR

- [ ] Every outbound email contains the unsubscribe link
- [ ] Physical mailing address in email footer (required by CAN-SPAM)
- [ ] Privacy policy page exists and is linked from emails
- [ ] Subscription is double opt-in — confirmed ✓

## Cron

- [ ] Vercel cron enabled on your plan (Pro or above)
- [ ] `vercel.json` has `"30 7 * * *" → /api/newsletter/send`
- [ ] CRON_SECRET matches the `Authorization: Bearer` check in the send route
- [ ] Test the cron manually via `GET /api/newsletter/send` with the secret header

## Analytics

- [ ] Webhook events appearing in Resend dashboard after a test send
- [ ] Open count incrementing in newsletter analytics dashboard after open
- [ ] Bounce handling tested (use a known-bad address, verify status updates)
