# Business Goal Question Pack Ranking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a business-goal-aware duplicate of the dossier question pack that ranks high-signal Yellow Panther questions above noisy context questions.

**Architecture:** Reuse the current reasoned dossier pack as the source of truth, then score each question against Yellow Panther’s business profile: mobile apps, digital transformation, fan engagement, analytics, e-commerce, budgets, timing, decision makers, and procurement intent. Emit a new JSON pack with explicit business-goal scores, buckets, and rationale, sorted by value for the Ralph loop.

**Tech Stack:** Python, pytest, JSON file artifacts, existing dossier question pack generators.

### Task 1: Write the failing business-ranking test

**Files:**
- Create: `backend/tests/test_question_pack_business_reasoner.py`

**Step 1: Write the failing test**

Assert that a direct Yellow Panther fit question like digital transformation scores above a generic context question like competitor comparison, and that the output is sorted by `business_goal_score`.

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest backend/tests/test_question_pack_business_reasoner.py -q`
Expected: `ModuleNotFoundError` for `question_pack_business_reasoner`

### Task 2: Implement the business-goal scorer

**Files:**
- Create: `backend/question_pack_business_reasoner.py`

**Step 1: Write minimal implementation**

Load the existing reasoned pack, score each question using Yellow Panther business priorities, assign a bucket, and sort descending by score.

**Step 2: Run test to verify it passes**

Run: `python3 -m pytest backend/tests/test_question_pack_business_reasoner.py -q`
Expected: PASS

### Task 3: Write the generated business pack artifact

**Files:**
- Add output: `backend/data/dossier_question_business_reasoned_pack.json`

**Step 1: Generate the artifact**

Use the new scorer module to write the business-goal-ranked duplicate pack.

**Step 2: Verify the artifact contents**

Run a quick JSON inspection script to confirm:
- 77 questions remain
- questions are sorted by score
- high-signal procurement / digital transformation questions lead the pack

