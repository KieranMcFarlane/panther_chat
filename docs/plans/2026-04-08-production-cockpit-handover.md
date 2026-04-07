# Production Cockpit Handover

Date: 2026-04-08

## Current State

The latest pushed `main` at handover was `c247abe5` (`docs(question-first): add timeout salvage evidence bundle`).

Update on 2026-04-08:

- local `main` was confirmed in sync with `origin/main` at `3b86f121` before production-readiness work
- production build was made build-safe for auth-protected app routes and CopilotKit pages
- `npm run build` now completes successfully locally
- cockpit/operator contract suite now passes with 26 tests

The app implementation for the client-visible dossier and Graphiti cockpit path is now on `main`:

- Better Auth protection for homepage, entity browser, and dossier pages
- UUID-backed entity browser to dossier routing
- canonical question-first dossier API and tab rendering
- dossier status/index support for browser cards
- persisted Graphiti materialized insights and notifications
- operator dossier actions for rerun/review/missing-evidence inspection
- Vercel cron routes for dossier refresh, Graphiti materialization, and daily sales digest

The question-first pipeline implementation has also moved forward:

- batch finalization from terminal state
- raw execution trace preservation in question artifacts
- q2 deterministic recovery improvements
- q3/q4 weak-surface failure taxonomy
- 25-entity batch manifests and failure rerun manifests

## Remaining Work

### 1. Recover or regenerate real dossier artifacts

The real full-batch outputs were recorded in docs under `/tmp`, but those generated directories are no longer present locally:

- `/tmp/question-first-archetype-smoke-final`
- `/tmp/question-first-scale-batch-10`
- `/tmp/question-first-scale-batch-25`
- `/tmp/question-first-rerun-q2c`
- `/tmp/question-first-rerun-q3c`
- `/tmp/question-first-rerun-q4e`

The only usable canonical real artifact currently found on disk is:

- `/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot/backend/data/question_first_dossiers/major-league-cricket_opencode_batch_20260330_183515_question_first_run_v1.json`

That artifact is `status: ready` for Major League Cricket with 2 validated answers and 6 source refs. The same directory also contains two empty MLC runs and should not be treated as a full client smoke-set replacement.

Next step:

- rerun the stable archetype or 25-entity batch using the latest `main`, or locate an external copy of the deleted `/tmp` outputs
- promote only `status: ready` canonical `*_question_first_run_v1.json` or `*_question_first_dossier.json` artifacts into the app-facing artifact store
- replace demo smoke dossiers only after each pinned smoke entity has a real canonical artifact

### 2. Rerun a narrow q3/q4 diagnostic slice

The latest push preserves `raw_execution_trace` for future weak-surface runs. It does not retroactively recover evidence from older `tool_call_missing` artifacts.

Next step:

- rerun a small q3/q4 diagnostic slice from the existing rerun manifests
- inspect `raw_execution_trace` for execution/runtime failure, partial retrieval evidence, or genuine no-evidence cases
- only add a flagged best-available mode if traces repeatedly show useful partial evidence that strict validation rejected

### 3. Cut production over to the current build

Production was previously observed serving an older app shell and returning `404` for new cockpit APIs. After pushing current `main`, verify the Vercel deployment is actually on the latest commit.

Local production build status:

- `npm run build`: passed
- known non-blocking warning: Ralph analytics static route export logs missing optional local data files:
  - `apps/signal-noise-app/data/entity_cluster_mapping.json`
  - `apps/signal-noise-app/data/production_clusters.json`
- those warnings did not fail the build

Local contract status:

- `node --test` cockpit/operator contract suite: 26 passed

Vercel deployment note:

- the `panther-chat` project is on a Hobby plan, so cron jobs must not run more than once per day
- cron schedules were adjusted to daily production-safe runs so deployment can proceed without requiring a plan upgrade
- production alias `https://panther-chat.vercel.app` was verified on deployment `panther-chat-fzjt5v76u-kieranmcfarlanes-projects.vercel.app`
- the earlier production Supabase keys were stale; production Supabase URL, anon key, and service-role key were refreshed from the Supabase Management API for project `itlcuazbybqlkicsaola`
- authorized cron smoke passed after the Supabase refresh:
  - `/api/cron/dossiers/refresh`: `200`, queued 25 dossier refresh jobs
  - `/api/cron/graphiti/materialize`: `200`, materialized 2 fallback operational insights
  - `/api/cron/daily-sales-digest`: `200`, digest generated but not sent because `SALES_DIGEST_TO` is not configured
- after `SALES_DIGEST_TO` was added in Vercel production, production was redeployed and `/api/cron/daily-sales-digest` returned `200` with `sent: true`
- anonymous route smoke passed:
  - `/` redirects to `/sign-in?redirect=%2F`
  - `/entity-browser` redirects to `/sign-in?redirect=%2Fentity-browser`
  - `/api/home/graphiti-insights`, `/api/notifications/graphiti`, and `/api/email/daily-sales-digest` return `401` without an authenticated session

Required production checks:

- `GET /api/home/graphiti-insights` is present and auth-gated
- `GET /api/notifications/graphiti` is present and auth-gated
- `GET /api/email/daily-sales-digest` is present and auth-gated
- `/entity-browser` shows the current smoke journey, not the older March shell
- dossier links resolve to UUID-backed routes

