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
