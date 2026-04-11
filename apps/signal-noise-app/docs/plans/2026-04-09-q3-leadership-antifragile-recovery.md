# Q3 Leadership Antifragile Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `q3_leadership` reliably produce a minimal, explicit leadership answer for obscure clubs and federations instead of collapsing into `tool_call_missing` when evidence is discovered.

**Architecture:** Keep the existing retrieval-first question flow, but add a deterministic rescue layer between discovery and final validation. The system should distinguish three cases cleanly: no evidence found, evidence found but parser/model output missing, and evidence found with validated structured answer. When evidence exists, the pipeline must salvage a minimal leadership answer from trusted sources rather than ending unresolved. Connections analysis should remain optional and additive, never a prerequisite for `q3` success.

**Tech Stack:** Python backend runner, Node `opencode_agentic_batch.mjs`, JSON question-source artifacts, BrightData MCP client, Next.js dossier normalization/tests, pytest, Node test runner.

### Task 1: Lock down the current failure mode with failing tests

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs`

**Step 1: Write the failing backend tests**

Add tests that model a `q3_leadership` run where:
- discovery found candidate URLs,
- validation state would currently become `tool_call_missing`,
- no structured leadership payload was emitted,
- a deterministic fallback should produce a minimal answered payload instead.

Test these cases:
- evidence includes a Wikipedia/official-site leadership section and should yield at least one candidate.
- evidence includes only low-trust commercial sources and should yield explicit `no_signal`, not fake leadership.
- evidence includes one trusted person name and title and should yield `terminal_state == "answered"`.

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q
```

Expected: FAIL because the current path still leaves `q3` unresolved when parser/model output is missing.

**Step 3: Add failing API contract coverage**

Add a normalization/API test proving that a `q3` fallback answer:
- appears as `answered`,
- includes a minimal candidate set,
- does not surface as `tool_call_missing`,
- keeps `terminal_summary` readable.

**Step 4: Run the API test to verify it fails**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
node --test apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs
```

Expected: FAIL because the current normalization expects raw model output, not fallback rescue.

**Step 5: Commit**

```bash
git add backend/tests/test_question_first_dossier_runner.py apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs
git commit -m "test: capture q3 leadership fallback failure mode"
```

### Task 2: Add a deterministic leadership fallback model

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`

**Step 1: Write the failing test for fallback extraction**

Add a focused test fixture that includes:
- entity name,
- question id `q3_leadership`,
- discovered source URLs,
- scraped snippets or trusted summary text with names/titles,
- no model JSON output.

Assert the fallback builder emits:
- `validation_state: answered` or `validated` only when source quality threshold is met,
- `answer.kind: "list"` or agreed typed leadership shape,
- ranked candidates with `name`, `title`, `source_url`, `source_type`,
- explicit `notes` describing fallback provenance.

**Step 2: Run the focused test and confirm failure**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k leadership
```

Expected: FAIL because no deterministic fallback exists yet.

**Step 3: Implement the minimal fallback**

In [`opencode_agentic_batch.mjs`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs):
- add a post-discovery fallback for `q3_leadership`,
- trigger it only when:
  - frontier or discovered evidence exists,
  - parser result is missing/empty,
  - question is still on the unresolved path.
- trusted-source order:
  1. official site leadership/about/team page
  2. wikipedia infobox/leadership fields
  3. LinkedIn company/person profile
  4. reputable news/press
- low-trust sources like generic company databases should be evidence supplements, not primary validators.

Fallback output should be minimal and safe:
```json
{
  "answer": [
    {"name": "Tavengwa Mukuhlani", "title": "Chairman", "source_url": "...", "source_type": "wikipedia"}
  ],
  "summary": "Recovered 1 leadership candidate from trusted fallback sources.",
  "confidence": 0.72,
  "validation_state": "partially_validated",
  "terminal_state": "answered"
}
```

**Step 4: Implement backend normalization support**

In [`question_first_dossier_runner.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py):
- preserve fallback provenance in the merged dossier,
- ensure `terminal_summary` and `notes` clearly say this came from deterministic fallback,
- do not collapse fallback answers back into generic `failed` or `tool_call_missing`.

