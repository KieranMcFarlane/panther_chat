# Baseline Monitoring and Escalation Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the current discovery-first pipeline default with a scalable baseline monitoring pipeline that detects likely RFPs cheaply across many entities, and only escalates selected entities into hypothesis/hop-based discovery.

**Architecture:** Keep the existing business phases, worker, Supabase queue, dossier generation, Ralph validation, temporal persistence, and scoring. Split discovery into two modes: `baseline_monitoring` as the default for all imported entities, and `escalated_hypothesis_discovery` only when baseline evidence is ambiguous, high-value, or high-priority. The baseline path should rely on canonical source maps, deterministic crawls, hashing, rule-based candidate detection, and compact LLM validation on shortlisted evidence only.

**Tech Stack:** Next.js App Router, FastAPI, Supabase, BrightData SDK, Chutes GLM-5 via OpenAI-compatible client, existing worker queue, Graphiti/Falkor temporal persistence, Python pytest, Node test runner.

## Design Principles

- Default to deterministic monitoring, not agentic exploration.
- Only crawl canonical sources for each entity.
- Only reprocess changed content.
- Only call the model on evidence packs that already passed deterministic filtering.
- Reserve hop-based discovery for escalation, not for every entity.
- Keep run tracking, batch tracking, dossier surfacing, and unified RFP surfacing unchanged from a user perspective.
- Follow TDD for each task.
- Commit after each task or closely related task pair.

## Target System Shape

### New pipeline split

1. Intake and registration
2. Dossier generation
3. Baseline monitoring
4. Ralph validation
5. Temporal persistence
6. Dashboard scoring
7. Surfacing
8. Escalated hypothesis discovery only when triggered

### Baseline monitoring inputs

- canonical official website
- tenders/procurement page
- press/news page
- careers/jobs page
- documents/PDF page
- known procurement documents linked from the site

### Escalation triggers

- high-confidence rule hit but low-confidence validation
- changed page with multiple procurement-adjacent indicators
- document-heavy entity with unresolved evidence
- high-priority entity with no canonical procurement page found
- repeated `NO_PROGRESS` in baseline but high maturity or high strategic value

## Data Model Changes

### New or extended concepts

- `entity_source_registry`
  - canonical URLs per entity and page class
- `entity_source_snapshots`
  - content hash, fetched_at, content metadata, changed flag
- `entity_monitoring_candidates`
  - rule-based candidate evidence awaiting validation
- `entity_pipeline_runs.metadata.monitoring_summary`
  - counts, changed pages, candidate totals, validator totals
- `entity_pipeline_runs.metadata.escalation_reason`
  - why a run was promoted into hop-based discovery

### Page classes

- `official_site`
- `tenders_page`
- `procurement_page`
- `press_release`
- `careers_page`
- `document`
- `linkedin_company`
- `linkedin_posts`
- `linkedin_executive`
- `jobs_board`
- `procurement_portal`
- `presswire`

### BrightData expansion

BrightData should be treated as a multi-channel monitoring substrate, not just a page scraper.

Baseline monitoring should expand beyond website pages into:
- LinkedIn company monitoring
- LinkedIn executive post monitoring
- jobs board monitoring
- procurement portal monitoring
- presswire/newswire monitoring

Each channel should eventually get:
- source-specific registry entries
- source-specific snapshot persistence
- source-specific candidate extraction rules
- selective LLM validation only on shortlisted candidates

Escalation triggers should also include BrightData-native signals such as:
- multiple procurement-adjacent LinkedIn posts
- hiring surges in digital/procurement roles
- procurement-portal documents with ambiguous high-value language
- repeated multi-channel weak signals across LinkedIn, jobs, and site content

## Phase Plan

### Task 1: Write the architecture decision doc

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/architecture/baseline-monitoring-vs-escalation.md`

**Step 1: Write the document**

Include:
- why baseline monitoring becomes the default
- why hop discovery becomes escalation-only
- canonical page classes
- escalation triggers
- data flow from CSV intake to RFP surfacing

**Step 2: Review for overlap**

Make sure it does not contradict:
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/FINAL-CSV-TO-INTELLIGENCE-PIPELINE.md`

