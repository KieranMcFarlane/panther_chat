# Discovery Reliability Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve discovery reliability by enforcing structured evaluator outputs, grounding signals to the target entity, and expanding template coverage beyond a single active profile.

**Architecture:** Add a strict evaluator schema gate with a deterministic fallback classifier in `hypothesis_driven_discovery.py`, apply entity-grounding validation before accepting discovered evidence, and extend template catalog with additional club profiles consumed by existing template loading logic. Keep changes minimal and test-first where feasible.

**Tech Stack:** Python 3.13, pytest, Next.js app runtime, BrightData SDK client, Chutes/OpenAI-compatible LLM endpoint.

### Task 1: Hard schema gate + deterministic fallback classifier
- Modify: `backend/hypothesis_driven_discovery.py`
- Test: `backend/tests/test_discovery_empty_scrape_guards.py`
- Steps: enforce strict parse path; on parse miss, auto-retry once with JSON contract; if still invalid, run deterministic classifier producing one of ACCEPT/WEAK_ACCEPT/REJECT/NO_PROGRESS.

### Task 2: Entity-grounding filter for league-level spillover
- Modify: `backend/hypothesis_driven_discovery.py`
- Test: `backend/tests/test_discovery_empty_scrape_guards.py` (or add new focused test)
- Steps: add source-to-entity grounding check; demote/reject signals where source primarily references governing body/league and lacks target entity grounding.

### Task 3: Broaden template coverage
- Modify: `backend/bootstrapped_templates/production_templates.json`
- Steps: add additional profile templates (mid-tier club and federation-style centralized procurement) with explicit `template_id` and differentiated signal patterns.

### Task 4: Validate and smoke
- Run: `PYTHONPATH=backend pytest -q backend/tests/test_claude_client_chutes.py backend/tests/test_discovery_empty_scrape_guards.py backend/tests/test_pipeline_degraded_mode.py backend/tests/test_pipeline_discovery_timeout.py`
- Run: bounded discovery smoke for Coventry (`max_iterations=6`) and record artifact path + confidence/signal deltas.

### Task 5: Commit
- Commit with message describing reliability hardening.
