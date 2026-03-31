# Atomic Discovery Meta-JSON Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split collection from presentation so the system asks atomic general discovery questions, stores structured evidence in meta-json, and only promotes confidence-backed synthesis into the dossier.

**Architecture:** The current final Ralph pack is doing two jobs at once: it defines collection prompts and it acts as the browser-facing question pack. This plan separates those responsibilities into three layers: atomic discovery questions, a canonical `question_first_run_v1` evidence/meta-json artifact, and a dossier synthesis/promoter that decides what to show. Dossier UI should render promoted evidence summaries, not raw discovery prompts.

**Tech Stack:** Python backend question-pack pipeline, `question_first_dossier_runner.py`, local JSON artifacts, Next.js dossier UI, Graphiti signal candidate builder.

## Current State Findings

- [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_pack_final_ralph.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_pack_final_ralph.py) already splits dense sections into smaller prompts, but many prompts are still synthesis-oriented and Yellow Panther-specific.
- [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/final_ralph_entity_question_pack.py) turns the final Ralph pack directly into the browser-facing entity question pack.
- [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-question-pack.ts`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-question-pack.ts) repeats that behavior on the frontend fallback path by mapping the local final Ralph pack straight into UI questions and hypotheses.
- [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py) already has the right persistence seam: the canonical `question_first_run_v1` artifact stores per-question answer state and gets merged into the dossier payload.
- [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py) can already derive a signal candidate from question-first answers, but it currently selects one strongest answer rather than a richer promoted synthesis.

## Target Model

### Layer 1: Atomic Discovery Questions

Atomic discovery questions should be general and evidence-seeking. They should not encode final sales strategy or final dossier wording.

Examples:
- `What mobile apps does {entity} currently operate?`
- `Is there evidence of an app relaunch, replacement, or new platform plan?`
- `What buyer-side role owns mobile, digital, or commercial approvals?`
- `Is there a budget, tender, RFP, procurement, or vendor-change signal?`
- `What dated evidence exists in the last 180 days?`

Rules:
- one claim per question
- one evidence target per question
- one answerable unit per question
- no combined “fit + budget + outreach + recommendation” prompts

### Layer 2: Canonical Evidence Meta-JSON

The `question_first_run_v1` artifact should be the canonical evidence object. Each answer should become structured meta-json, not just a free-text answer blob.

Each answer entry should expose:
- `question_id`
- `question_type`
- `question_text`
- `answer`
- `confidence`
- `validation_state`
- `evidence_url`
- `sources`
- `signal_type`
- `entity_id`
- `entity_uuid` when available
- `observed_at`
- `evidence_window`
- `promotion_candidate`
- `promotion_reason`

Add a normalized evidence layer in the artifact:
- `evidence_items`
- `facts`
- `signals`
- `people`
- `vendors`
- `timing_markers`
- `procurement_markers`

This gives the synthesis layer something deterministic to reason over.

### Layer 3: Dossier Promotion/Synthesis

The dossier should show only promoted, confidence-backed synthesis.

What to show in the dossier:
- factual profile sections
- promoted opportunity signals
- promoted buyer/owner coverage
- promoted timing/procurement windows
- promoted vendor or replacement signals
- promoted outreach implications when enough evidence exists

What not to show directly:
- raw discovery prompts
- low-confidence answers
- speculative recommendations without evidence support
- every answer from the OpenCode run

Promotion rule:
- require confidence threshold
- require usable evidence URL(s)
- require a section mapping
- require one of: procurement signal, timing signal, ownership signal, vendor-change signal, or high-confidence capability gap

## Dossier Display Model

The dossier should be split conceptually into:

1. `Profile`
Factual, stable dossier content:
- identity
- core facts
- leadership names/roles
- venue/competition context

2. `Discovery Summary`
Promoted signals from meta-json:
- active opportunity hypotheses
- procurement timing
- vendor-change evidence
- buyer-side ownership
- recommended next watchpoints

3. `Evidence`
Optional drill-down, not top-level narrative:
- source URLs
- validated answers
- confidence and validation state
- question provenance

The current browser-facing “question pack” should become an operator/debug surface, not the primary dossier content.

## Implementation Sequence

### Task 1: Introduce an atomic discovery pack model

**Files:**
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_pack_final_ralph.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_pack_final_ralph.py)
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/final_ralph_entity_question_pack.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/final_ralph_entity_question_pack.py)
- Create: `apps/signal-noise-app/backend/question_pack_atomic_discovery.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_pack_atomic_discovery.py`

**Step 1: Write the failing test**
- Assert that atomic prompts avoid mixed strategy wording like `recommendation`, `budget/timeline`, `outreach angle`, `success probability`, `YP opportunity`.
- Assert that each prompt maps to one `evidence_focus` and one `promotion_target`.

**Step 2: Run test to verify it fails**

Run:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest apps/signal-noise-app/backend/tests/test_question_pack_atomic_discovery.py -q
```

**Step 3: Write minimal implementation**
- Add a pack builder that transforms final Ralph prompts into atomic discovery questions.
- Add fields like:
  - `pack_role: discovery`
  - `question_shape: atomic`
  - `evidence_focus`
  - `promotion_target`
  - `answer_kind`

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```bash
git add apps/signal-noise-app/backend/question_pack_atomic_discovery.py apps/signal-noise-app/backend/question_pack_final_ralph.py apps/signal-noise-app/backend/final_ralph_entity_question_pack.py apps/signal-noise-app/backend/tests/test_question_pack_atomic_discovery.py
git commit -m "feat(question-packs): add atomic discovery pack model"
```

### Task 2: Extend `question_first_run_v1` into evidence/meta-json

**Files:**
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py)
- Modify: `apps/signal-noise-app/scripts/question_first_run_contract.mjs`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_run_contract.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`

**Step 1: Write the failing test**
- Assert that the run artifact includes normalized `evidence_items`, `facts`, `signals`, and `promotion_candidates`.
- Assert that each answer carries structured metadata, not just free text.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
- Add a post-processing pass in the runner that converts raw answers into structured meta-json.
- Keep the existing artifact schema compatible, but extend it instead of replacing it.

**Step 4: Run the targeted tests**

**Step 5: Commit**
```bash
git add apps/signal-noise-app/backend/question_first_dossier_runner.py apps/signal-noise-app/scripts/question_first_run_contract.mjs apps/signal-noise-app/backend/tests/test_question_first_run_contract.py apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py
git commit -m "feat(question-first): add evidence meta-json to run artifact"
```

### Task 3: Add dossier promotion/synthesis

**Files:**
- Create: `apps/signal-noise-app/backend/question_first_promoter.py`
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py)
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py)
- Test: `apps/signal-noise-app/backend/tests/test_question_first_promoter.py`

**Step 1: Write the failing test**
- Given structured answers, assert the promoter emits:
  - `dossier_promotions`
  - `discovery_summary`
  - `promotion_candidates`
- Assert low-confidence and unsupported answers are excluded.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
- Group answers by `promotion_target`.
- Promote only evidence-backed candidates above threshold.
- Update `graphiti_service` to prefer promoted candidates rather than a single best answer only.

**Step 4: Run tests**

**Step 5: Commit**
```bash
git add apps/signal-noise-app/backend/question_first_promoter.py apps/signal-noise-app/backend/question_first_dossier_runner.py apps/signal-noise-app/backend/graphiti_service.py apps/signal-noise-app/backend/tests/test_question_first_promoter.py
git commit -m "feat(question-first): promote evidence into dossier synthesis"
```

### Task 4: Move the UI from raw pack display to promoted summary display

**Files:**
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-question-pack.ts`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-question-pack.ts)
- Modify: [`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx)
- Modify: relevant dossier presentation components under `apps/signal-noise-app/src/components/entity-dossier/`
- Test: add a dossier render/runtime contract

**Step 1: Write the failing test**
- Assert the dossier renders promoted discovery summaries, not raw final Ralph prompts.
- Assert the raw question pack, if still shown, is clearly secondary/debug-only.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
- Load promoted summary fields from the dossier payload.
- Show:
  - `Opportunity signals`
  - `Decision owners`
  - `Timing/procurement markers`
  - `Supporting evidence count`
- Keep raw evidence behind a drill-down.

**Step 4: Run tests**

**Step 5: Commit**
```bash
git add apps/signal-noise-app/src/lib/entity-question-pack.ts apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/src/components/entity-dossier
git commit -m "feat(dossier): render promoted discovery synthesis"
```

## Testing Strategy

Fast regression:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_inventory_builder.py \
  apps/signal-noise-app/backend/tests/test_question_pack_reasoner.py \
  apps/signal-noise-app/backend/tests/test_question_pack_business_reasoner.py \
  apps/signal-noise-app/backend/tests/test_final_ralph_entity_question_pack.py \
  apps/signal-noise-app/backend/tests/test_entity_question_pack.py \
  -q
```

New evidence/promoter tests:
```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_pack_atomic_discovery.py \
  apps/signal-noise-app/backend/tests/test_question_first_run_contract.py \
  apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py \
  apps/signal-noise-app/backend/tests/test_question_first_promoter.py \
  -q
```

Runtime smoke:
```bash
PYTHONPATH=apps/signal-noise-app python3 apps/signal-noise-app/backend/question_first_dossier_runner.py \
  --question-source /tmp/source.json \
  --output-dir /tmp/qf-out \
  --opencode-timeout-ms 300000
```

Browser smoke:
- open `/entity-browser/[uuid]/dossier`
- verify promoted discovery summaries render
- verify enrichment remains a separate action
- verify raw questions are not the main narrative

## Recommendation

Implement this as a hard separation:
- `atomic discovery pack` for collection
- `question_first_run_v1 meta-json` for evidence
- `promoter/synthesizer` for dossier

Do not keep using the final Ralph prompt list as the browser-facing pack. That coupling is the main reason the dossier, discovery, and procurement concerns are still blurred together.
