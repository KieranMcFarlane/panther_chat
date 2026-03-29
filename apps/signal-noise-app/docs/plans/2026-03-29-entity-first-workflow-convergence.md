# Entity-First Workflow Convergence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the entity-first workflow so `Entities -> dossier -> enrichment -> opportunity decision` is reliable, while converging the product around three primary surfaces and embedding operational state into them.

**Architecture:** Keep `Entities`, `RFP's/Tenders`, and `Opportunities` as the three primary destinations. Move useful `Scout`, `Enrichment`, and `Pipeline` behavior into embedded panels backed by real API state. Tighten the dossier persistence path so question-pack generation, writeback, enrichment attachment, and read-back on dossier pages behave as one chain instead of loosely related features.

**Tech Stack:** Next.js App Router, React client components, SWR, FastAPI backend, Node test runner, pytest, Supabase/cached snapshots, existing entity enrichment and pipeline services.

### Task 1: Audit and lock the entity-first smoke path

**Files:**
- Modify: `apps/signal-noise-app/tests/test-entity-browser-compact-layout.mjs`
- Create: `apps/signal-noise-app/tests/test-entity-workflow-smoke-contract.mjs`
- Inspect: `apps/signal-noise-app/src/app/entity-browser/client-page.tsx`
- Inspect: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`

**Step 1: Write the failing test**

Add a contract test asserting the entity browser exposes:
- smoke journey entry
- dossier route path pattern
- enrichment summary embed on entity cards or dossier page
- a visible bridge from entities into opportunity decision state

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-entity-workflow-smoke-contract.mjs`
Expected: FAIL because the current browser flow does not expose the full end-to-end path yet.

**Step 3: Write minimal implementation**

Update the entity browser and dossier surfaces so the smoke path explicitly carries:
- target entity context
- dossier state
- enrichment state
- opportunity handoff state

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-entity-workflow-smoke-contract.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/tests/test-entity-workflow-smoke-contract.mjs
git commit -m "feat(entity-browser): expose entity workflow smoke path"
```

### Task 2: Tighten question-pack writeback and dossier readback

**Files:**
- Modify: `apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`
- Modify: `apps/signal-noise-app/backend/main.py`
- Modify: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`
- Test: `apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py`
- Test: `apps/signal-noise-app/tests/test-entity-dossier-question-pack.mjs`

**Step 1: Write the failing test**

Add tests for:
- writeback metadata being present and current
- dossier page preferring persisted writeback state when available
- stable artifact path and question count values surfacing to the UI

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py -q`
Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-entity-dossier-question-pack.mjs`
Expected: FAIL on stale or incomplete writeback/readback assumptions.

**Step 3: Write minimal implementation**

Make the question pack generator and dossier page agree on:
- artifact path
- persisted flag
- question count
- last writeback source

**Step 4: Run test to verify it passes**

Run the same commands and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/final_ralph_entity_question_pack.py apps/signal-noise-app/backend/main.py apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py apps/signal-noise-app/tests/test-entity-dossier-question-pack.mjs
git commit -m "fix(dossier): align question-pack writeback and readback"
```

### Task 3: Attach enrichment to persisted dossier state

**Files:**
- Modify: `apps/signal-noise-app/src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx`
- Modify: `apps/signal-noise-app/src/components/EntityCard.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`
- Modify: `apps/signal-noise-app/src/app/api/operational-summary/route.ts`
- Test: `apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs`

**Step 1: Write the failing test**

Add assertions that enrichment status:
- derives from persisted dossier context when available
- reports attachment/readiness on entity cards and dossier pages
- uses API-backed runtime data rather than static copy

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs`
Expected: FAIL because runtime-backed attachment details are incomplete.

**Step 3: Write minimal implementation**

Make enrichment summary components consume persisted state and runtime summary together, exposing:
- attachment status
- last updated
- additions count or summary
- actionable next step

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx apps/signal-noise-app/src/components/EntityCard.tsx apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/src/app/api/operational-summary/route.ts apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs
git commit -m "feat(enrichment): attach runtime enrichment state to persisted dossiers"
```

### Task 4: Distinguish Tenders from Opportunities with real data paths

**Files:**
- Modify: `apps/signal-noise-app/src/app/tenders/page.tsx`
- Modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`
- Modify: `apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx`
- Test: `apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs`
- Create: `apps/signal-noise-app/tests/test-primary-surface-distinction.mjs`

**Step 1: Write the failing test**

Add a test proving:
- `Tenders` is the live intake feed with scout status and raw signals
- `Opportunities` is the curated shortlist/decision layer
- neither page uses conflicting framing or duplicated roles

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs apps/signal-noise-app/tests/test-primary-surface-distinction.mjs`
Expected: FAIL because opportunities still depends on mock/legacy shaping.

**Step 3: Write minimal implementation**

Use real tender-derived or persisted data for `Opportunities`, and keep scout state inside `Tenders` rather than as a separate primary workflow.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/tenders/page.tsx apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs apps/signal-noise-app/tests/test-primary-surface-distinction.mjs
git commit -m "feat(workflow): separate tender intake from opportunity decisions"
```

