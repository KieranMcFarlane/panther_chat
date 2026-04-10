# q1-q3 Tuning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase validated outputs for `q1_foundation`, `q2_launch_signal`, and `q3_procurement_signal` by tuning source priority, query variants, and validation boundaries without changing the meaning of the questions.

**Architecture:** Keep the questions atomic and keep `no_signal` as a valid terminal state. Improve the search layer underneath the questions: widen the retrieval surface, separate strict proof from broad discovery where needed, and adjust evidence scoring only where it helps the runner distinguish weak candidate answers from true signal. Do not change `q4_decision_owner` or `q5_related_pois` in this pass.

**Tech Stack:** Python, Node.js, pytest, node:test, BrightData-backed retrieval, OpenCode batch runner, canonical question matrix JSON.

### Task 1: Tune q1_foundation for authoritative identity coverage

**Files:**
- Modify: `apps/signal-noise-app/backend/universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py`

**Step 1: Write the failing test**

Add or tighten assertions that `q1_foundation` prefers authoritative identity sources in this order:
- `google_serp`
- `official_site`
- `wikipedia`

Also assert that `q1_foundation` accepts multiple factual identity forms as valid evidence:
- founded year
- founded date
- official about/profile page
- league or registry profile

**Step 2: Run test to verify it fails**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py -q`

Expected:
Fail on the new q1 assertions until the matrix is updated.

**Step 3: Write minimal implementation**

Update the q1 source ordering and keep the question wording unchanged. If the current validation logic is too strict, relax it only enough to accept the identity evidence forms above.

**Step 4: Run test to verify it passes**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py -q`

Expected:
Pass with no regressions in q2 or q3.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/universal_atomic_matrix.py apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py
git commit -m "feat(question-first): tune q1 foundation identity coverage"
```

### Task 2: Tune q2_launch_signal for broader launch discovery

**Files:**
- Modify: `apps/signal-noise-app/backend/universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Modify: `apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

**Step 1: Write the failing test**

Assert that q2 uses launch-oriented query variants underneath the same atomic question:
- public app
- product
- digital platform
- mobile app
- replacement
- fan platform

Also assert that a named platform or product announcement can validate q2 even when the exact word "launch" is absent.

**Step 2: Run test to verify it fails**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py -q`

Run:
`node --test --test-name-pattern='buildOpenCodeQuestionPrompt specializes decision-owner and related-pois outputs|runOpenCodeQuestionSourceBatch preserves decision-owner primary owner and supporting candidates' apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

Expected:
At least one q2-related assertion fails until the broader wording and validation path are in place.

**Step 3: Write minimal implementation**

Keep q2 atomic. Broaden only the search/query variants, not the question itself. Preserve the same terminal states, but accept stronger platform/product evidence as a valid q2 signal.

**Step 4: Run test to verify it passes**

Run the same Python and Node commands again.

Expected:
Pass without weakening the validation bar so much that generic launch chatter starts validating.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/universal_atomic_matrix.py apps/signal-noise-app/scripts/opencode_agentic_batch.mjs apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat(question-first): broaden q2 launch discovery"
```

### Task 3: Tune q3_procurement_signal for broad discovery plus strict RFP fallback

**Files:**
- Modify: `apps/signal-noise-app/backend/universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Modify: `apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json`
- Modify: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

**Step 1: Write the failing test**

Add assertions that q3 discovery starts broad and can validate on any of these evidence types:
- named supplier
- procurement language
- vendor selection announcement
- LinkedIn post from the org or a staff member
- job post mentioning procurement or platform migration
- vendor case study or partner page

Also assert that a separate strict explicit-RFP path still exists for document-level proof:
- PDF
- tender page
- procurement page
- invitation to tender

**Step 2: Run test to verify it fails**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py -q`

Run:
`node --test --test-name-pattern='buildOpenCodeQuestionPrompt specializes decision-owner and related-pois outputs|runOpenCodeQuestionSourceBatch preserves decision-owner primary owner and supporting candidates' apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

Expected:
The new q3 assertions should fail until the broad discovery path and the explicit-RFP fallback are separated cleanly.

**Step 3: Write minimal implementation**

Keep q3 as the broad procurement discovery question. Put the strict formal RFP check behind a separate explicit-RFP path or separate strict query bundle. Do not make q3 depend only on exact tender documents.

**Step 4: Run test to verify it passes**

Run the same Python and Node commands again.

Expected:
Pass with q3 surfacing candidate procurement evidence more often, while the explicit-RFP path stays strict.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/universal_atomic_matrix.py apps/signal-noise-app/scripts/opencode_agentic_batch.mjs apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat(question-first): tune q3 procurement discovery"
```

### Task 4: Rerun the archetype smoke and compare validated vs no_signal results

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
- Modify: `apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py`
- Modify: `apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py`

**Step 1: Write the failing test**

Add a smoke assertion that records per-question validated and no_signal counts for Arsenal, ICF, and MLC after the q1-q3 tuning changes.

**Step 2: Run test to verify it fails**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py -q`

Expected:
The smoke test should fail or be incomplete until the tuned matrix is rerun and the results are recorded.

**Step 3: Write minimal implementation**

Run the serial archetype smoke with the tuned q1-q3 matrix and capture the resulting validated/no_signal breakdown in the output summary.

**Step 4: Run test to verify it passes**

Run:
`PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py -q`

Expected:
Pass with the updated performance summary in place.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_first_archetype_smoke.py apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py
git commit -m "feat(question-first): record q1-q3 tuning smoke results"
```

## Success Criteria

- `q1_foundation` validates more consistently on Arsenal, ICF, and MLC without weakening factual correctness.
- `q2_launch_signal` surfaces named products/platforms more often and validates on real launch evidence.
- `q3_procurement_signal` surfaces procurement candidates more often, while a separate strict RFP path stays strict.
- The serial archetype smoke shows a measurable improvement in validated outputs for q1-q3.
- `no_signal` remains valid, but fewer of the missed cases are due to overly narrow retrieval shape.
