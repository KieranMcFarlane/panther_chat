# Unbounded Shadow Policy Rollout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert unbounded-shadow learnings into deterministic, production-safe policies that improve source quality, confidence depth, and throughput while preserving hard gate reliability.

**Architecture:** Introduce a policy layer between search output and scrape/evaluator steps. Keep exploration broad, but force deterministic URL quality filtering, rendered scrape escalation, and evidence contracts before confidence is upgraded. Add stronger run telemetry and quota-aware scheduling so the pipeline runs continuously without silent degradation.

**Tech Stack:** Python 3.11, BrightData SDK + request API, Chutes/OpenAI-compatible client, pytest, shell regression scripts, JSON run reports.

### Task 1: Codify URL lane policy from shadow learnings

**Files:**
- Create: `backend/discovery_url_policy.py`
- Modify: `backend/hypothesis_driven_discovery.py`
- Test: `backend/tests/test_discovery_url_resolution_fallbacks.py`

**Step 1: Write the failing test**

```python
def test_policy_rejects_known_low_yield_routes_for_official_hops():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://www.ccfc.co.uk/procurement",
        hop_type="rfp_page",
        entity_name="Coventry City FC",
        title="",
        snippet="",
    )
    assert decision.allow is False
    assert decision.reason == "known_low_yield_route"
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_discovery_url_resolution_fallbacks.py::test_policy_rejects_known_low_yield_routes_for_official_hops -v`
Expected: FAIL because policy module/class does not exist yet.

**Step 3: Write minimal implementation**

```python
@dataclass
class UrlPolicyDecision:
    allow: bool
    reason: str

class DiscoveryUrlPolicy:
    LOW_YIELD_PATHS = {"/", "/about", "/procurement", "/news"}
    def evaluate(self, *, url: str, hop_type: str, entity_name: str, title: str, snippet: str) -> UrlPolicyDecision:
        # block path-only shell routes for high-value hops; allow deep pages
```

**Step 4: Wire policy into URL selection path**

- Call policy before candidate scoring in `_get_url_for_hop`.
- Persist reject reason into diagnostics for observability.

**Step 5: Run tests**

Run: `pytest backend/tests/test_discovery_url_resolution_fallbacks.py -q`
Expected: PASS.

**Step 6: Commit**

```bash
git add backend/discovery_url_policy.py backend/hypothesis_driven_discovery.py backend/tests/test_discovery_url_resolution_fallbacks.py
git commit -m "feat: add deterministic url lane policy from shadow runs"
```

### Task 2: Enforce rendered scrape escalation for JS-heavy/low-signal pages

**Files:**
- Modify: `backend/brightdata_sdk_client.py`
- Modify: `backend/hypothesis_driven_discovery.py`
- Test: `backend/tests/test_discovery_empty_scrape_guards.py`

**Step 1: Write failing tests**

```python
def test_low_signal_shell_forces_render_escalation_before_no_progress():
    # simulate empty/basic html first pass; expect render path to execute
```

**Step 2: Run to verify fail**

Run: `pytest backend/tests/test_discovery_empty_scrape_guards.py::test_low_signal_shell_forces_render_escalation_before_no_progress -v`
Expected: FAIL.

**Step 3: Implement minimal logic**

- In BrightData client, add deterministic escalation order:
  1) SDK direct scrape
  2) request API rendered scrape
  3) fallback HTTP only as final telemetry path
- In discovery, require one rendered attempt on high-value hops before `NO_PROGRESS` if content is low-yield.

**Step 4: Verify**

Run: `pytest backend/tests/test_discovery_empty_scrape_guards.py -q`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/brightdata_sdk_client.py backend/hypothesis_driven_discovery.py backend/tests/test_discovery_empty_scrape_guards.py
git commit -m "feat: enforce rendered escalation for low-signal pages"
```

### Task 3: Add source-quality acceptance contract per hop

**Files:**
- Modify: `backend/hypothesis_driven_discovery.py`
- Modify: `backend/pipeline_run_metadata.py`
- Test: `backend/tests/test_discovery_progress_reporting.py`

**Step 1: Write failing tests**

```python
def test_no_confidence_uplift_without_grounded_evidence_payload():
    # decision ACCEPT without evidence payload should be downgraded
```

**Step 2: Implement**

- Add `evidence_payload` requirements (domain grounding, quoted facts, source URL, recency marker).
- Downgrade `ACCEPT`/`WEAK_ACCEPT` to `NO_PROGRESS` if payload invalid.

**Step 3: Verify**

Run: `pytest backend/tests/test_discovery_progress_reporting.py -q`
Expected: PASS.

**Step 4: Commit**

```bash
git add backend/hypothesis_driven_discovery.py backend/pipeline_run_metadata.py backend/tests/test_discovery_progress_reporting.py
git commit -m "feat: require grounded evidence contract for confidence uplift"
```

### Task 4: Strengthen leadership denoise and pre-linkedin gating

**Files:**
- Modify: `backend/dossier_data_collector.py`
- Modify: `backend/dossier_generator.py`
- Test: `backend/tests/test_leadership_fallback_denoise.py`

**Step 1: Write failing tests**

```python
def test_leadership_denoise_rejects_non_person_phrases_before_linkedin():
    # "Promotions Jobs Singapore" should be blocked
