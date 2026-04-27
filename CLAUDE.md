# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (runs on :3000, or :3001 if port taken)
npm run build      # Production build
npm run lint       # ESLint via next lint
npm run analyze    # Bundle analyzer (ANALYZE=true next build)
```

No test suite is configured. There is no `npm test` command.

## Architecture Overview

**The Boardroom Brief** (package name: `the-alignment-times`) is a Next.js 16 App Router satirical business news site with an AI newsroom pipeline. The app has two distinct surfaces:

### Route Groups

- `app/(marketing)/` — Public-facing site: homepage, article pages, section/pillar pages, economy pages, subscribe flow. Uses ISR via Sanity CMS.
- `app/(dashboard)/` — Internal editorial dashboard at `/editorial`. Requires Supabase session auth. Contains the editorial review page and news feed monitor.
- `app/studio/` — Embedded Sanity Studio at `/studio`.

### Data Layer: Two CMS Systems in Parallel

**Sanity** (`app/lib/sanity.ts`, `app/lib/sanity-write.ts`) — Source of truth for published articles on the public site.
- Read client: CDN-backed, used by marketing routes
- Write client: uses `SANITY_API_TOKEN`, called only when an article is approved for publication (`createSanityArticle`)
- Schema config: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`

**Supabase** — Operational database for everything pipeline-related.
- `createServerSupabaseClient()` — async, reads cookies, uses anon key + session auth. Use in Server Components and route handlers that check user auth.
- `createAdminClient()` — sync, service role, bypasses RLS. Use in API routes that run as the system (pipeline, cron). **Always import from `@/app/lib/supabase-server`, never from `@/app/lib/supabase`** (the latter is browser-only and does not export `createAdminClient`).

### Key Supabase Tables

| Table | Purpose |
|---|---|
| `daily_digest` | One row per day — JSONB `digest_json` holding the full `DailyDigest` object |
| `pipeline_jobs` | Live pipeline run tracking — status, JSONB progress per stage, text[] log |
| `newsroom_runs` | Historical audit log of completed pipeline runs |
| `approval_tokens` | Single-use UUID tokens for one-click email article approval |
| `news_feed` | Stories collected by the news intel agent |

### AI Pipeline (`app/api/newsroom/run/route.ts`)

Five-stage pipeline, `maxDuration = 300`:

1. **context** — `buildDailyContext(pillar)` — market/macro snapshot per pillar
2. **topics** — `selectTopics(persona, context)` — Claude picks 1-2 stories per agent
3. **writing** — `writeArticle(persona, topic)` → `ArticleDraft`
4. **review** — `reviewArticle(draft)` → `EditorReview`; auto-revise if score < threshold
5. **digest** — `compileDailyDigest()` → `persistDigest()` → `sendDailyDigestEmail()`

**Triggering**: POST `/api/newsroom/trigger` (session auth) creates a `pipeline_jobs` row, then uses `after()` from `next/server` to fire a background fetch to `/api/newsroom/run` with `x-cron-secret` + `x-job-id` headers. The CRON_SECRET is never exposed to the client.

**Progress tracking**: `app/lib/pipeline-logger.ts` — all functions are non-fatal (catch internally). Uses select+update pattern on the `progress` JSONB column; no Supabase RPC needed.

**Cancellation**: `checkCancelled(jobId)` is polled before each stage. If status is `'cancelled'`, pipeline returns early.

### Five Journalist Agent Personas (`app/lib/agents/personas.ts`)

| Agent | Pillar |
|---|---|
| Rex Volkov | `markets-floor` |
| Ingrid Holt | `macro-mondays` |
| Miles Bancroft | `c-suite-circus` |
| Priya Mehta | `global-office` |
| Danny Fisk | `water-cooler` |

### Editorial Dashboard API Contract

All editorial API routes live under `app/api/editorial/`. Auth is checked via `requireAuth()` from `app/api/editorial/_helpers.ts` which validates the Supabase session cookie.

Article identification uses **string indices** (`articleId: String(index)`) into `digest_json.articles[]` — there is no separate article UUID in the digest. `resolveIndex(articleId)` in `_helpers.ts` converts back to a number.

Routes:
- `GET /api/editorial/review` — loads today's digest + last pipeline run
- `POST /api/editorial/approve` — approves and publishes to Sanity; also handles `GET ?token=` for one-click email links
- `POST /api/editorial/reject` — marks article rejected, updates digest
- `POST /api/editorial/revise` — triggers AI revision of a specific article
- `POST /api/editorial/bulk-approve` — approves all passing articles
- `GET /api/newsroom/status/[jobId]` — live pipeline job status (camelCase JSON)
- `POST /api/newsroom/cancel/[jobId]` — cancels a running job

### Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
SANITY_API_TOKEN
ANTHROPIC_API_KEY
CRON_SECRET
RESEND_API_KEY
EDITOR_EMAIL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
POLYGON_API_KEY        # optional — market data; falls back to mock data
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
```

### Migrations

SQL migrations are in `supabase/migrations/`. They must be run manually in the Supabase SQL Editor — there is no `supabase db push` script configured. Migration `006_pipeline_jobs.sql` must be applied before the pipeline trigger UI will function.
