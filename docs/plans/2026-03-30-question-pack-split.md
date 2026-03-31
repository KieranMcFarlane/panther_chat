# Question Pack Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate the system into one canonical dossier question pack and one canonical discovery question pack, then tighten the question wording so each pack does one job well.

**Architecture:** Keep dossier-oriented questions focused on factual grounding, leadership, contactability, and recent context. Keep discovery-oriented questions focused on service fit, procurement intent, budget/timeline, and next-best validation signals. Preserve the existing downstream Graphiti and homepage contracts; only the pack organization and question wording change.

**Tech Stack:** Python, Node.js, JSON artifacts, pytest, node:test

### Task 1: Define the canonical pack roles

**Files:**
- Modify: `apps/signal-noise-app/backend/question_inventory_builder.py`
- Modify: `apps/signal-noise-app/backend/entity_type_dossier_questions.py`
- Modify: `apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_inventory_builder.py` (new)
- Test: `apps/signal-noise-app/backend/tests/test_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py`

**Step 1: Write the failing test**

Add tests that assert:
- `build_question_inventory()` exposes separate `dossier_questions` and `discovery_questions` groups.
- `build_entity_question_pack()` marks its output with a dossier pack role.
- `build_final_ralph_entity_question_pack()` marks its output with a discovery pack role.

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_inventory_builder.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_entity_question_pack.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py -q
```
Expected: FAIL because the split metadata does not exist yet.

**Step 3: Write minimal implementation**

Add the pack role fields and the grouped inventory slices without changing the existing shape for old consumers.

**Step 4: Run test to verify it passes**

Re-run the three pytest commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_inventory_builder.py apps/signal-noise-app/backend/entity_type_dossier_questions.py apps/signal-noise-app/backend/final_ralph_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_inventory_builder.py apps/signal-noise-app/backend/tests/test_entity_question_pack.py apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py
git commit -m "feat(question-packs): separate dossier and discovery roles"
```

### Task 2: Rework dossier questions toward factual grounding

**Files:**
- Modify: `apps/signal-noise-app/backend/entity_type_dossier_questions.py`
- Modify: `apps/signal-noise-app/backend/question_inventory_builder.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_inventory_builder.py`

**Step 1: Write the failing test**

Add tests that assert dossier questions emphasize:
- official name and type
- founding year and headquarters
- venue and website
- leadership and contactability
- recent factual context

and do not introduce discovery-style phrasing like:
- budget
- opportunity fit
- service pitch
- procurement intent

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_entity_question_pack.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_inventory_builder.py -q
```
Expected: FAIL until the wording and categorization are cleaned up.

**Step 3: Write minimal implementation**

Trim or reclassify the dossier prompts so they stay grounded and remove overlap with discovery prompts.

**Step 4: Run test to verify it passes**

Re-run the two pytest commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/entity_type_dossier_questions.py apps/signal-noise-app/backend/question_inventory_builder.py apps/signal-noise-app/backend/tests/test_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_inventory_builder.py
git commit -m "feat(question-packs): tighten dossier grounding"
```

### Task 3: Rework discovery questions toward service-fit validation

**Files:**
- Modify: `apps/signal-noise-app/backend/question_pack_reasoner.py`
- Modify: `apps/signal-noise-app/backend/question_pack_business_reasoner.py`
- Modify: `apps/signal-noise-app/backend/question_pack_final_ralph.py`
- Modify: `apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_final_ralph.py`
- Test: `apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py`

**Step 1: Write the failing test**

Add tests that assert discovery questions:
- ask what changed in the last 90-180 days
- ask whether there is a vendor replacement, platform migration, or relaunch
- ask for explicit budget/timeline windows
- ask for evidence of service fit before recommendation

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_pack_final_ralph.py -q
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py -q
```
Expected: FAIL until the wording is tuned.

**Step 3: Write minimal implementation**

Update the prompt wording and ranking hints to emphasize service-fit validation over generic opportunity language.

**Step 4: Run test to verify it passes**

Re-run the four pytest commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_pack_reasoner.py apps/signal-noise-app/backend/question_pack_business_reasoner.py apps/signal-noise-app/backend/question_pack_final_ralph.py apps/signal-noise-app/backend/final_ralph_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py apps/signal-noise-app/backend/tests/test_question_pack_final_ralph.py apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py
git commit -m "feat(question-packs): optimize discovery prompts"
```

### Task 4: Verify the inventory output still feeds the runtime cleanly

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Modify: `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Test: `apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

**Step 1: Write the failing test**

Add a regression test that confirms the runtime still accepts the dossier pack source and the OpenCode batch still emits the canonical artifact after the split.

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
node --test apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
```
Expected: FAIL if the split breaks the adapter contract.

**Step 3: Write minimal implementation**

Adjust the adapter or inventory consumer only as much as needed to preserve the runtime behavior.

**Step 4: Run test to verify it passes**

Re-run the two commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_first_dossier_runner.py apps/signal-noise-app/scripts/opencode_agentic_batch.mjs apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat(question-packs): keep runtime stable after split"
```
