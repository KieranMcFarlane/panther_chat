# Wide RFP Manus Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Manus-backed wide research flow that finds RFPs, normalizes them into the existing RFP surfaces, and creates or links canonical-first entities when they are missing.

**Architecture:** The backend will build one RFP-wide research prompt from the current repo conventions, send it to `MANUS_API`, and normalize the returned opportunities into the same canonical taxonomy used by `/rfps` and `/tenders`. Each result will resolve against `canonical_entities` first; if no canonical entity exists, the backend will create one with canonical-first fields before persisting the normalized opportunity row. The RFP page will show the latest normalized wide-research batch alongside the existing shortlist without replacing the current intake flow.

**Tech Stack:** Next.js App Router, Supabase, existing canonical entity snapshot/linking utilities, node `fetch`, and the current RFP taxonomy helpers.

### Task 1: Build the Manus prompt and normalized batch helper

**Files:**
- Create: `apps/signal-noise-app/src/lib/rfp-wide-research.ts`
- Test: `apps/signal-noise-app/tests/test-rfp-wide-research-contract.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('wide research prompt includes repo-specific RFP and canonical-first instructions', async () => {
  // import helper and assert prompt content
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-rfp-wide-research-contract.mjs -v`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

- Add a prompt builder that references `/tenders`, `/rfps`, current intake filtering, canonical-first entity rules, dedupe rules, and normalized output fields.
- Add a response normalizer that maps Manus results into the app’s canonical opportunity shape.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-rfp-wide-research-contract.mjs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/lib/rfp-wide-research.ts apps/signal-noise-app/tests/test-rfp-wide-research-contract.mjs
git commit -m "feat: add wide rfp manus normalization helper"
```

### Task 2: Add the Manus-backed API route and canonical entity reconciliation

**Files:**
- Create: `apps/signal-noise-app/src/app/api/rfp-wide-research/route.ts`
- Modify: `apps/signal-noise-app/src/lib/rfp-wide-research.ts`
- Modify: `apps/signal-noise-app/src/app/api/tenders/route.ts` only if the shared normalization helper needs to be reused
- Test: `apps/signal-noise-app/tests/test-rfp-wide-research-route.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('route references MANUS_API and canonical entity creation', async () => {
  // assert route contract and handler names
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-rfp-wide-research-route.mjs -v`
Expected: FAIL because the route does not exist yet.

**Step 3: Write minimal implementation**

- Read `MANUS_API` from the environment.
- POST the prompt to Manus.
- Resolve each returned organization against the canonical snapshot.
- If no canonical entity exists, create one using canonical-first fields before inserting the RFP row.
- Persist the normalized batch for later page rendering.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-rfp-wide-research-route.mjs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/api/rfp-wide-research/route.ts apps/signal-noise-app/src/lib/rfp-wide-research.ts apps/signal-noise-app/tests/test-rfp-wide-research-route.mjs
git commit -m "feat: add manus-backed wide rfp api"
```

### Task 3: Render normalized wide research output in the RFP page

**Files:**
- Modify: `apps/signal-noise-app/src/app/rfps/page.tsx`
- Modify: `apps/signal-noise-app/src/app/tenders/page.tsx` only if the run button should trigger the new Manus route
- Modify: `apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx` only if the status copy needs to reflect Manus research
- Test: `apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('rfps page renders normalized wide research output', async () => {
  // assert the page reads and displays the normalized batch
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-opportunity-surface-contract.mjs -v`
Expected: FAIL until the page shows the normalized wide-research batch.

**Step 3: Write minimal implementation**

- Fetch the latest normalized wide-research batch.
- Display the normalized entity/opportunity fields in a dedicated section on `/rfps`.
- Keep the existing promoted shortlist intact.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-opportunity-surface-contract.mjs -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/rfps/page.tsx apps/signal-noise-app/src/app/tenders/page.tsx apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs
git commit -m "feat: surface normalized wide rfp results"
```

### Task 4: Verify the full RFP path

**Files:**
- All files touched above

**Step 1: Run the focused tests**

Run: `node --test tests/test-rfp-wide-research-contract.mjs tests/test-rfp-wide-research-route.mjs tests/test-opportunity-surface-contract.mjs -v`
Expected: PASS

**Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with no new warnings from the RFP changes.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add wide rfp manus normalization flow"
```
