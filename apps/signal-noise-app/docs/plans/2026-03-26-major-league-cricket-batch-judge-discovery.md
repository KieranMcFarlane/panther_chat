# Major League Cricket Batch Judge Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a question-first batch runner that freezes premium questions, runs one BrightData MCP query per question, judges each result into structured JSON, and proves the flow on Major League Cricket.

**Architecture:** The runner will stay outside the main pipeline and operate as a dedicated smoke/ops tool. It will load premium questions from the Yellow Panther catalog, derive procurement-focused query plans, search through direct hosted BrightData MCP, rank returned results before scraping, and pass evidence to `ClaudeClient(model="judge")` for structured JSON judgment. Results will be written per question plus one rollup file so the artifacts can feed later pipeline stages without coupling the retrieval loop to dossier generation.

**Tech Stack:** Python 3.11, BrightData MCP client, ClaudeClient judge path, Yellow Panther catalog helpers, JSON/markdown persistence, pytest.

### Task 1: Add a batch runner skeleton

**Files:**
- Create: `apps/signal-noise-app/scripts/brightdata_mcp_question_batch.py`
- Create: `apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py`

**Step 1: Write the failing test**

```python
def test_batch_runner_builds_question_records(tmp_path):
    ...
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`
Expected: FAIL because the runner module does not exist yet.

**Step 3: Write minimal implementation**

- Add a CLI that accepts entity name/id/type and an optional `--max-questions`.
- Load premium questions from `yellow_panther_catalog`.
- Produce frozen question records and persist a rollup JSON.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`
Expected: PASS.

### Task 2: Add BrightData MCP search, result ranking, and scrape selection

**Files:**
- Modify: `apps/signal-noise-app/scripts/brightdata_mcp_question_batch.py`
- Modify: `apps/signal-noise-app/scripts/brightdata_mcp_fact_smoke.py`
- Modify: `apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py`

**Step 1: Write the failing test**

- Verify the runner chooses the best-scoring search result, not index 0.
- Verify noisy/high-value questions can scrape more than one result.

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

**Step 3: Write minimal implementation**

- Reuse the result scoring policy from the smoke script.
- Store selected result metadata in the per-question record.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

### Task 3: Add judge JSON schema and persisted artifacts

**Files:**
- Modify: `apps/signal-noise-app/scripts/brightdata_mcp_question_batch.py`
- Modify: `apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py`

**Step 1: Write the failing test**

- Verify `ClaudeClient(model="judge")` receives a prompt that requests JSON.
- Verify the runner persists `question_results.json` and a plain-text transcript.

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

**Step 3: Write minimal implementation**

- Define a fixed result schema with:
  - question
  - query
  - selected result
  - evidence URL
  - answer
  - signal type
  - confidence
  - validation state
  - recommended next query
- Write one record per question and one rollup file.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

### Task 4: Smoke test Major League Cricket end to end

**Files:**
- Modify: `apps/signal-noise-app/scripts/brightdata_mcp_question_batch.py`
- Create or modify smoke output under: `apps/signal-noise-app/backend/data/mcp_smokes/`

**Step 1: Write the failing test**

- Add a smoke-style regression that uses `Major League Cricket` and asserts the output includes the ACE/LinkedIn procurement signal when the query plan includes procurement terms.

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

**Step 3: Write minimal implementation**

- Run the batch runner against Major League Cricket.
- Persist the JSON artifact and plain-text transcript.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v`

### Task 5: Document and validate

**Files:**
- Modify: `apps/signal-noise-app/docs/data/V5_DIRECT_HOSTED_MCP_PROCUREMENT_METHOD.md`
- Modify: `apps/signal-noise-app/docs/FINAL-CSV-TO-INTELLIGENCE-PIPELINE.md`

**Step 1: Write the failing test**

- No new code test needed; validate by running the smoke and checking the artifact content.

**Step 2: Run verification commands**

Run:
```bash
pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v
python3 apps/signal-noise-app/scripts/brightdata_mcp_question_batch.py --help
```

**Step 3: Write minimal documentation update**

- Freeze the batch runner as the canonical question-by-question procurement discovery path.

**Step 4: Final verification**

Run:
```bash
pytest apps/signal-noise-app/backend/tests/test_brightdata_mcp_question_batch.py -v
```

