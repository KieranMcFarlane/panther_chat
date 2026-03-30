# Graphiti Signal Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the homepage show only meaningful Graphiti-driven insights, quarantine the remaining Neo4j-era docs as historical references, and keep the question-first BrightData discovery loop aligned with the service-hypothesis model.

**Architecture:** The homepage should read a materialized insight feed, but the feed must be selective: validate via question-first + BrightData evidence, prefer validated or question-first-confirmed signals, and skip low-signal "context refreshed" rows. Historical docs should be quarantined under the archive folder with a clear legacy README pointing to the Graphiti contract.

**Tech Stack:** Next.js route handlers, Supabase, Python pipeline orchestrator, GraphitiService, pytest, Markdown docs.

### Task 1: Quarantine the archive

**Files:**
- Create: `apps/signal-noise-app/docs/archive/README.md`
- Modify: `apps/signal-noise-app/docs/README.md`

**Step 1: Write the failing test**
- No code test is required here; verify via docs diff and content check after the change.

**Step 2: Write minimal implementation**
- Add an archive README that says the folder is historical only.
- Link it from the main docs front door so readers can find the canonical Graphiti contract first.

**Step 3: Verify**
- Run: `sed -n '1,40p' apps/signal-noise-app/docs/archive/README.md`
- Run: `sed -n '1,40p' apps/signal-noise-app/docs/README.md`

### Task 2: Harden the homepage feed

**Files:**
- Modify: `apps/signal-noise-app/backend/graphiti_service.py`
- Modify: `apps/signal-noise-app/backend/pipeline_orchestrator.py` if needed to pass through the right dossier/question context
- Modify: `apps/signal-noise-app/src/app/api/home/graphiti-insights/route.ts` if needed to hide low-signal historical rows

**Step 1: Write the failing test**
- Add a regression test in `apps/signal-noise-app/backend/tests/test_graphiti_homepage_materializer.py` that proves a validated question-first answer can produce a real insight when `validated_signals` is empty.
- Add a regression test that proves no low-signal "context refreshed" row is materialized when there is no strong candidate.

**Step 2: Run the tests to confirm red**
- Run: `python -m pytest apps/signal-noise-app/backend/tests/test_graphiti_homepage_materializer.py -q`
- Expected: fail until the new signal selection logic exists.

**Step 3: Write minimal implementation**
- Add a small selector that ranks candidates in this order:
  1. validated pipeline signals
  2. validated question-first answers with useful service-fit metadata
  3. strong readiness signals
- Skip homepage materialization entirely when no candidate clears the quality bar.
- Keep the persisted row human-readable and grounded in evidence rather than generic freshness.

**Step 4: Run the tests to confirm green**
- Run: `python -m pytest apps/signal-noise-app/backend/tests/test_graphiti_homepage_materializer.py apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -q`

### Task 3: Keep question-first aligned

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py` if the materializer needs explicit service-fit or validation-state summary fields
- Modify: `apps/signal-noise-app/backend/entity_type_dossier_questions.py` and `apps/signal-noise-app/backend/yellow_panther_catalog.py` only if extra service-hypothesis metadata is required

**Step 1: Write the failing test**
- Add a focused test only if a new helper is introduced.

**Step 2: Write minimal implementation**
- Preserve the current question-first structure, but expose the service-hypothesis fields the materializer needs without inventing a second taxonomy.

**Step 3: Verify**
- Run the relevant pytest target plus a lint pass on touched files.

### Task 4: Final verification and commit

**Files:**
- All files changed above

**Step 1: Verify docs and code**
- Run the targeted pytest commands from Task 2.
- Run the relevant lint or typecheck command for any touched frontend TypeScript files.

**Step 2: Commit atomically**
- Commit only the archive README, homepage signal hardening, and any directly related question-first plumbing.
- Leave unrelated worktree changes out of the commit.
