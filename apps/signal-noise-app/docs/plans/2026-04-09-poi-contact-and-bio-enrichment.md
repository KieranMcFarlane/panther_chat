# POI Contact and Bio Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add richer POI records to question-first dossiers with verified email only, LinkedIn profile URLs, synthesized bios, and LinkedIn-post-derived context that renders in the dossier.

**Architecture:** Extend the people-answer shapes for `q3_leadership`, `q11_decision_owner`, and related POI flows so candidates can carry `email`, `linkedin_url`, `bio`, and `bio_evidence`. Keep email strict: only directly sourced or explicitly verified emails may be persisted. Bios can be synthesized from official-site text, LinkedIn profile/about data, and summarized recent LinkedIn posts when present. The dossier renderer should display these enriched POIs in the decision-owner tabs without dumping raw post text.

**Tech Stack:** Node question executor, Python dossier normalization, Next.js dossier renderer, Node test runner, pytest.

### Task 1: Add failing contract tests for enriched POI shape

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs`

**Step 1: Write failing executor tests**
- Assert `q3` or `q11` candidate records can carry:
  - `name`
  - `title`
  - `linkedin_url`
  - `email` only when directly sourced
  - `bio`
  - `bio_evidence`
  - `recent_post_summary`
  - `recent_post_urls`

**Step 2: Run tests to verify they fail**

Run:
```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
python3 -m pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
```

**Step 3: Write failing renderer test**
- Assert the dossier decision-owner view renders bio, LinkedIn link, verified email, and summarized-post context.

**Step 4: Run test to verify it fails**

Run:
```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs
```

**Step 5: Commit**

```bash
git add /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs
git commit -m "test: capture enriched poi contact and bio contract"
```

### Task 2: Enrich POI extraction in the executor

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`

**Step 1: Write minimal extraction logic**
- Extend parsed candidates to preserve:
  - verified email when present in source material
  - LinkedIn profile URL
  - short bio/about text
  - summary of recent LinkedIn posts
  - post URLs as evidence

**Step 2: Keep email strict**
- Only populate `email` if a literal email appears in trusted source material.
- Do not infer address patterns.

**Step 3: Synthesize bio**
- Prefer official site bio/about text.
- Fall back to LinkedIn profile/about text.
- Add a short recent-post summary when posts exist.

**Step 4: Run tests**

Run:
```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
```

**Step 5: Commit**

```bash
git add /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat: enrich poi candidates with verified contact and bio context"
```

### Task 3: Preserve enriched POIs through normalization

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/question-first-dossier.ts`

**Step 1: Normalize enriched fields**
- Ensure candidate objects survive merging and dossier normalization.
- Preserve `bio_evidence` and `recent_post_urls` for renderer use.

**Step 2: Run tests**

Run:
```bash
python3 -m pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-api-contract.mjs
```

**Step 3: Commit**

```bash
git add /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/question_first_dossier_runner.py /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/question-first-dossier.ts
git commit -m "feat: normalize enriched poi fields through dossier pipeline"
```

### Task 4: Render enriched POIs in the dossier

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/entity-dossier/QuestionFirstEntityDossier.tsx`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs`

**Step 1: Render POI cards**
- Show:
  - name
  - title
  - verified email if present
  - LinkedIn profile link if present
  - synthesized bio
  - short recent-post summary when available

**Step 2: Keep evidence compact**
- Do not dump full post text.
- Keep links or evidence refs behind concise supporting text.

**Step 3: Run tests**

Run:
```bash
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs
```

**Step 4: Commit**

```bash
git add /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/entity-dossier/QuestionFirstEntityDossier.tsx /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs
git commit -m "feat: render enriched poi bios and verified contact details"
```

### Task 5: Verify on live dossiers

**Files:**
- No new files required

**Step 1: Run focused verifications**

Run:
```bash
python3 -m pytest /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
node --test /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-question-first-dossier-render-guards.mjs
```

**Step 2: Spot-check local dossier pages**
- Arsenal
- Zimbabwe Cricket
- one additional club/federation with POI data

**Step 3: Commit**

```bash
git add .
git commit -m "test: verify enriched poi bio and contact flow"
```

