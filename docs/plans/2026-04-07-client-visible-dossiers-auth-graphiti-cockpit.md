# Client-Visible Dossiers, Auth, and Graphiti Cockpit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Phase 1 as the client-visible checkpoint in `apps/signal-noise-app` by enforcing team auth, standardizing UUID dossier routing, and rendering dossier tabs from canonical question-first artifacts; then extend the same source-of-truth into the Phase 2 Graphiti cockpit, notifications, and daily email.

**Architecture:** Keep question-first dossier JSON canonical. The dossier API becomes a resolver that prefers question-first dossier artifacts, falls back to question-first run artifacts and promotes them on demand, and only then uses legacy dossier data. The UI consumes a normalized dossier payload from a single mapping boundary, while browsing/search keeps only a lightweight index for fast lookup. Phase 2 materializes feed/notification/email records from the existing `HomeGraphitiInsightsResponse` shape instead of inventing a parallel schema.

**Tech Stack:** Next.js app router, Better Auth, Supabase, existing Python question-first dossier runner, Graphiti homepage contract, Resend, Node test runner.

### Task 1: Lock Phase 1 contracts with failing tests

**Files:**
- Modify: `apps/signal-noise-app/tests/test-entity-public-id-route-contract.mjs`
- Create: `apps/signal-noise-app/tests/test-phase1-auth-guard-contract.mjs`
- Create: `apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs`
- Create: `apps/signal-noise-app/tests/test-question-first-dossier-tabs-contract.mjs`

**Step 1: Write the failing tests**

Add tests that assert:
- `/`, `/entity-browser`, and `/entity-browser/[entityId]/dossier` invoke `requirePageSession(...)`
- `/api/entities/[entityId]/dossier` prefers question-first dossier/run resolution and emits the canonical fields
- dossier tab mapping includes the Phase 1 priority tabs and reads from normalized `question_first`-backed fields

**Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-phase1-auth-guard-contract.mjs tests/test-question-first-dossier-api-contract.mjs tests/test-question-first-dossier-tabs-contract.mjs tests/test-entity-public-id-route-contract.mjs
```

Expected: FAIL because the current pages are public, the dossier API is Supabase-first, and the tab mapping is still legacy-section-first.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/tests/test-phase1-auth-guard-contract.mjs apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs apps/signal-noise-app/tests/test-question-first-dossier-tabs-contract.mjs apps/signal-noise-app/tests/test-entity-public-id-route-contract.mjs
git commit -m "test: lock phase 1 dossier and auth contracts"
```

### Task 2: Implement canonical dossier resolution and normalization

**Files:**
- Modify: `apps/signal-noise-app/src/app/api/entities/[entityId]/dossier/route.ts`
- Create: `apps/signal-noise-app/src/lib/question-first-dossier.ts`
- Create: `apps/signal-noise-app/src/lib/question-first-dossier-tabs.ts`
- Modify: `apps/signal-noise-app/src/lib/entity-loader.ts`
- Modify: `apps/signal-noise-app/src/lib/dossier-tabs.ts`

**Step 1: Write the minimal implementation**

Implement a resolver that:
- resolves entity by stable UUID/public id helpers
- looks for the latest `*_question_first_dossier.json`
- if missing, looks for `*_question_first_run_v1.json` and merges/promotes it into dossier shape
- only falls back to legacy Supabase dossier rows if no question-first artifacts exist

Normalize the response so the app-facing payload always includes:
- `entity_id`, `entity_name`, `entity_type`
- `question_first`, `metadata.question_first`
- `run_rollup`, `categories`, `answers`, `question_timings`, `poi_graph`
- deterministic `tabs`

**Step 2: Run the targeted tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-question-first-dossier-api-contract.mjs tests/test-question-first-dossier-tabs-contract.mjs tests/test-entity-public-id-route-contract.mjs
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/src/app/api/entities/[entityId]/dossier/route.ts apps/signal-noise-app/src/lib/question-first-dossier.ts apps/signal-noise-app/src/lib/question-first-dossier-tabs.ts apps/signal-noise-app/src/lib/entity-loader.ts apps/signal-noise-app/src/lib/dossier-tabs.ts
git commit -m "feat: resolve dossiers from canonical question-first artifacts"
```

### Task 3: Protect the client-visible Phase 1 surfaces

**Files:**
- Modify: `apps/signal-noise-app/src/app/page.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-browser/page.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/page.tsx`
- Modify: `apps/signal-noise-app/src/app/api/entities/[entityId]/dossier/route.ts`
- Create or modify: `apps/signal-noise-app/src/app/notifications/page.tsx` if the surface already exists, otherwise leave API/server notes only

**Step 1: Write the minimal implementation**

Add `requirePageSession(...)` to homepage, browser, and dossier pages. Add `requireApiSession(...)` where dossier/home/notification APIs must not be anonymously callable.

**Step 2: Run auth contract tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-phase1-auth-guard-contract.mjs
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/src/app/page.tsx apps/signal-noise-app/src/app/entity-browser/page.tsx apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/page.tsx apps/signal-noise-app/src/app/api/entities/[entityId]/dossier/route.ts
git commit -m "feat: protect phase 1 browser and dossier surfaces"
```

