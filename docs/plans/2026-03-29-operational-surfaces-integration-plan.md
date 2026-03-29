# Operational Surfaces Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Converge `Scout`, `Enrichment`, and `Pipeline` into thinner operational panels attached to `Entities`, `RFP's/Tenders`, and `Opportunities`, while keeping standalone ops pages as fallback surfaces.

**Architecture:** Keep `Entities`, `RFP's/Tenders`, and `Opportunities` as the main user-facing surfaces. Move operational state into shared shell primitives: a global pipeline strip/drawer, a scout panel embedded in `Tenders`, and enrichment panels embedded in entity cards and dossier pages. Retain `/rfp-analysis-control-center`, `/entity-enrichment`, and `/entity-pipeline` as advanced ops routes, but remove them from primary navigation once the embedded surfaces are stable.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility styling, existing `Button`/`Card` UI primitives, entity browser and dossier pages, entity enrichment API, entity pipeline API, tenders API.

### Task 1: Define the shell primitives

**Files:**
- Create: `apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx`
- Create: `apps/signal-noise-app/src/components/layout/OperationalDrawer.tsx`
- Modify: `apps/signal-noise-app/src/components/layout/AppNavigation.tsx`
- Test: `apps/signal-noise-app/tests/test-operational-shell-contract.mjs`

**Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('app navigation renders operational strip primitives', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')
  assert.match(source, /OperationalStatusStrip/)
  assert.match(source, /OperationalDrawer/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-operational-shell-contract.mjs`

Expected: FAIL because the new components are not imported or rendered.

**Step 3: Write minimal implementation**

- Build `OperationalStatusStrip` as a thin shell component with slots for:
  - active runs
  - blocked runs
  - stale items
  - recent completions
- Build `OperationalDrawer` as a hidden-by-default detail panel.
- Render both in `AppNavigation` just above the page content area so they remain visible across `Entities`, `Tenders`, and `Opportunities`.

**Step 4: Run test to verify it passes**

Run: `node --test apps/signal-noise-app/tests/test-operational-shell-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/src/components/layout/OperationalDrawer.tsx apps/signal-noise-app/src/components/layout/AppNavigation.tsx apps/signal-noise-app/tests/test-operational-shell-contract.mjs
git commit -m "feat: add shared operational shell surfaces"
```

### Task 2: Embed Scout into `RFP's/Tenders`

**Files:**
- Create: `apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx`
- Modify: `apps/signal-noise-app/src/app/tenders/page.tsx`
- Test: `apps/signal-noise-app/tests/test-tenders-scout-panel-contract.mjs`

**Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders page embeds scout panel and keeps live feed framing', async () => {
  const source = await readFile(new URL('../src/app/tenders/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /ScoutPanel/)
  assert.match(source, /Live Intake Feed/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-tenders-scout-panel-contract.mjs`

Expected: FAIL because `ScoutPanel` is not rendered.

**Step 3: Write minimal implementation**

- Add a `ScoutPanel` that shows:
  - scout run status
  - source coverage
  - freshness
  - a `Run scout` call to action
- Place it beside or below the live feed filters in `tenders/page.tsx`.
- Do not remove the standalone `/rfp-analysis-control-center` route yet; link the panel to it as “Advanced scout”.

**Step 4: Run test to verify it passes**

Run: `node --test apps/signal-noise-app/tests/test-tenders-scout-panel-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/rfp/ScoutPanel.tsx apps/signal-noise-app/src/app/tenders/page.tsx apps/signal-noise-app/tests/test-tenders-scout-panel-contract.mjs
git commit -m "feat: embed scout panel into tenders feed"
```

### Task 3: Embed enrichment state into `Entities`

**Files:**
- Create: `apps/signal-noise-app/src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx`
- Modify: `apps/signal-noise-app/src/components/EntityCard.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx`
- Test: `apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs`

**Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('entity card exposes enrichment summary entry point', async () => {
  const source = await readFile(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')
  assert.match(source, /EntityEnrichmentSummaryCard/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs`

Expected: FAIL because the summary card is not referenced.

**Step 3: Write minimal implementation**

- Add `EntityEnrichmentSummaryCard` with:
  - enrichment status
  - last updated
  - recent contact/company additions
  - “Run enrichment” and “Open advanced enrichment” actions
- Render a compact version in `EntityCard`.
- Render a fuller version near the top of the dossier page.

**Step 4: Run test to verify it passes**

Run: `node --test apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/entity-enrichment/EntityEnrichmentSummaryCard.tsx apps/signal-noise-app/src/components/EntityCard.tsx apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/client-page.tsx apps/signal-noise-app/tests/test-entity-enrichment-summary-contract.mjs
git commit -m "feat: surface enrichment state in entity workflow"
```

### Task 4: Reduce `Pipeline` page to advanced ops and pull status into shell

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-pipeline/page.tsx`
- Modify: `apps/signal-noise-app/src/components/entity-import/SingleEntityPipelineForm.tsx`
- Modify: `apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx`
- Test: `apps/signal-noise-app/tests/test-pipeline-advanced-ops-contract.mjs`

**Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pipeline page is framed as advanced ops while shell owns live status', async () => {
  const page = await readFile(new URL('../src/app/entity-pipeline/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /Advanced Ops/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-pipeline-advanced-ops-contract.mjs`

Expected: FAIL because the page is still framed as a primary workflow destination.

**Step 3: Write minimal implementation**

- Reframe `/entity-pipeline` as an advanced operator surface:
  - “Queue a single entity”
  - “Advanced Ops”
  - direct link back to `Entities`
- Keep the status strip in the shell as the primary live pipeline view.
- Keep the actual queue form intact.

**Step 4: Run test to verify it passes**

Run: `node --test apps/signal-noise-app/tests/test-pipeline-advanced-ops-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-pipeline/page.tsx apps/signal-noise-app/src/components/entity-import/SingleEntityPipelineForm.tsx apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/tests/test-pipeline-advanced-ops-contract.mjs
git commit -m "refactor: demote pipeline page to advanced ops"
```

### Task 5: Simplify primary navigation once embedded panels are live

**Files:**
- Modify: `apps/signal-noise-app/src/components/layout/discovery-nav.ts`
- Modify: `apps/signal-noise-app/src/components/layout/AppNavigation.tsx`
- Test: `apps/signal-noise-app/tests/test-discovery-nav-contract.mjs`

**Step 1: Write the failing test**

Update the nav contract to require only the primary user-facing surfaces in the main workflow section:

```js
assert.deepEqual(primaryNavItems.map((item) => [item.label, item.href]), [
  ['Entities', '/entity-browser'],
  ["RFP's/Tenders", '/tenders'],
  ['Opportunities', '/opportunities'],
])
```

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-discovery-nav-contract.mjs`

Expected: FAIL because `Scout`, `Enrichment`, and `Pipeline` are still in the primary workflow nav.

**Step 3: Write minimal implementation**

- Move `Scout`, `Enrichment`, and `Pipeline` into an `Advanced Ops` section or drawer in the shell.
- Keep direct links available, but visually secondary.
- Preserve `Import CSV` as tooling, not workflow.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test apps/signal-noise-app/tests/test-discovery-nav-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/layout/discovery-nav.ts apps/signal-noise-app/src/components/layout/AppNavigation.tsx apps/signal-noise-app/tests/test-discovery-nav-contract.mjs
git commit -m "refactor: converge ops routes into secondary navigation"
```

### Task 6: Verify the converged IA end to end

**Files:**
- Test: `apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-discovery-nav-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-root-layout-globals-import.mjs`
- Test: `apps/signal-noise-app/tests/test-globals-css-border-contract.mjs`

**Step 1: Run focused tests**

Run:

```bash
node --experimental-strip-types --test \
  apps/signal-noise-app/tests/test-discovery-nav-contract.mjs \
  apps/signal-noise-app/tests/test-opportunity-surface-contract.mjs \
  apps/signal-noise-app/tests/test-root-layout-globals-import.mjs \
  apps/signal-noise-app/tests/test-globals-css-border-contract.mjs
```

Expected: PASS.

**Step 2: Run live route checks**

Run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/entity-browser
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/tenders
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/opportunities
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/entity-enrichment
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/entity-pipeline
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3005/rfp-analysis-control-center
```

Expected: all return `200`.

**Step 3: Commit**

```bash
git add apps/signal-noise-app/tests apps/signal-noise-app/src/components/layout apps/signal-noise-app/src/app
git commit -m "test: verify converged primary and operational surfaces"
```

### Notes for implementation

- Do not remove the standalone operational routes until the embedded panel versions are stable and used in the shell.
- Keep `Entities` as the anchor surface for entity-specific work.
- Keep `RFP's/Tenders` as the broad intake feed.
- Keep `Opportunities` as the curated shortlist and decision surface.
- Treat `Scout`, `Enrichment`, and `Pipeline` as operational capabilities that should usually appear in-context before they appear as standalone pages.
