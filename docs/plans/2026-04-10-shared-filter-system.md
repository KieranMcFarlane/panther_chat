# Shared Filter System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify `entity-browser`, `opportunities`, and `rfps` behind one shared filter/search system while preserving each page’s own data model and query semantics.

**Architecture:** Build one reusable filter shell component plus a small set of page-specific adapters. The shell owns search input, select controls, active chips, apply/reset actions, and consistent layout; each page passes its own fields, current values, and callbacks. Keep data fetching and business rules local to each route so the shared system stays presentational and controlled.

**Tech Stack:** Next.js App Router, React, TypeScript, existing shadcn UI components, existing SWR/page fetch patterns.

### Task 1: Extract a page-agnostic filter contract

**Files:**
- Create: `apps/signal-noise-app/src/components/filters/SharedFilterShell.tsx`
- Modify: `apps/signal-noise-app/src/components/filters/FacetFilterBar.tsx`
- Test: `apps/signal-noise-app/tests/test-shared-filter-shell-contract.mjs`

**Step 1: Write the failing test**

Add a source-contract test that asserts the shared filter shell exposes:
- a `searchSlot` or equivalent injectable search region
- configurable select fields
- configurable active chips
- apply/reset actions
- no page-specific entity-browser assumptions

**Step 2: Run the test to verify it fails**

Run:
```bash
node --test apps/signal-noise-app/tests/test-shared-filter-shell-contract.mjs
```
Expected: FAIL because the new shell does not exist yet.

**Step 3: Write the minimal implementation**

Implement `SharedFilterShell` as the base reusable component. Keep it presentational and controlled. Rework `FacetFilterBar` to become a thin wrapper or alias over the shared shell so the entity browser continues to use the same rendered structure.

**Step 4: Run the test to verify it passes**

Run:
```bash
node --test apps/signal-noise-app/tests/test-shared-filter-shell-contract.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/filters/SharedFilterShell.tsx apps/signal-noise-app/src/components/filters/FacetFilterBar.tsx apps/signal-noise-app/tests/test-shared-filter-shell-contract.mjs
git commit -m "feat: extract shared filter shell"
```

### Task 2: Migrate `opportunities` to the shared filter system

**Files:**
- Modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`
- Modify: `apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs`

**Step 1: Write the failing test**

Add a source-contract test that asserts the page no longer hand-builds the search/select UI inline and instead renders the shared filter shell with page-specific fields for:
- search text
- type
- sport
- score threshold

**Step 2: Run the test to verify it fails**

Run:
```bash
node --test apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs
```
Expected: FAIL because the page still renders its own filter markup.

**Step 3: Write the minimal implementation**

Refactor the page to:
- keep its own `searchQuery`, `typeFilter`, `sportFilter`, and `scoreFilter` state
- map those into the shared filter shell
- keep the same query/filter behavior and result sorting
- keep the existing card layout and page stats

**Step 4: Run the test to verify it passes**

Run:
```bash
node --test apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs
git commit -m "feat: migrate opportunities to shared filters"
```

### Task 3: Migrate `rfps` to the shared filter system

**Files:**
- Modify: `apps/signal-noise-app/src/app/rfps/page.tsx`
- Modify: `apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

**Step 1: Write the failing test**

Add a source-contract test that asserts the page uses the shared filter shell for:
- promoted-RFP search
- any future facet controls
- consistent apply/reset behavior if filters are added later

**Step 2: Run the test to verify it fails**

Run:
```bash
node --test apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
```
Expected: FAIL because the page currently uses inline search markup.

**Step 3: Write the minimal implementation**

Refactor the page to render the shared filter shell around its current search input. Keep the page’s data fetch and result card rendering intact. If no facet filters are needed yet, pass only the shared search region and keep the filter shell minimal.

**Step 4: Run the test to verify it passes**

Run:
```bash
node --test apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/rfps/page.tsx apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
git commit -m "feat: migrate rfps to shared filters"
```

### Task 4: Add shared behavior coverage

**Files:**
- Modify: `apps/signal-noise-app/tests/test-entity-browser-history.mjs`
- Modify: `apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs`
- Modify: `apps/signal-noise-app/tests/test-entities-taxonomy-fallback.mjs`
- Modify: `apps/signal-noise-app/tests/test-sports-directory-contract.mjs`

**Step 1: Write the failing test**

Expand the existing contracts so they assert:
- the entity browser still uses the shared shell
- active chips and reset behavior remain intact
- taxonomy normalization still feeds the browser correctly
- sports directory output stays canonical after the UI refactor

**Step 2: Run the tests to verify they fail**

Run:
```bash
node --test apps/signal-noise-app/tests/test-entity-browser-history.mjs apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-entities-taxonomy-fallback.mjs apps/signal-noise-app/tests/test-sports-directory-contract.mjs
```
Expected: one or more FAILs until the assertions match the new shared abstraction.

**Step 3: Write the minimal implementation**

Adjust assertions only; do not change production code unless the tests expose a real regression.

**Step 4: Run the tests to verify they pass**

Run:
```bash
node --test apps/signal-noise-app/tests/test-entity-browser-history.mjs apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-entities-taxonomy-fallback.mjs apps/signal-noise-app/tests/test-sports-directory-contract.mjs
```
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/tests/test-entity-browser-history.mjs apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-entities-taxonomy-fallback.mjs apps/signal-noise-app/tests/test-sports-directory-contract.mjs
git commit -m "test: cover shared filter system"
```

### Task 5: Browser smoke the three surfaces

**Files:**
- No code changes expected

**Step 1: Run the smoke**

Open these pages in Chrome DevTools and verify search/filter behavior:
- `/entity-browser`
- `/opportunities`
- `/rfps`

Confirm:
- search input works
- shared shell layout is consistent
- no console errors
- entity-browser dossier links still resolve to UUID routes

**Step 2: Verify the linked dossier route**

Click one entity-browser result and confirm the destination remains:
`/entity-browser/<uuid>/dossier?from=1`

**Step 3: Commit if needed**

If smoke reveals a regression, patch only the specific page or shell adapter, then re-run the smoke before committing.

### Task 6: Final cleanup and commit

**Files:**
- Modify: any files touched during Tasks 1-5 only

**Step 1: Run the focused test set**

Run:
```bash
node --test apps/signal-noise-app/tests/test-shared-filter-shell-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs apps/signal-noise-app/tests/test-entity-browser-history.mjs apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-entities-taxonomy-fallback.mjs apps/signal-noise-app/tests/test-sports-directory-contract.mjs
```
Expected: PASS.

**Step 2: Run a final browser smoke**

Re-check:
- entity browser search/filter
- opportunities search/filter
- rfps search/filter

**Step 3: Commit**

```bash
git add <all touched files>
git commit -m "feat: unify app filter system"
```