### Task 4: Standardize browser and dossier UUID routing plus lightweight index support

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-browser/client-page.tsx`
- Modify: `apps/signal-noise-app/src/components/EntityCard.tsx`
- Modify: `apps/signal-noise-app/src/lib/entity-routing.js`
- Modify: `apps/signal-noise-app/src/lib/cached-entities-supabase.ts`
- Create: `apps/signal-noise-app/src/lib/dossier-index.ts`

**Step 1: Write the minimal implementation**

Ensure browser cards, autocomplete, imports, and dossier prefetches all route to the same UUID-backed dossier URL. Add lightweight dossier index reads/writes for browser status only; do not move dossier content into Supabase rows.

**Step 2: Run routing tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-entity-routing.mjs tests/test-entity-public-id-route-contract.mjs tests/test-entity-browser-smoke-journey.mjs
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/components/EntityCard.tsx apps/signal-noise-app/src/lib/entity-routing.js apps/signal-noise-app/src/lib/cached-entities-supabase.ts apps/signal-noise-app/src/lib/dossier-index.ts
git commit -m "feat: standardize uuid dossier routing and index status"
```

### Task 5: Make the demo seed set visible and tab rendering deterministic

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`
- Modify: `apps/signal-noise-app/src/components/entity-dossier/EntityDossierRouter.tsx`
- Modify: `apps/signal-noise-app/src/components/entity-dossier/EntityDossier.tsx`
- Modify: `apps/signal-noise-app/src/components/entity-browser/EntitySmokeJourney.tsx`

**Step 1: Write the minimal implementation**

Drive the visible tabs from the normalized dossier tabs payload and show dossier availability/status in the browser for seeded entities.

**Step 2: Run dossier UI tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-entity-dossier-surfacing.mjs tests/test-dossier-page-layout.mjs tests/test-entity-dossier-discovery-summary-contract.mjs tests/test-final-ralph-dossier-promoted-sections.mjs
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/src/components/entity-dossier/EntityDossierRouter.tsx apps/signal-noise-app/src/components/entity-dossier/EntityDossier.tsx apps/signal-noise-app/src/components/entity-browser/EntitySmokeJourney.tsx
git commit -m "feat: render dossiers from normalized question-first tabs"
```

### Task 6: Materialize Graphiti cockpit insights from the same source

**Files:**
- Modify: `apps/signal-noise-app/src/lib/home-graphiti-contract.ts`
- Create: `apps/signal-noise-app/src/lib/graphiti-insight-materializer.ts`
- Modify: `apps/signal-noise-app/src/app/api/home/graphiti-insights/route.ts`
- Modify: `apps/signal-noise-app/src/lib/home-graphiti-feed.mjs`
- Modify: `apps/signal-noise-app/src/components/home/GraphitiInsightsFeed.tsx`

**Step 1: Write failing/updated contract tests**

Create or extend tests for:
- mixed card classes: `opportunity`, `watch_item`, `operational`
- ranking by actionability, confidence, freshness, priority
- no duplicate insight cards for unchanged source events

**Step 2: Implement the materializer**

Generate materialized insight rows from question-first dossier outputs using the existing homepage contract and retain references back to entity/run/signal/episode ids.

**Step 3: Run cockpit tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-home-graphiti-contract.mjs tests/test-home-graphiti-feed-contract.mjs
```

Expected: PASS after adding the new tests/files.

### Task 7: Notifications and daily Resend digest from the same insight layer

**Files:**
- Create: `apps/signal-noise-app/src/lib/insight-notifications.ts`
- Modify: `apps/signal-noise-app/src/services/NotificationService.ts`
- Create: `apps/signal-noise-app/src/services/email/sales-action-digest.ts`
- Modify: `apps/signal-noise-app/src/services/email/index.ts`
- Create: `apps/signal-noise-app/src/app/api/notifications/graphiti/route.ts`
- Create: `apps/signal-noise-app/src/app/api/email/daily-sales-digest/route.ts`

**Step 1: Write failing tests**

Cover:
- notification payload includes `entity_id`, `insight_id`, `destination_url`, priority, state
- digest uses the same materialized insight inputs as homepage data
- repeated runs do not duplicate notifications without freshness/state change

**Step 2: Implement minimal delivery plumbing**

Store and emit notification records and build a single daily digest payload using the same materialized insights.

**Step 3: Run tests**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-graphiti-notification-contract.mjs tests/test-daily-sales-digest-contract.mjs
```

Expected: PASS after adding the new tests/files.

### Task 8: Verify, document env/runtime requirements, and close out

**Files:**
- Modify: `apps/signal-noise-app/README.md` or deployment docs already used by the app
- Modify: `docs/plans/2026-04-07-client-visible-dossiers-auth-graphiti-cockpit.md`

**Step 1: Run focused verification**

Run:

```bash
cd apps/signal-noise-app && node --test tests/test-phase1-auth-guard-contract.mjs tests/test-question-first-dossier-api-contract.mjs tests/test-question-first-dossier-tabs-contract.mjs tests/test-entity-public-id-route-contract.mjs tests/test-entity-routing.mjs
```

Then run any new Graphiti/notification/digest contract tests added in Tasks 6-7.

**Step 2: Document env requirements**

Document the Better Auth/Vercel minimum env set:
- `DATABASE_URL` or `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`
- `BETTER_AUTH_URL` or `NEXT_PUBLIC_BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_API_KEY` if infra plugin use is required
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM` or `RESEND_FROM_EMAIL`

**Step 3: Commit**

```bash
git add docs/plans/2026-04-07-client-visible-dossiers-auth-graphiti-cockpit.md apps/signal-noise-app/README.md
git commit -m "docs: record phased dossier and cockpit delivery requirements"
```