### Task 5: Replace preview ops state with real runtime state

**Files:**
- Modify: `apps/signal-noise-app/src/app/api/operational-summary/route.ts`
- Modify: `apps/signal-noise-app/src/lib/operational-summary.ts`
- Modify: `apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx`
- Modify: `apps/signal-noise-app/src/components/layout/OperationalDrawer.tsx`
- Test: `apps/signal-noise-app/tests/test-operational-summary-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-operational-shell-contract.mjs`

**Step 1: Write the failing test**

Add assertions that the operational summary reports:
- scout endpoint availability and active runs from real sources
- pipeline active/failed/recent data from pipeline summary
- enrichment state from the live enrichment service
- no “missing in this branch” placeholder text on supported routes

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-operational-summary-contract.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs`
Expected: FAIL because scout and pipeline still use partial placeholders.

**Step 3: Write minimal implementation**

Normalize the API response and strip the preview language from the shell once the data is real.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/api/operational-summary/route.ts apps/signal-noise-app/src/lib/operational-summary.ts apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/src/components/layout/OperationalDrawer.tsx apps/signal-noise-app/tests/test-operational-summary-contract.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs
git commit -m "feat(ops): back embedded operational panels with runtime state"
```

### Task 6: Add one browser-level workflow integration test

**Files:**
- Create: `apps/signal-noise-app/tests/test-entity-workflow-browser.mjs`
- Modify: `apps/signal-noise-app/package.json`

**Step 1: Write the failing test**

Create a browser-level integration test that verifies the main flow:
- open entity browser
- locate smoke entity
- navigate to dossier
- confirm persisted dossier marker
- confirm enrichment summary
- confirm opportunity handoff affordance

**Step 2: Run test to verify it fails**

Run: `node apps/signal-noise-app/tests/test-entity-workflow-browser.mjs`
Expected: FAIL until selectors and/or exposed state are stable enough.

**Step 3: Write minimal implementation**

Add the minimum stable data attributes or route-visible state needed for the browser test to pass.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/tests/test-entity-workflow-browser.mjs apps/signal-noise-app/package.json
git commit -m "test(entity-browser): add workflow browser integration check"
```

### Task 7: Final UI pass after workflow stabilization

**Files:**
- Modify: `apps/signal-noise-app/src/components/layout/AppNavigation.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-browser/client-page.tsx`
- Modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`
- Modify: `apps/signal-noise-app/src/app/tenders/page.tsx`
- Test: existing contract tests plus browser workflow test

**Step 1: Write the failing test**

Extend or add tests that lock:
- sidebar cohesion
- dossier page hierarchy
- opportunities vs tenders distinction

**Step 2: Run test to verify it fails**

Run the focused contract/browser suite and confirm the gap exists.

**Step 3: Write minimal implementation**

Only after the workflow path is stable, make the final UI changes to hierarchy and navigation.

**Step 4: Run test to verify it passes**

Run the focused suite again and confirm PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/layout/AppNavigation.tsx apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/src/app/tenders/page.tsx
git commit -m "feat(ui): tighten primary workflow hierarchy"
```

### Task 8: Full verification and smoke test

**Files:**
- Verify only

**Step 1: Run focused verification**

Run:
- `node --experimental-strip-types --test apps/signal-noise-app/tests/test-entity-browser-loading-shell.mjs apps/signal-noise-app/tests/test-entity-browser-compact-layout.mjs apps/signal-noise-app/tests/test-browser-noise-guards.mjs apps/signal-noise-app/tests/test-badge-resolution.mjs apps/signal-noise-app/tests/test-operational-summary-contract.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs apps/signal-noise-app/tests/test-primary-surface-distinction.mjs apps/signal-noise-app/tests/test-entity-workflow-smoke-contract.mjs`
- `python3 -m pytest apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py -q`
- `npm exec eslint apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/app/tenders/page.tsx apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/src/components/layout/AppNavigation.tsx apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/src/components/layout/OperationalDrawer.tsx apps/signal-noise-app/src/components/entity-browser/EntitySmokeJourney.tsx apps/signal-noise-app/src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx`

Expected: all pass except any explicitly documented existing warnings.

**Step 2: Run browser smoke**

Open:
- `/entity-browser`
- `/entity-browser/<smoke-entity-id>/dossier?from=1`
- `/tenders`
- `/opportunities`

Confirm:
- persisted dossier path works
- enrichment is visibly attached
- opportunity handoff is visible
- primary surfaces remain distinct

**Step 3: Commit if any verification-only tweaks were needed**

```bash
git add -A
git commit -m "test: finalize workflow convergence verification"
```
