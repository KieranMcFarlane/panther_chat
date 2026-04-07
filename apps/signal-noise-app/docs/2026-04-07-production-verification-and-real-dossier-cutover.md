# Production Verification And Real Dossier Cutover

## Current State

- Local/dev is on the new client-visible checkpoint and cockpit stack.
- Smoke dossier routing, operator actions, persisted Graphiti materialization, notifications, digest, and cron auth are all working locally.
- The local Graphiti cockpit now materializes real upstream `homepage_graphiti_insights` rows when they exist, even when they are only operational context rows.

## Verified Locally

- `42/42` app contract tests passing.
- Auth-protected entity browser and dossier flow working on `127.0.0.1:3005`.
- Authenticated cron routes:
  - `POST /api/cron/graphiti/materialize`
  - `POST /api/cron/dossiers/refresh`
  - `POST /api/cron/daily-sales-digest`
- Homepage, notifications, and digest all read the same persisted Graphiti insight layer.
- Pinned dossier refresh cron now resolves the same canonical entity ids as the smoke journey.

## Remaining Commercial/Data Gap

The five smoke dossiers in the active app tree are still backed by demo JSON files:

- `backend/data/dossiers/demo/arsenal-football-club_seed_question_first_dossier.json`
- `backend/data/dossiers/demo/coventry-city_seed_question_first_dossier.json`
- `backend/data/dossiers/demo/major-league-cricket_seed_question_first_dossier.json`
- `backend/data/dossiers/demo/zimbabwe-cricket_seed_question_first_dossier.json`
- `backend/data/dossiers/demo/zimbabwe-handball-federation_seed_question_first_dossier.json`

The current workspace does not contain a full five-entity replacement set of real canonical question-first dossier artifacts in the active app tree.

Observed source availability:

- A separate worktree contains real question-first files for Major League Cricket.
- No equivalent full real-artifact set was found for Arsenal, Coventry City, Zimbabwe Cricket, and Zimbabwe Handball Federation in the active app tree.

## Production Verification Findings

The deployed site at `https://panther-chat.vercel.app` is not on the same build as local/dev.

Observed behavior:

- It redirects into `/entity-browser` without the current auth-protected checkpoint behavior.
- It shows an older operational shell dated `2026-03-29`.
- The current protected cockpit APIs are missing:
  - `/api/home/graphiti-insights` returns `404`
  - `/api/notifications/graphiti` returns `404`
  - `/api/email/daily-sales-digest` returns `404`

This means production validation is currently blocked by deployment drift, not by the local implementation.

## Configuration Issues To Correct Before Production Cutover

- Deploy the current app build so the new protected routes and cockpit APIs exist in production.
- Set a real production app URL in:
  - `BETTER_AUTH_URL`
  - `NEXT_PUBLIC_BETTER_AUTH_URL`
  - `NEXT_PUBLIC_APP_URL`
- Use a durable auth database in production:
  - `DATABASE_URL` or
  - `TURSO_DATABASE_URL` plus optional `TURSO_AUTH_TOKEN`
- Set `CRON_SECRET` in Vercel.
- Set valid email sender/recipient configuration:
  - `RESEND_API_KEY`
  - `AUTH_EMAIL_FROM` or `RESEND_FROM_EMAIL`
  - `SALES_DIGEST_TO`

Note:

- `AUTH_EMAIL_FROM` must be an email sender address, not a URL.

## Cutover Steps

1. Generate or collect real question-first dossier artifacts for the five pinned smoke entities.
2. Replace the demo-backed smoke dossier files with the real canonical artifacts.
3. Deploy the current app build to Vercel.
4. Configure production envs and durable auth storage.
5. Run the production smoke pass:
   - anonymous `/` redirects to `/sign-in`
   - authenticated user can load `/`, `/entity-browser`, and smoke dossiers
   - homepage feed, notifications, and digest all load
   - operator rerun/review actions return success
   - cron-authenticated routes succeed

## Next Backend Follow-Up

The raw Graphiti source rows currently skew operational and low-signal:

- titles like `pipeline context refreshed`
- summaries like `No validated signals remained after Ralph validation`

The next upstream improvement is to change the producer of `homepage_graphiti_insights` so it emits stronger validated `opportunity` and `watch_item` rows again, rather than only low-signal context refresh rows.