**Step 5: Run tests to verify pass**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k leadership
node --test apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs
```

Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/opencode_agentic_batch.mjs backend/question_first_dossier_runner.py backend/tests/test_question_first_dossier_runner.py apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs
git commit -m "feat: add deterministic q3 leadership fallback"
```

### Task 3: Harden prompt and parser so discovered evidence cannot silently disappear

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`

**Step 1: Write the failing parser test**

Add tests covering these parser failure classes:
- no fenced JSON block but assistant text contains names/titles,
- malformed JSON with readable person rows,
- empty JSON object despite populated frontier,
- tool output with sources but missing `answer`.

Assert the executor converts these into:
- salvageable structured leadership output when evidence is parseable,
- explicit `no_signal` with reason when evidence is too weak,
- never `tool_call_missing` if the frontier has trusted accepted sources.

**Step 2: Run test to verify failure**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k parser
```

Expected: FAIL.

**Step 3: Implement parser hardening**

In [`opencode_agentic_batch.mjs`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs):
- split `tool_call_missing` into more specific internal causes:
  - `no_tool_output`
  - `empty_structured_output`
  - `malformed_structured_output`
- add a leadership-specific salvage parser that can extract simple `Name - Title` patterns from assistant text or scraped snippets.
- change the terminal classification rule:
  - if trusted evidence exists and salvage parser extracts candidates, return fallback answered state,
  - if trusted evidence exists but nothing extractable remains, return explicit `no_signal` with `notes`,
  - reserve `tool_call_missing` for true absence of any usable tool/model output.

**Step 4: Run tests to verify pass**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k parser
```

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/opencode_agentic_batch.mjs backend/tests/test_question_first_dossier_runner.py
git commit -m "feat: harden q3 parser and classify missing-output failures"
```

### Task 4: Make Wikipedia-first grounding explicit for obscure federations and clubs

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/universal_atomic_matrix.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`

**Step 1: Write the failing routing test**

Add tests proving that for `SPORT_FEDERATION` and lower-profile entities:
- `q3` can use `q1` outputs directly,
- if `q1` found chairman/CEO/secretary-general names, `q3` should seed those names into LinkedIn/Google refinement queries,
- Wikipedia-derived leadership names are treated as seed candidates, not final truth without corroboration unless confidence policy explicitly allows it.

**Step 2: Run test to verify failure**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k wikipedia
```

Expected: FAIL.

**Step 3: Implement refinement chain**

Add explicit logic so `q3`:
- consumes `q1` leadership-like facts when present,
- builds secondary search queries such as:
  - `"Zimbabwe Cricket" "Tavengwa Mukuhlani" LinkedIn`
  - `"Zimbabwe Cricket" "Wilfred Mukondiwa" chief executive`
  - `"Zimbabwe Cricket" chairman`
- then uses those refinements to improve candidate confidence and source quality.

This makes the pipeline match the human research workflow:
- ground entity on Wikipedia/official site,
- extract probable executives,
- refine via LinkedIn/Google/official site.

**Step 4: Run tests to verify pass**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k wikipedia
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/universal_atomic_matrix.py scripts/opencode_agentic_batch.mjs backend/tests/test_question_first_dossier_runner.py
git commit -m "feat: seed q3 leadership refinement from q1 grounding"
```

### Task 5: Make connections analysis additive and observable, not hidden

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/connections_graph_enricher.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/question-first-dossier.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs`

**Step 1: Write failing observability tests**

Assert that when connections enrichment is enabled:
- dossier metadata records `connections_graph_enrichment_enabled: true`,
- enrichment status is one of `enabled`, `success`, `failed`,
- `q12_connections` can explain whether it was blocked by missing `q11` or failed due to enrichment issues.

