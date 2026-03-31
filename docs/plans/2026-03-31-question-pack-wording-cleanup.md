# Question Pack Wording Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten the split question packs so dossier prompts stay factual and discovery prompts stay procurement- and service-fit-oriented.

**Architecture:** Keep the existing dossier/discovery split intact. Adjust wording and ranking hints only where a question clearly belongs in the wrong semantic bucket. Preserve runtime adapters, pack shapes, and emitted metadata so the downstream browser and reasoner contracts remain stable.

**Tech Stack:** Python, pytest, node:test, JSON artifacts

### Task 1: Tighten dossier wording

**Files:**
- Modify: `apps/signal-noise-app/backend/entity_type_dossier_questions.py`
- Modify: `apps/signal-noise-app/backend/question_inventory_builder.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_inventory_builder.py`

**Step 1: Write the failing test**

Add assertions that dossier questions emphasize:
- official name and type
- founding year and headquarters
- venue and website
- leadership and contactability
- recent factual context

and do not use discovery-style phrasing like:
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
Expected: FAIL until the dossier wording is cleaned up.

**Step 3: Write minimal implementation**

Trim or reclassify dossier prompts so they only ask for factual grounding and operator context.

**Step 4: Run test to verify it passes**

Re-run the two pytest commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/entity_type_dossier_questions.py apps/signal-noise-app/backend/question_inventory_builder.py apps/signal-noise-app/backend/tests/test_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_inventory_builder.py
git commit -m "feat(question-packs): tighten dossier grounding"
```

### Task 2: Tighten discovery wording

**Files:**
- Modify: `apps/signal-noise-app/backend/question_pack_reasoner.py`
- Modify: `apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_final_ralph.py`
- Test: `apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py`

**Step 1: Write the failing test**

Add assertions that discovery questions:
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
Expected: FAIL until the discovery wording is tuned.

**Step 3: Write minimal implementation**

Update the prompt wording and ranking hints to emphasize signal validation over generic opportunity language.

**Step 4: Run test to verify it passes**

Re-run the four pytest commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_pack_reasoner.py apps/signal-noise-app/backend/final_ralph_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py apps/signal-noise-app/backend/tests/test_question_pack_final_ralph.py apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py
git commit -m "feat(question-packs): optimize discovery prompts"
```

### Task 3: Verify runtime adapters still work

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Modify: `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Test: `apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

**Step 1: Write the failing test**

Add a regression test that confirms the runtime still accepts the dossier pack source and the OpenCode batch still emits the canonical artifact after the wording cleanup.

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
node --test apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
```
Expected: FAIL if the wording cleanup breaks the adapter contract.

**Step 3: Write minimal implementation**

Adjust the adapter or inventory consumer only as much as needed to preserve runtime behavior.

**Step 4: Run test to verify it passes**

Re-run the two commands above.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/question_first_dossier_runner.py apps/signal-noise-app/scripts/opencode_agentic_batch.mjs apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat(question-packs): keep runtime stable after wording cleanup"
```
