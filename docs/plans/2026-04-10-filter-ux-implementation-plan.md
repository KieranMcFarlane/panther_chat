# Filter UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the shared filter/search system easier to understand by tightening labels, improving result context, and reducing visual clutter on lighter pages.

**Architecture:** Keep the existing shared filter shell and canonical taxonomy. This pass only changes presentation and page-level configuration: rename confusing labels where appropriate, add clearer result summaries, and reduce the number of always-visible controls on pages that do not need them.

**Tech Stack:** Next.js, React, shadcn/ui `Command`, shared filter shell components, existing contract tests, Node test runner.

### Task 1: Decide the public filter labels

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-browser/client-page.tsx`
- Modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`
- Modify: `apps/signal-noise-app/src/app/rfps/page.tsx`
- Modify: `apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs`
- Modify: `apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs`
- Modify: `apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

**Step 1: Write the failing test**

Add a contract that pins the public labels we want to review in UI:
- `Sport`
- `Country`
- `Competition`
- `Entity Role` or a replacement label if the team chooses to rename it
- `Opportunity Kind`
- `Theme`

The test should fail if a page hardcodes the old label after the label decision changes.

**Step 2: Run test to verify it fails**

Run:
`node --test apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: fail until the label assertions match the chosen public labels.

**Step 3: Write minimal implementation**

Update the three pages to use the agreed labels only. Keep the shared filter shell and existing filtering behavior intact.

**Step 4: Run test to verify it passes**

Run:
`node --test apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/src/app/rfps/page.tsx apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
git commit -m "ux: tighten shared filter labels"
```

### Task 2: Improve result summaries

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-browser/client-page.tsx`
- Modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`
- Modify: `apps/signal-noise-app/src/app/rfps/page.tsx`
- Modify: `apps/signal-noise-app/src/components/VectorSearch.tsx`
- Modify: `apps/signal-noise-app/src/components/ui/VectorSearch.tsx`
- Test: `apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

**Step 1: Write the failing test**

Add source contracts for result summaries that include canonical context:
- entity name
- sport
- country
- competition or parent competition

Keep the assertion loose enough to allow styling changes, but strict enough that the context line exists.

**Step 2: Run test to verify it fails**

Run:
`node --test apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: fail if the canonical context line is missing.

**Step 3: Write minimal implementation**

Add or adjust a single result metadata line in each surface. Prefer one compact line over multiple labels.

**Step 4: Run test to verify it passes**

Run:
`node --test apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-browser/client-page.tsx apps/signal-noise-app/src/app/opportunities/page.tsx apps/signal-noise-app/src/app/rfps/page.tsx apps/signal-noise-app/src/components/VectorSearch.tsx apps/signal-noise-app/src/components/ui/VectorSearch.tsx apps/signal-noise-app/tests/test-facet-filter-bar-contract.mjs apps/signal-noise-app/tests/test-opportunities-filter-contract.mjs apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
git commit -m "ux: clarify filter result context"
```

### Task 3: Reduce facet clutter on lighter pages

**Files:**
- Modify: `apps/signal-noise-app/src/app/rfps/page.tsx`
- Modify: `apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`
- Optional modify: `apps/signal-noise-app/src/app/opportunities/page.tsx`

**Step 1: Write the failing test**

Add a contract that `rfps` does not expose every facet by default if it only needs search plus the most important filters.
If the page keeps all facets, the test should assert the exact set so the behavior is explicit.

**Step 2: Run test to verify it fails**

Run:
`node --test apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: fail until the facet set matches the decision.

**Step 3: Write minimal implementation**

Trim `rfps` to the smallest useful default facet set. Keep `opportunities` broader if it genuinely needs more axes.

**Step 4: Run test to verify it passes**

Run:
`node --test apps/signal-noise-app/tests/test-rfps-filter-contract.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/rfps/page.tsx apps/signal-noise-app/tests/test-rfps-filter-contract.mjs
git commit -m "ux: simplify rfps filters"
```

### Task 4: Add runtime smoke coverage for filter clarity

**Files:**
- Modify: `apps/signal-noise-app/tests/test-entity-workflow-runtime.mjs`
- Modify: `apps/signal-noise-app/tests/test-shell-runtime-render.mjs`

**Step 1: Write the failing test**

Add a runtime smoke that verifies:
- entity browser loads
- opportunities loads
- rfps loads
- the filter chrome is present
- searching and clearing are still possible

This should fail if a page regresses and stops rendering its filter shell.

**Step 2: Run test to verify it fails**

Run:
`node --test apps/signal-noise-app/tests/test-entity-workflow-runtime.mjs apps/signal-noise-app/tests/test-shell-runtime-render.mjs`

Expected: fail if the runtime page is unavailable or the filter shell is missing.

**Step 3: Write minimal implementation**

Fix only the runtime page wiring needed to restore the shell.

**Step 4: Run test to verify it passes**

Run:
`node --test apps/signal-noise-app/tests/test-entity-workflow-runtime.mjs apps/signal-noise-app/tests/test-shell-runtime-render.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/tests/test-entity-workflow-runtime.mjs apps/signal-noise-app/tests/test-shell-runtime-render.mjs
git commit -m "test: add filter ux runtime smoke"
```

### Task 5: Validate the UX in browser

**Files:**
- No code changes unless the smoke reveals a mismatch

**Step 1: Run the browser checklist**

Check:
- entity browser search by name, sport, country, and competition
- opportunities filter discoverability
- rfps reduced control set
- chip bar clarity
- empty-state clarity

**Step 2: Record outcomes**

Write down only the issues that are confusing in practice. Do not add more filters unless the current ones fail to explain themselves.

**Step 3: Commit if there were code changes**

If no code changed, no commit is needed.