**Step 3: Commit**

```bash
git add docs/architecture/baseline-monitoring-vs-escalation.md
git commit -m "docs: define baseline monitoring pipeline architecture"
```

### Task 2: Add source registry schema

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/supabase/migrations/20260303_entity_source_registry.sql`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-jobs.mjs`

**Step 1: Write the failing test**

Add assertions that the app expects source-registry-backed metadata fields to exist in responses or helper outputs.

**Step 2: Run test to verify failure**

Run:

```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-jobs.mjs
```

Expected: fail once the new schema-dependent fields are referenced.

**Step 3: Write migration**

Add:
- `entity_source_registry`
  - `entity_id`
  - `page_class`
  - `url`
  - `source`
  - `confidence`
  - `is_canonical`
  - `last_verified_at`
  - unique `(entity_id, page_class, url)`
- `entity_source_snapshots`
  - `entity_id`
  - `page_class`
  - `url`
  - `content_hash`
  - `fetched_at`
  - `changed`
  - `metadata`
- `entity_monitoring_candidates`
  - `entity_id`
  - `batch_id`
  - `run_id`
  - `page_class`
  - `url`
  - `content_hash`
  - `candidate_type`
  - `score`
  - `evidence_excerpt`
  - `metadata`

**Step 4: Apply migration**

Use Supabase MCP to apply the migration.

**Step 5: Commit**

```bash
git add supabase/migrations/20260303_entity_source_registry.sql
git commit -m "feat: add source registry and monitoring snapshot schema"
```

### Task 3: Add source registry library

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-source-registry.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-source-registry.mjs`

**Step 1: Write the failing test**

Test:
- register canonical source
- read canonical sources by entity
- upsert page class without duplication

**Step 2: Run the test**

```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-source-registry.mjs
```

Expected: fail because helper does not exist.

**Step 3: Write minimal implementation**

Implement:
- `upsertEntitySourceRegistryEntries(entityId, entries)`
- `getEntitySourceRegistry(entityId)`
- `getCanonicalSourceUrl(entityId, pageClass)`

**Step 4: Run test to verify pass**

**Step 5: Commit**

```bash
git add src/lib/entity-source-registry.ts tests/test-entity-source-registry.mjs
git commit -m "feat: add entity source registry helpers"
```

### Task 4: Populate canonical sources from dossier output

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_generator.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write failing test**

Extend the orchestrator test so dossier metadata exposes:
- canonical `official_site`
- source list for monitoring

**Step 2: Run test to verify failure**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -q
```

**Step 3: Implement**

Add dossier metadata fields:
- `canonical_sources`
  - `official_site`
  - `press_release`
  - `careers_page`
  - `document`

Populate from:
- `website`
- `official_site_url`
- known site path shortcuts where safe

**Step 4: Run test**

**Step 5: Commit**

```bash
git add backend/dossier_generator.py backend/pipeline_orchestrator.py backend/tests/test_pipeline_orchestrator.py
git commit -m "feat: expose canonical sources from dossier phase"
```

### Task 5: Add baseline monitoring runner

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/baseline_monitoring.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_baseline_monitoring.py`

**Step 1: Write failing tests**

Test:
- canonical sources are fetched once
- unchanged content is skipped after hash compare
- changed content emits candidates

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_baseline_monitoring.py -q
```

**Step 3: Write minimal implementation**

Implement:
- `collect_canonical_sources(entity_id, entity_name, dossier)`
- `fetch_source_snapshot(url, page_class)`
- `compare_snapshot_hash(previous_hash, current_hash)`
- `build_monitoring_summary(...)`

Use existing BrightData scrape helpers.

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/baseline_monitoring.py backend/tests/test_baseline_monitoring.py
git commit -m "feat: add baseline monitoring runner"
```

### Task 6: Add deterministic candidate extraction

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/monitoring_candidate_extractor.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_monitoring_candidate_extractor.py`

**Step 1: Write failing tests**

Test extraction from:
- tender pages
- procurement pages
- press pages
- PDF/document pages

