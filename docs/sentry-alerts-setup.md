# Sentry Alerts Setup

After deploying, configure these alert rules at sentry.io → Alerts → Create Alert.

## Alert Rules

### RULE 1 — Critical error spike
- **Condition:** Error count > 10 in 5 minutes
- **Action:** Email + Slack (#boardroom-brief-alerts)
- **Priority:** Critical

### RULE 2 — New issue type
- **Condition:** New issue created
- **Action:** Email
- **Priority:** High

### RULE 3 — Cron job missed
- Automatically created when cron monitors first check in.
- **Condition:** Monitor misses check-in
- **Action:** Email immediately
- **Priority:** Critical

### RULE 4 — Performance degradation
- **Condition:** p95 response time > 3000 ms for 10 minutes
- **Action:** Email
- **Priority:** Medium

### RULE 5 — Newsletter send failure
- **Tag filter:** `service = resend`
- **Condition:** Any error
- **Action:** Email immediately
- **Priority:** Critical

---

## Cron Monitors

These are registered automatically on first check-in. Verify at sentry.io → Crons:

| Monitor slug | Schedule | Grace | Max runtime |
|---|---|---|---|
| `newsletter-morning-brief` | `30 7 * * *` | 10 min | 30 min |
| `newsroom-daily-run` | `0 4 * * *` | 10 min | 90 min |
| `market-data-sync` | `*/15 8-18 * * 1-5` | 3 min | 5 min |
| `update-comment-counts` | `0 2 * * *` | 10 min | 5 min |

---

## Uptime Monitoring

Go to Sentry → Crons → Uptime → Add monitor:
- **URL:** `https://alignmenttimes.com/api/health`
- **Interval:** 5 minutes

---

## Slack Integration (recommended)

1. Sentry → Settings → Integrations → Slack
2. Connect workspace
3. Create a `#boardroom-brief-alerts` channel
4. Route Critical and High rules to that channel

---

## Verifying Source Maps

After the first production deploy:
1. Trigger the test error: `GET /api/test/sentry-test`
2. Find the issue in Sentry → Issues
3. Stack trace should show readable source code, not minified bundles
4. If minified: confirm `SENTRY_AUTH_TOKEN` is set in Vercel env vars

**Delete `/app/api/test/sentry-test/route.ts` after verification.**
