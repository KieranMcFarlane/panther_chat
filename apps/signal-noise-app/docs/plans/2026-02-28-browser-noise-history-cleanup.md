# Entity Browser Noise And History Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce remaining entity-browser network noise from auth, Copilot, and badge probes while preserving the improved dossier navigation flow and correct browser-page return behavior.

**Architecture:** Keep the entity browser usable without global side effects by moving expensive behavior behind explicit user intent. Treat the browser page like the dossier page: defer auth-dependent UI where possible, defer Copilot until opened, and normalize badge URLs so the browser stops probing obviously missing assets. Preserve page context in the URL and session storage so back navigation remains deterministic.

**Tech Stack:** Next.js App Router, React client components, SWR, Better Auth client components, CopilotKit, browser `sessionStorage`, Node test runner.

### Task 1: Audit browser-page auth mounting and add a regression

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-browser-history.mjs`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/layout/AppNavigation.tsx`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/layout/AppShell.tsx`

**Step 1: Write the failing test**

Assert that entity-browser auth rendering is route-aware rather than unconditional. The test should look for a browser-route guard in `AppNavigation` or `AppShell`, depending on where the final behavior lives.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: FAIL because the browser page still mounts auth/session consumers immediately.

**Step 3: Write minimal implementation**

Choose one of these approaches:
- Recommended: in `AppNavigation`, gate `authMenu` behind explicit interaction on `/entity-browser`.
- Alternative: in `AppShell`, stop passing `authMenu` to entity-browser routes until the user opens auth UI.

Keep the sign-in path available, but do not mount `UserMenu`/`SignInLink` session hooks by default on the browser page.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: PASS for the new auth guard.

**Step 5: Commit**

```bash
git add tests/test-entity-browser-history.mjs src/components/layout/AppNavigation.tsx src/components/layout/AppShell.tsx
git commit -m "perf: defer auth session checks on entity browser"
```

### Task 2: Defer CopilotKit on the entity browser page

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-browser-history.mjs`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/layout/AppShell.tsx`

**Step 1: Write the failing test**

Add a source-level regression asserting that `/entity-browser` uses the same deferred Copilot launcher pattern already used on dossier routes, or another equivalent route-aware deferral.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: FAIL because Copilot currently mounts immediately on the browser page.

**Step 3: Write minimal implementation**

Recommended behavior:
- Extend `AppShell` so `isEntityBrowserRoute` joins `isDossierRoute` in the deferred path.
- Reuse the existing launcher button and `CopilotOverlay`.
- Do not mount `CopilotKit`, `TemporalIntelligenceTools`, or `SimpleStreamingChat` until the user explicitly opens chat.

This removes `ciu` calls and `/api/copilotkit` noise from initial browser loads.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-browser-history.mjs tests/test-dossier-performance-guards.mjs`
Expected: PASS with browser-route Copilot deferral covered.

**Step 5: Commit**

```bash
git add tests/test-entity-browser-history.mjs src/components/layout/AppShell.tsx
git commit -m "perf: defer copilot on entity browser"
```

### Task 3: Stop badge `HEAD` probes by normalizing or short-circuiting broken badge paths

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-browser-history.mjs`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/badge/EntityBadge.tsx`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entities/route.ts`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entities/[entityId]/route.ts`

**Step 1: Write the failing test**

Add a source-based test for one of these acceptable behaviors:
- `EntityBadge` only attempts known-safe badge URLs that already start with `/badges/`.
- `EntityBadge` caches missing badge results in memory and does not probe the same broken candidate repeatedly.

Prefer the first if the current component is synthesizing speculative badge paths; prefer the second if the probes are coming from fallback discovery logic.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: FAIL because current badge handling still triggers repeated `HEAD` requests for many missing assets.

**Step 3: Write minimal implementation**

Recommended order:
1. In `EntityBadge`, only probe explicit badge fields from entity data first.
2. If fallback generation remains necessary, memoize failures with a module-level `Set<string>` so the same bad path is never re-probed during the session.
3. If API normalization is cheaper, ensure the browser list returns `null` instead of malformed badge paths when no real asset exists.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: PASS for badge probe guard behavior.

**Step 5: Commit**

```bash
git add tests/test-entity-browser-history.mjs src/components/badge/EntityBadge.tsx src/app/api/entities/route.ts src/app/api/entities/[entityId]/route.ts
git commit -m "perf: avoid repeated broken badge probes"
```

### Task 4: Preserve and verify entity-browser page history behavior

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-browser-history.mjs`
- Modify if needed: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-browser/page.tsx`
- Modify if needed: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/header/HistoryNav.tsx`

**Step 1: Write the failing test**

Extend the current source regression so page, filter, and limit state are all preserved in the stored browser URL, not just `page`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: FAIL if stored URL logic only partially preserves browser state.

**Step 3: Write minimal implementation**

In `entity-browser/page.tsx`:
- Treat the URL as the source of truth for page and any active filter params.
- Persist the full current browser URL to `sessionStorage`.

In `HistoryNav.tsx`:
- Keep dossier back behavior using the stored URL first.
- Preserve `from` only as fallback when no stored browser URL exists.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-browser-history.mjs`
Expected: PASS for stored browser URL coverage.

**Step 5: Commit**

```bash
git add tests/test-entity-browser-history.mjs src/app/entity-browser/page.tsx src/components/header/HistoryNav.tsx
git commit -m "fix: persist full entity browser return state"
```

### Task 5: Verify browser-level behavior in DevTools

**Files:**
- No code changes required unless regressions are found.

**Step 1: Run targeted test suite**

Run:

```bash
node --test tests/test-entity-card-prefetch.mjs tests/test-entity-browser-history.mjs tests/test-entity-routing.mjs tests/test-dossier-page-layout.mjs tests/test-dossier-performance-guards.mjs
```

Expected: all tests pass.

**Step 2: Verify live entity-browser network**

Manual checks in DevTools on `http://localhost:3005/entity-browser?page=3`:
- Initial load should not hit `/api/auth/get-session` if auth was deferred.
- Initial load should not hit `api.cloud.copilotkit.ai/ciu` or `/api/copilotkit` before chat is opened.
- Badge `HEAD` failures should be dramatically reduced or eliminated.
- Hover/focus on a card should prefetch the dossier route.

**Step 3: Verify browser-to-dossier-to-back**

Manual flow:
1. Open `/entity-browser?page=3`
2. Click a dossier
3. Use the header back button

Expected: return to the exact previous browser URL, including page and filters.

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify entity browser noise and history cleanup"
```