Signals should detect:
- `rfp`
- `tender`
- `procurement`
- `request for proposal`
- `deadline`
- `vendor`
- `supplier`
- `submission`

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_monitoring_candidate_extractor.py -q
```

**Step 3: Implement extractor**

Implement:
- page-class-specific keyword scoring
- excerpt extraction around matched keywords
- candidate ranking
- document title/URL scoring

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/monitoring_candidate_extractor.py backend/tests/test_monitoring_candidate_extractor.py
git commit -m "feat: add deterministic monitoring candidate extraction"
```

### Task 7: Add LLM validation on candidates only

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/hypothesis_driven_discovery.py`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/candidate_validator.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_candidate_validator.py`

**Step 1: Write failing tests**

Test:
- only shortlisted candidates invoke the model
- validation payload is excerpt-based, not full-page-based
- low-score candidates are skipped

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_candidate_validator.py -q
```

**Step 3: Implement**

Add `candidate_validator.py`:
- accepts candidate excerpts
- validates procurement significance
- returns compact validated signal payload

Do not reuse hop loop here.

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/candidate_validator.py backend/tests/test_candidate_validator.py backend/hypothesis_driven_discovery.py
git commit -m "feat: validate shortlisted monitoring candidates with llm"
```

### Task 8: Add baseline monitoring to orchestrator

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/main.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write failing test**

Expected new phase model:
- `dossier_generation`
- `baseline_monitoring`
- `ralph_validation`
- `temporal_persistence`
- `dashboard_scoring`

Discovery should only run when escalation is triggered.

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -q
```

**Step 3: Implement**

Add:
- `baseline_monitoring` phase
- `monitoring_summary` in artifacts
- `escalation_reason` when baseline decides to escalate
- optional `escalated_discovery` phase only when needed

Keep legacy response compatibility where possible.

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/pipeline_orchestrator.py backend/main.py backend/tests/test_pipeline_orchestrator.py
git commit -m "feat: add baseline monitoring phase to orchestrator"
```

### Task 9: Define escalation policy

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/escalation_policy.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_escalation_policy.py`

**Step 1: Write failing tests**

Cover:
- ambiguous procurement candidate escalates
- high-priority entity with weak signals escalates
- unchanged low-yield entity does not escalate
- document-heavy candidate set escalates

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_escalation_policy.py -q
```

**Step 3: Implement**

Policy inputs:
- candidate count
- top candidate score
- validated candidate confidence
- entity priority score
- page classes found/missing
- document count
- previous repeated no-progress state

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/escalation_policy.py backend/tests/test_escalation_policy.py
git commit -m "feat: add escalation policy for hop discovery"
```

### Task 10: Restrict hop discovery to escalation only

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/hypothesis_driven_discovery.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write failing test**

Test that:
- standard entity run does not invoke hop discovery
- escalated entity run does invoke hop discovery

**Step 2: Run test**

**Step 3: Implement**

Only call:
- `run_discovery_with_dossier_context(...)`

when escalation policy returns true.

Otherwise:
- baseline validated candidates feed Ralph directly.

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/hypothesis_driven_discovery.py backend/pipeline_orchestrator.py backend/tests/test_pipeline_orchestrator.py
git commit -m "feat: restrict hop discovery to escalation path"
```

### Task 11: Rebalance dashboard inputs again for baseline monitoring

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dashboard_scorer.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_dashboard_scorer_validation_first.py`

**Step 1: Write failing test**

Test:
- baseline validated procurement evidence drives probability
- monitoring candidates do not inflate maturity before validation
- escalated discovery hypotheses remain low-weight priors

**Step 2: Run test**

```bash
uv run pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_dashboard_scorer_validation_first.py -q
```

**Step 3: Implement**

Use:
- validated monitoring candidates
- validated procurement signals
- temporal episodes
- only minor prior contribution from escalated hypotheses

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/dashboard_scorer.py backend/tests/test_dashboard_scorer_validation_first.py
git commit -m "feat: score baseline monitoring evidence before escalation priors"
```