### 4. Verify production environment

Production needs durable runtime configuration before client rollout:

- durable Better Auth database via `DATABASE_URL` or `TURSO_DATABASE_URL` plus token
- `BETTER_AUTH_URL` or `NEXT_PUBLIC_BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `RESEND_API_KEY`
- valid sender email through `RESEND_FROM_EMAIL` or `AUTH_EMAIL_FROM`

Local config issue seen during inspection:

- `AUTH_EMAIL_FROM` was set to a URL-like value in local env shape; it should be an email sender address.

### 5. Production smoke pass

Run this after Vercel is on the current build and envs are set:

1. sign in as an allowed team user
2. open homepage and verify mixed cockpit feed loads
3. open `/entity-browser`
4. open all five pinned smoke entities
5. verify each dossier renders canonical question-first tabs
6. trigger one rerun/review operator action on a stale or rerun-needed entity
7. verify one notification link opens the expected dossier
8. preview the daily digest payload
9. trigger each cron route with and without `CRON_SECRET` to confirm `200` and `401` behavior respectively

## Do Not Commit

The following local untracked files were seen during handover inspection and should not be committed without cleanup:

- `apps/signal-noise-app/scripts/answer_icf_question.py`
- `apps/signal-noise-app/scripts/answer_mlc_question.py`
- `apps/signal-noise-app/tmp/`

The two scripts contain hardcoded BrightData token values and should be deleted or rewritten to read credentials from environment variables before they are ever staged.

## Client Demo Readiness Update - 2026-04-07 18:00 BST

Local verification after client-smoke hardening:

- `node --test tests/test-auth-hardening.mjs tests/test-auth-origin-contract.mjs tests/test-pinned-client-smoke-config-contract.mjs tests/test-question-first-demo-seed-contract.mjs tests/test-entity-browser-smoke-journey.mjs tests/test-question-first-dossier-router-contract.mjs tests/test-operator-controls-contract.mjs tests/test-vercel-cron-contract.mjs`: 24 passed
- `npm run build`: passed after clearing generated caches to resolve local `ENOSPC`

Production route and cron smoke:

- Vercel alias `https://panther-chat.vercel.app` was Ready on deployment `panther-chat-nvbzvcumb-kieranmcfarlanes-projects.vercel.app`
- anonymous `/` resolves to the sign-in redirect
- anonymous `/entity-browser` resolves to the sign-in redirect
- anonymous `/api/home/graphiti-insights`, `/api/notifications/graphiti`, and `/api/email/daily-sales-digest` return `401`
- cron routes without `CRON_SECRET` return `401`
- cron routes with `CRON_SECRET` return `200`
- daily sales digest with `CRON_SECRET` now returns `200`; repeated same-day triggers are idempotently skipped with `Digest already sent for this London business day`

Authenticated browser smoke finding:

- Playwright smoke reached the production sign-in page and found that the decorative fixed SVG background intercepted the `Sign up` button click
- the root cause was the global `BackgroundAnimation` fixed layer receiving pointer events above the auth form
- fix applied: mark the decorative background wrapper `pointer-events-none`
- regression coverage added in `test-auth-hardening.mjs`

Client demo status:

- the five pinned smoke entities and demo seed dossier contracts remain stable
- the app is ready for redeploy with the click-interception fix before rerunning the full authenticated browser smoke
- no full-batch real artifact replacement should happen before the client-facing smoke passes on the redeployed build

## Client Demo Smoke Result - 2026-04-07 18:15 BST

Redeployed build:

- commit: `92143ea9` (`fix(app): prevent auth background click interception`)
- production alias: `https://panther-chat.vercel.app`
- Ready deployment: `panther-chat-8v5e1b2tc-kieranmcfarlanes-projects.vercel.app`

Authenticated Playwright smoke result:

- created disposable production smoke users using `kieranmcfarlane2+panther-smoke-*` aliases
- sign-up and redirect to `/` succeeded
- homepage cockpit/feed surface rendered expected cockpit terms
- `/entity-browser` rendered all five pinned smoke entities:
  - Arsenal
  - Coventry City
  - Zimbabwe Cricket
  - Major League Cricket
  - Zimbabwe Handball Federation
- all five UUID-backed dossier pages opened without broken states and rendered question-first dossier content signals
- dossier pages exposed operator-control text/signals for the smoke route
- authenticated `/api/notifications/graphiti` returned `200` with 2 notifications
- first notification destination opened `/entity-browser/1db6d6eb-89c5-5c9f-95cb-217d0985a176/dossier?from=1` without a broken state

Client-visible checkpoint:

- production auth path is usable
- homepage cockpit is reachable after auth
- entity browser smoke set is visible
- five pinned dossiers route by UUID and render tabbed dossier signals
- notification-to-dossier routing is working
- daily digest send path has already been verified; repeated same-day cron calls are idempotently skipped after send

Remaining tuning work:

- regenerate or recover real full-batch canonical artifacts before replacing the current tracked demo seed dossiers
- continue q3/q4 quality hardening separately from the client demo checkpoint