```

**Step 2: Implement**

- Add stricter person-shape regex and blocked phrase list.
- Require role proximity and dedupe before LinkedIn search calls.

**Step 3: Verify**

Run: `pytest backend/tests/test_leadership_fallback_denoise.py -q`
Expected: PASS.

**Step 4: Commit**

```bash
git add backend/dossier_data_collector.py backend/dossier_generator.py backend/tests/test_leadership_fallback_denoise.py
git commit -m "fix: tighten leadership denoise before linkedin enrichment"
```

### Task 5: Keep bounded runtime while preserving section yield

**Files:**
- Modify: `backend/dossier_data_collector.py`
- Modify: `scripts/run-pipeline-regression-batch.sh`
- Test: `backend/tests/test_dossier_data_collector_seed.py`

**Step 1: Write failing test**

```python
def test_timeout_caps_do_not_starve_high_yield_sections():
    # ensures selective cap overrides, not blanket truncation
```

**Step 2: Implement**

- Keep per-section cap overrides.
- Raise caps for historically high-yield sections where needed.
- Add env defaults in regression script for reproducible runtime profile.

**Step 3: Verify**

Run: `pytest backend/tests/test_dossier_data_collector_seed.py -q`
Expected: PASS.

**Step 4: Commit**

```bash
git add backend/dossier_data_collector.py scripts/run-pipeline-regression-batch.sh backend/tests/test_dossier_data_collector_seed.py
git commit -m "perf: tune section timeout policy to preserve yield"
```

### Task 6: Promote observability to first-class release gate input

**Files:**
- Modify: `run_fixed_dossier_pipeline.py`
- Modify: `scripts/run-pipeline-regression-batch.sh`
- Create: `scripts/assert_regression_gate.py`
- Test: `backend/tests/test_regression_batch_script_contract.py`

**Step 1: Write failing contract tests**

```python
def test_regression_summary_includes_failure_taxonomy_and_parse_path():
    # ensure metrics are present and typed
```

**Step 2: Implement**

- Ensure summary rows always include: `final_confidence`, `signals_discovered`, `llm_last_status`, `parse_path`, taxonomy counters.
- Add gate assertion script:
  - pass_rate >= 2/3
  - import_context_failure == 0
  - no `signals_discovered=0` unless explicit low-signal cause.

**Step 3: Verify**

Run:
- `pytest backend/tests/test_regression_batch_script_contract.py -q`
- `python3 scripts/assert_regression_gate.py --summary backend/data/dossiers/run_reports/regression_batch_<latest>.json`

Expected: PASS.

**Step 4: Commit**

```bash
git add run_fixed_dossier_pipeline.py scripts/run-pipeline-regression-batch.sh scripts/assert_regression_gate.py backend/tests/test_regression_batch_script_contract.py
git commit -m "feat: add regression gate assertions and enriched summary telemetry"
```

### Task 7: Add quota-aware continuous runner (unbounded-informed, production-safe)

**Files:**
- Create: `scripts/run-continuous-pipeline.sh`
- Create: `docs/ops/continuous-runner.md`
- Modify: `.env.example` (or ops env docs)

**Step 1: Implement scheduler logic**

- Daily cycle aware of Chutes quota usage and window resets.
- Retry/backoff policy: 5 attempts with exponential backoff + jitter before fallback.
- Resume from cursor when quota/time window reached.

**Step 2: Add dry-run and guardrails**

- `--dry-run` mode prints entity queue decisions.
- hard stop on repeated systemic failures.

**Step 3: Verify**

Run: `bash scripts/run-continuous-pipeline.sh --dry-run`
Expected: prints bounded execution plan and quota checks.

**Step 4: Commit**

```bash
git add scripts/run-continuous-pipeline.sh docs/ops/continuous-runner.md .env.example
git commit -m "feat: add quota-aware continuous pipeline runner"
```

### Task 8: Release gate and rollout sequence

**Files:**
- Modify: `.github/workflows/*` (if present)
- Modify: `docs/plans/2026-03-19-unbounded-shadow-policy-rollout.md` (checklist updates)

**Step 1: Add CI lane for bounded 3-entity gate**

- Run targeted tests + regression batch + gate assertion.
- Fail pipeline on gate miss.

**Step 2: Execute rollout**

1) Run batch twice consecutively.
2) Confirm both satisfy gate policy.
3) Promote to `main` only after dual pass.

**Step 3: Verify**

Run twice:
- `./scripts/run-pipeline-regression-batch.sh 1800`
- `python3 scripts/assert_regression_gate.py --summary <summary-file>`

Expected: both batches pass; no import-context failures; no unexplained zero-signal runs.

**Step 4: Commit**

```bash
git add .github/workflows docs/plans/2026-03-19-unbounded-shadow-policy-rollout.md
git commit -m "chore: enforce production regression gate in ci"
```

## Final Validation Checklist

- `pytest backend/tests/test_discovery_url_resolution_fallbacks.py -q`
- `pytest backend/tests/test_discovery_empty_scrape_guards.py -q`
- `pytest backend/tests/test_dossier_data_collector_seed.py -q`
- `pytest backend/tests/test_leadership_fallback_denoise.py -q`
- `./scripts/run-pipeline-regression-batch.sh 1800`
- `python3 scripts/assert_regression_gate.py --summary backend/data/dossiers/run_reports/regression_batch_<latest>.json`

## Success Criteria

- Two consecutive bounded batches pass hard gate (`>=2/3`, target `3/3`).
- No dossier-context crash fallback paths.
- Reduced low-yield looping on known shell routes.
- Leadership extraction precision improved (fewer noisy false positives).
- Run summaries include full telemetry for tuning and audit.
