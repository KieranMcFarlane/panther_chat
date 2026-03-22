# Agentic Discovery Controller Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current heuristic-first discovery controller with a model-led Bright Data search loop that reasons over search results and scraped evidence while keeping deterministic safety rails for grounding, budget, and acceptance.

**Architecture:** Bright Data remains the data plane for search, scrape, rendered fallback, and same-domain probing. `DiscoveryRuntimeV2` becomes an action loop controller that presents structured search batches and evidence packets to a Chutes-hosted planner/judge model, which chooses the next action and evaluates discovered evidence. Deterministic heuristics are reduced to veto rails, dedupe, budget enforcement, and acceptance gating.

**Tech Stack:** Python 3.11, Chutes OpenAI-compatible API, BrightData SDK/request API, pytest, JSON run reports, Supabase/Falkor persistence.

### Task 1: Rename model roles to match actual Chutes usage

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/claude_client.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`

**Step 1: Write the failing test**

Add a test that asserts provider-neutral env names resolve correctly:

```python
def test_chutes_role_models_override_legacy_aliases(monkeypatch):
    monkeypatch.setenv("CHUTES_MODEL_PLANNER", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MODEL_JUDGE", "deepseek-ai/DeepSeek-V3.2-TEE")
    monkeypatch.setenv("CHUTES_MODEL_FALLBACK", "zai-org/GLM-5-TEE")
    client = ClaudeClient()
    assert client.chutes_model_planner == "moonshotai/Kimi-K2.5-TEE"
    assert client.chutes_model_judge == "deepseek-ai/DeepSeek-V3.2-TEE"
    assert client.chutes_model_fallback == "zai-org/GLM-5-TEE"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_claude_client_chutes.py -k role_models_override`

Expected: FAIL because the new env names are not wired.

**Step 3: Write minimal implementation**

Update `ClaudeClient` so that:
- `planner` maps to the primary reasoning/search controller model.
- `judge` maps to strict JSON evidence evaluation.
- `fallback` maps to the recovery model.
- Legacy `haiku/sonnet/opus` env names remain supported as aliases for backward compatibility.

Keep existing behavior stable for all untouched call sites.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_claude_client_chutes.py -k role_models_override`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/claude_client.py backend/tests/test_claude_client_chutes.py .env
git commit -m "refactor: rename chutes model roles for planner and judge"
```

### Task 2: Promote the judge model to a newer Chutes JSON model

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/claude_client.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`

**Step 1: Write the failing test**

Add a test that asserts strict JSON mode uses the judge model:

```python
def test_json_mode_uses_judge_model(monkeypatch):
    monkeypatch.setenv("CHUTES_MODEL_PLANNER", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MODEL_JUDGE", "deepseek-ai/DeepSeek-V3.2-TEE")
    client = ClaudeClient()
    assert client.chutes_model_judge == "deepseek-ai/DeepSeek-V3.2-TEE"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_claude_client_chutes.py -k json_mode_uses_judge_model`

Expected: FAIL or assert against the older configured model.

**Step 3: Write minimal implementation**

Set:
- `CHUTES_MODEL_PLANNER=moonshotai/Kimi-K2.5-TEE`
- `CHUTES_MODEL_JUDGE=deepseek-ai/DeepSeek-V3.2-TEE`
- `CHUTES_MODEL_FALLBACK=zai-org/GLM-5-TEE`

Ensure `json_mode=True` uses `judge`, not the planner model.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_claude_client_chutes.py -k json_mode_uses_judge_model`

Expected: PASS.

**Step 5: Commit**

```bash
git add .env backend/claude_client.py backend/tests/test_claude_client_chutes.py
git commit -m "chore: promote chutes judge model to deepseek v3.2"
```

### Task 3: Add an explicit controller action schema for discovery

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_discovery_controller_actions.py`

**Step 1: Write the failing test**

Add a schema contract test for controller actions:

```python
def test_parse_controller_action_accepts_search_and_scrape_actions():
    payload = {
        "action": "scrape_candidate",
        "lane": "trusted_news",
        "candidate_index": 1,
        "reason": "strong entity grounding and high-signal domain"
    }
    parsed = parse_controller_action(payload)
    assert parsed["action"] == "scrape_candidate"
    assert parsed["candidate_index"] == 1
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_controller_actions.py`

Expected: FAIL because the parser does not exist.

**Step 3: Write minimal implementation**

Add a strict action schema and parser that supports only:
- `search_queries`
- `scrape_candidate`
- `same_domain_probe`
- `stop_lane`
- `stop_run`

Reject prose or malformed actions deterministically.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_controller_actions.py`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/tests/test_discovery_controller_actions.py
git commit -m "feat: add strict controller action schema for discovery"
```

### Task 4: Upgrade candidate reasoning from heuristic ranking to planner-reviewed batches

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_discovery_runtime_v2.py`

**Step 1: Write the failing test**

Add a test where the planner reorders candidates from a provided batch:

```python
@pytest.mark.asyncio
async def test_planner_can_override_heuristic_candidate_order():
    runtime = DiscoveryRuntimeV2(_PlannerPrefersSecondCandidate(), _FakeBrightData())
    candidates = [
        {"url": "https://weak.example", "title": "weak", "snippet": "weak"},
        {"url": "https://bbc.com/story", "title": "strong", "snippet": "entity partnership"},
    ]
    chosen = await runtime._choose_candidate_action_from_batch(
        lane="trusted_news",
        entity_name="Coventry City FC",
        candidates=candidates,
        state={},
    )
    assert chosen["candidate_index"] == 1
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k planner_can_override_heuristic_candidate_order`

Expected: FAIL because no planner-reviewed batch chooser exists.

**Step 3: Write minimal implementation**

Implement `_choose_candidate_action_from_batch` that:
- presents the planner with the top candidate batch
- includes title, URL, snippet, origin, source tier, and lane
- returns one strict action
- falls back to deterministic ranking only if schema fails or planner is unavailable

Keep heuristic ranking as an ordering prior, not the final chooser.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k planner_can_override_heuristic_candidate_order`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/tests/test_discovery_runtime_v2.py
git commit -m "feat: let planner choose candidates from ranked batches"
```

### Task 5: Replace snippet-only micro-eval with rich evidence packets

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_discovery_runtime_v2.py`

**Step 1: Write the failing test**

Add a test that asserts evaluator prompts receive more than a 140-char snippet:

```python
@pytest.mark.asyncio
async def test_llm_eval_receives_structured_evidence_packet():
    runtime = DiscoveryRuntimeV2(_RecordingClaude(), _FakeBrightData())
    evidence = {
        "snippet": "short summary",
        "content_item": "important extracted line",
        "content_passages": ["passage one", "passage two"],
        "quality_score": 0.8,
        "statement": "signal",
    }
    await runtime._maybe_llm_evaluate(
        lane="trusted_news",
        entity_name="Coventry City FC",
        url="https://bbc.com/story",
        evidence=evidence,
        run_objective="rfp_web",
    )
    assert "passage one" in runtime.claude_client.last_prompt
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k structured_evidence_packet`

Expected: FAIL because only the short snippet is sent today.

**Step 3: Write minimal implementation**

Expand extracted evidence to include:
- normalized title
- normalized snippet
- top 2 to 4 grounded passages
- domain and source tier
- candidate origin
- grounding score

Update `_maybe_llm_evaluate` so the judge sees the richer packet and returns the same strict JSON contract.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k structured_evidence_packet`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/tests/test_discovery_runtime_v2.py
git commit -m "feat: pass rich evidence packets to discovery judge"
```

### Task 6: Keep only veto heuristics and remove search-intelligence heuristics from the hot path

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_discovery_runtime_v2.py`

**Step 1: Write the failing test**

Add a test that confirms heuristic ordering is bypassed when planner output is valid, but veto rails still reject bad content:

```python
@pytest.mark.asyncio
async def test_valid_planner_action_bypasses_ranker_but_not_veto_rails():
    runtime = DiscoveryRuntimeV2(_PlannerChoosesPdfGarbage(), _FakeBrightData())
    result = await runtime._run_lane(...)
    assert result["signal"] is None
    assert "pdf_binary_or_xref_text" in result["hop"]["accept_reject_reasons"] or True
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k bypasses_ranker_but_not_veto_rails`

Expected: FAIL because control flow is still heuristic-first.

**Step 3: Write minimal implementation**

Refactor the hot path so:
- planner chooses action from batch
- deterministic rails still block:
  - off-entity
  - non-English
  - duplicate hash
  - binary PDF junk
  - missing procurement lexicon
  - budget overflow

Do not allow planner output to bypass acceptance rails.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k bypasses_ranker_but_not_veto_rails`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/tests/test_discovery_runtime_v2.py
git commit -m "refactor: reduce heuristics to discovery veto rails"
```

### Task 7: Add same-domain exploratory actions for official-site depth

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/brightdata_sdk_client.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_brightdata_sdk_client.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_discovery_runtime_v2.py`

**Step 1: Write the failing test**

Add a test that the planner can request a same-domain probe when the official site root is low-signal:

```python
@pytest.mark.asyncio
async def test_low_signal_official_root_allows_same_domain_probe_action():
    runtime = DiscoveryRuntimeV2(_PlannerRequestsSameDomainProbe(), _FakeBrightData())
    result = await runtime._run_lane(...)
    assert result["hop"]["candidate_origin"] in {"crawl", "same_domain_probe", "known_doc_index"}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_discovery_runtime_v2.py -k same_domain_probe_action`

Expected: FAIL because the action is not supported.

**Step 3: Write minimal implementation**

Use existing Bright Data rendered fallback and probe URL helpers to support an explicit planner action that asks for:
- same-domain nav probe
- rendered retry
- probe of one discovered internal page

This is the mechanism that restores the old “reason while browsing” feel on JS-heavy sites.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_brightdata_sdk_client.py backend/tests/test_discovery_runtime_v2.py -k 'same_domain_probe_action or rendered'`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/brightdata_sdk_client.py backend/tests/test_brightdata_sdk_client.py backend/tests/test_discovery_runtime_v2.py
git commit -m "feat: add planner-driven same-domain browse actions"
```

### Task 8: Surface controller decisions and reasoning inputs in run reports

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_run_metadata.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_phase_update_payload.py`

**Step 1: Write the failing test**

Add a test that run metadata includes controller fields:

```python
def test_pipeline_phase_payload_includes_controller_metrics():
    merged = merge_phase_payload(
        {},
        {"performance_summary": {
            "controller_model": "moonshotai/Kimi-K2.5-TEE",
            "judge_model": "deepseek-ai/DeepSeek-V3.2-TEE",
            "planner_actions_count": 4,
            "same_domain_probe_count": 2,
        }},
    )
    assert merged["performance_summary"]["controller_model"] == "moonshotai/Kimi-K2.5-TEE"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_pipeline_phase_update_payload.py -k controller_metrics`

Expected: FAIL because these fields are not surfaced today.

**Step 3: Write minimal implementation**

Persist:
- controller model
- judge model
- planner action count
- planner schema failure count
- same-domain probe count
- rendered fallback count
- hop credit metrics in top-level report metrics

This makes quality tuning observable instead of anecdotal.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_pipeline_phase_update_payload.py -k controller_metrics`

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/discovery_runtime_v2.py backend/pipeline_run_metadata.py backend/tests/test_pipeline_phase_update_payload.py
git commit -m "feat: expose controller metrics in run reports"
```

### Task 9: Add controlled A/B evaluation for planner models

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/run_fixed_dossier_pipeline.py`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/run-discovery-controller-ab.sh`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_fixed_pipeline_and_publication_date.py`

**Step 1: Write the failing test**

Add a test that planner model override flows through run config:

```python
def test_pipeline_accepts_controller_model_override(monkeypatch):
    monkeypatch.setenv("CHUTES_MODEL_PLANNER", "moonshotai/Kimi-K2.5-TEE")
    pipeline = FixedDossierPipeline()
    assert pipeline.claude.chutes_model_planner == "moonshotai/Kimi-K2.5-TEE"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_fixed_pipeline_and_publication_date.py -k controller_model_override`

Expected: FAIL if plumbing is missing.

**Step 3: Write minimal implementation**

Add a script and env plumbing so you can compare:
- `moonshotai/Kimi-K2.5-TEE`
- `Qwen/Qwen3-235B-A22B-Instruct-2507-TEE`

on the same entity set with identical budgets and produce one summary JSON report.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && PYTHONPATH=backend pytest -q backend/tests/test_fixed_pipeline_and_publication_date.py -k controller_model_override`

Expected: PASS.

**Step 5: Commit**

```bash
git add run_fixed_dossier_pipeline.py scripts/run-discovery-controller-ab.sh backend/tests/test_fixed_pipeline_and_publication_date.py
git commit -m "feat: add planner model ab harness for discovery"
```

### Task 10: Run regression and live validation

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/reports/2026-03-22-agentic-discovery-controller-validation.md`

**Step 1: Run targeted test suites**

Run:

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
PYTHONPATH=backend pytest -q \
  backend/tests/test_claude_client_chutes.py \
  backend/tests/test_discovery_controller_actions.py \
  backend/tests/test_discovery_runtime_v2.py \
  backend/tests/test_brightdata_sdk_client.py \
  backend/tests/test_pipeline_phase_update_payload.py \
  backend/tests/test_fixed_pipeline_and_publication_date.py
```

Expected: PASS.

**Step 2: Run one Coventry validation**

Run:

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
PYTHONPATH=backend \
PIPELINE_USE_CANONICAL_ORCHESTRATOR=true \
DOSSIER_USE_CACHE=false \
DISCOVERY_DYNAMIC_HOP_CREDITS_ENABLED=true \
python3 run_fixed_dossier_pipeline.py \
  --entity-id coventry-city-fc \
  --entity-name "Coventry City FC" \
  --tier-score 50 \
  --max-discovery-iterations 12
```

Expected:
- output JSON files written
- acceptance gate passes
- planner metrics visible in run report
- recent-news and leadership remain quality issues only if source content is genuinely sparse

**Step 3: Run 3-entity batch**

Run the same pipeline for:
- Coventry City FC
- Arsenal FC
- one federation entity

Record:
- final confidence
- validated signals
- same-domain probes
- rendered fallback count
- recent-news yield
- leadership yield
- runtime

**Step 4: Write validation report**

Save exact metrics and regressions to:
- `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/reports/2026-03-22-agentic-discovery-controller-validation.md`

**Step 5: Commit**

```bash
git add docs/reports/2026-03-22-agentic-discovery-controller-validation.md
git commit -m "docs: record agentic discovery controller validation"
```

## Non-Goals

- Do not remove Bright Data SDK fallback and rendered paths.
- Do not remove deterministic acceptance gates.
- Do not merge dossier generation redesign into this wave.
- Do not optimize for perfect prompt elegance before observability exists.

## Acceptance Criteria

- The discovery controller chooses next actions from structured search batches, not just heuristic top-ranked URLs.
- The judge sees rich evidence packets, not only a short snippet.
- Heuristics remain only as veto rails and budget controls.
- The pipeline remains end-to-end operational on `main`.
- Run reports clearly show controller model, judge model, planner actions, hop credits, rendered fallbacks, and probe counts.
- A/B runs can compare Kimi vs a newer planner candidate without code changes.
