# Signal Noise App

## Client Checkpoint Deployment

This app now has a client-facing Phase 1 checkpoint and a Phase 2 cockpit layer on top of the same canonical dossier pipeline.

### Protected surfaces

These routes require Better Auth session access and redirect anonymous users to `/sign-in`:

- `/`
- `/entity-browser`
- `/entity-browser/[entityId]/dossier`
- `/api/home/graphiti-insights`
- `/api/notifications/graphiti`
- `/api/email/daily-sales-digest`

### Canonical dossier source

The dossier UI is backed by question-first artifacts in this order:

1. latest `question_first_dossier`
2. latest `question_first_run_v1`, promoted/merged on demand
3. legacy dossier fallback only when no question-first artifact exists

The canonical app-facing dossier contract is served from:

- `/api/entities/[entityId]/dossier`

### Minimum environment variables

#### Better Auth and app URLs

Set at least one canonical public app URL:

- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`

For local development, the app trusts:

- `http://localhost:3005`
- `http://127.0.0.1:3005`

#### Durable auth database

Production must use a durable database. One of these configurations is required:

- `DATABASE_URL` with a Postgres connection string
- `TURSO_DATABASE_URL` with optional `TURSO_AUTH_TOKEN`

Do not rely on local sqlite or in-memory auth storage in hosted production.

#### Daily digest email

The daily sales digest route builds a digest without sending if email env is missing. To enable sending, set:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM` or `RESEND_FROM_EMAIL`
- `SALES_DIGEST_TO`
- `CRON_SECRET`
- `SIGNAL_NOISE_OPERATOR_EMAILS` for rerun/review controls if you want to restrict those actions to named operators

Without those values, `POST /api/email/daily-sales-digest` returns the digest payload with `sent: false`.

### Vercel notes

- Set the public app URL envs to the production deployment hostname.
- Configure a durable auth database before enabling client access.
- Keep preview deployments private; the app assumes authenticated team access, not public preview access.
- Configure `CRON_SECRET` in Vercel and send it as `Authorization: Bearer <secret>` for internal cron calls.
- Vercel cron is configured for:
  - dossier refresh hourly
  - Graphiti materialization every 15 minutes
  - digest at `06:00` and `07:00` UTC on weekdays, with app-side dedupe by London business day

### Demo checkpoint expectations

The current client-visible checkpoint should support:

- sign in for allowed team members
- entity browser access behind auth
- UUID-backed dossier routing
- canonical question-first dossier tabs
- homepage Graphiti cockpit cards
- Graphiti notification links
- daily sales digest generation from the same materialized insights
- persisted Graphiti materialization and notification state in Supabase
- operator rerun and review controls for stale or degraded dossiers