**Step 2: Run test to verify failure**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k connections
node --test apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs
```

Expected: FAIL or missing metadata.

**Step 3: Implement explicit connections status**

Add metadata fields:
- `connections_graph_enrichment_enabled`
- `connections_graph_enrichment_status`
- `connections_graph_enrichment_error`
- `connections_observations_total`

Do not let q3 depend on connections enrichment. Keep it additive:
- q3 succeeds on its own if leadership can be recovered,
- q12 becomes richer when enrichment succeeds.

**Step 4: Run tests to verify pass**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q -k connections
node --test apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/connections_graph_enricher.py backend/question_first_dossier_runner.py src/lib/question-first-dossier.ts backend/tests/test_question_first_dossier_runner.py apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs
git commit -m "feat: surface connections enrichment status in dossier metadata"
```

### Task 6: Verify on Zimbabwe Cricket and one additional obscure federation

**Files:**
- Use existing rerun manifests and generated question sources under `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/`
- Use output roots under `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tmp/question-first-diagnostics/`

**Step 1: Write a validation checklist**

For each entity, require:
- `questions.length === 15`
- `q1_foundation` answered
- `q3_leadership` answered or explicit high-quality `no_signal`
- `q11_decision_owner` answered or explicit blocker rooted in q3 candidate quality
- no `tool_call_missing` on trusted-evidence `q3`

**Step 2: Run Zimbabwe Cricket rerun**

Run from the patched question source or updated normal runner:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat
QUESTION_FIRST_ENABLE_CONNECTIONS_ENRICHMENT=true python3 - <<'PY'
import asyncio, sys
from pathlib import Path
sys.path.insert(0, '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend')
from question_first_dossier_runner import run_question_first_dossier
asyncio.run(run_question_first_dossier(
    question_source_path=Path('/absolute/path/to/zimbabwe-cricket source.json'),
    output_dir=Path('/absolute/path/to/output'),
    opencode_timeout_ms=300000,
))
PY
```

Expected:
- `q1` answered from Wikipedia/official site
- `q3` no longer `tool_call_missing`
- `q11` improves if q3 candidates are available

**Step 3: Run one second obscure federation**

Use a second low-profile federation with weak current people coverage.

Expected:
- same fallback chain works without bespoke entity logic.

**Step 4: Verify canonical API output**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat
curl --max-time 25 -s http://localhost:3005/api/entities/<entity-id>/dossier | jq
```

Expected:
- normalized `terminal_state`
- readable `terminal_summary`
- no hidden `tool_call_missing` for q3 when evidence was found

**Step 5: Commit**

```bash
git add .
git commit -m "feat: make q3 leadership recovery resilient for obscure entities"
```

### Task 7: Regression verification

**Files:**
- No new files required

**Step 1: Run backend dossier runner tests**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -m pytest backend/tests/test_question_first_dossier_runner.py -q
```

Expected: PASS.

**Step 2: Run relevant frontend normalization tests**

Run:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
node --test apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs
```

Expected: PASS.

**Step 3: Run live spot checks**

Check:
- [Zimbabwe dossier API](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tmp/question-first-diagnostics/rollout-proof-20260409/)
- local browser routes under `http://localhost:3005/entity-browser/.../dossier`

Expected:
- q3 renders as a real answer or explicit no-signal with trustworthy reasons,
- q12 reflects connections enrichment status clearly,
- no blank or misleading blocked state caused by hidden parser collapse.

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify antifragile q3 leadership recovery"
```

## Design Rules

- Never treat discovered evidence plus empty parser output as `tool_call_missing` final state.
- Prefer minimal truthful leadership recovery over aspirational guesswork.
- Trust hierarchy for obscure entities:
  - official site
  - wikipedia
  - LinkedIn company/person profile
  - reputable news/press
  - commercial databases only as secondary corroboration
- Keep q3 independent from q12 connections enrichment.
- Connections analysis should enrich routing, not determine whether leadership exists.
- If q3 still ends `no_signal`, the output must explain whether:
  - no trusted sources existed,
  - trusted sources existed but no names/titles were extractable,
  - LinkedIn refinement failed after grounded candidates were found.