### Task 12: Persist monitoring summary and escalation reason to run metadata

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_run_metadata.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/main.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_phase_update_payload.py`

**Step 1: Write failing test**

Expect:
- `monitoring_summary`
- `escalation_reason`
- optional `escalated_discovery_summary`

**Step 2: Run test**

**Step 3: Implement**

Merge and persist:
- changed pages
- candidate totals
- validated candidate totals
- escalated flag
- escalation reason

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add backend/pipeline_run_metadata.py backend/main.py backend/tests/test_pipeline_phase_update_payload.py
git commit -m "feat: persist monitoring and escalation metadata"
```

### Task 13: Surface baseline monitoring in the run-detail UI

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-import/[batchId]/[entityId]/page.tsx`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-run-detail.mjs`

**Step 1: Write failing test**

Expect:
- `Baseline monitoring`
- changed pages
- candidate counts
- escalated yes/no
- escalation reason

**Step 2: Run test**

```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-run-detail.mjs
```

**Step 3: Implement**

Add sections for:
- canonical sources
- changed source count
- candidate count
- validation count
- escalated discovery reason

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add src/app/entity-import/[batchId]/[entityId]/page.tsx tests/test-entity-run-detail.mjs
git commit -m "feat: surface baseline monitoring and escalation details"
```

### Task 14: Add source-registry population during intake

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entity-pipeline/route.ts`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entity-import/[batchId]/run/route.ts`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-import-mapper.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-pipeline-api.mjs`

**Step 1: Write failing test**

Test that if `website` is present in intake:
- it is persisted to source registry
- it is available for baseline monitoring

**Step 2: Run test**

**Step 3: Implement**

When CSV or single-entity input contains a website:
- persist it as canonical `official_site`

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add src/app/api/entity-pipeline/route.ts src/app/api/entity-import/[batchId]/run/route.ts src/lib/entity-import-mapper.ts tests/test-entity-pipeline-api.mjs
git commit -m "feat: persist intake websites into source registry"
```

### Task 15: Add live smoke run for a federation

**Files:**
- No code required if previous tasks pass
- Document result in: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/plans/2026-03-03-baseline-monitoring-and-escalation-pipeline.md`

**Step 1: Run live federation**

Use:
- `FIBA`
- `International Canoe Federation`

**Step 2: Inspect Supabase rows**

Confirm:
- baseline monitoring phase exists
- changed source count is populated
- first hop discovery does not run unless escalated
- if escalated, `escalation_reason` is populated

**Step 3: Record results**

Append a short rollout note to this plan doc or create a companion validation note.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-03-baseline-monitoring-and-escalation-pipeline.md
git commit -m "docs: record baseline monitoring smoke test results"
```

## Verification Matrix

### Backend tests

- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_baseline_monitoring.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_monitoring_candidate_extractor.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_candidate_validator.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_escalation_policy.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_dashboard_scorer_validation_first.py`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`

### Frontend/API tests

- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-run-detail.mjs`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-pipeline-api.mjs`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-jobs.mjs`
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-source-registry.mjs`

### Live acceptance checks

- repeated unchanged official-site passes become effectively free
- non-escalated entities avoid hop-based discovery
- first-hop discovery only appears when escalation was triggered
- unified RFP surfacing still works
- dossier/entity browser still works

## Acceptance Criteria

- Baseline monitoring is the default path for imported entities.
- Hop discovery runs only when escalation policy triggers.
- Canonical source URLs are persisted and reused.
- The system does not repeatedly search for official sites already known from intake or dossier.
- LLM usage is limited to candidate validation and escalated discovery.
- Dashboard scoring uses validated monitoring evidence first.
- Run-detail UI shows baseline monitoring and escalation clearly.
- Existing CSV import, entity browser dossier, and RFP page remain functional.

## Rollout Order

1. Source registry schema and helpers
2. Baseline monitoring runner and candidate extraction
3. Orchestrator integration
4. Escalation policy
5. UI surfacing
6. Live smoke validation

## Notes

- Do not remove the existing hop discovery code immediately.
- Keep it behind the escalation path so existing behavior can be reused for ambiguous cases.
- Do not redesign the UI; extend the existing run-detail/status surfaces only.
- Prefer data-driven deterministic shortcuts over more search loops.
