# Yellow Panther Entity Browser 5-Entity Smoke Runbook

## Goal
Show the entity-first workflow end to end in the live app:
- entity browser first
- persisted dossier visible on the page
- dossier phase progression visible
- Control Center secondary
- enrichment and pipeline remain visible but not dominant

## Smoke Entities
Use these five entities in this order:

1. `Arsenal Football Club` - `dca9d675-1d91-4a19-8ae6-04ed0df624cd`
2. `Coventry City` - `b62b1f00-dd3a-4a22-82cb-4a6a573f5a09`
3. `Zimbabwe Cricket` - `d500cecb-8392-4bba-9cb2-4ed2bb7f9253`
4. `Major League Cricket` - `0c6caa0a-8475-455f-8f9b-5ce61295bcd1`
5. `Zimbabwe Handball Federation` - `f6f83596-9b70-41e9-996b-a53b82168cd7`

## Journey
1. Open `/entity-browser`.
2. Confirm the smoke journey panel is visible above the entity grid.
3. Open the dossier for `Arsenal Football Club`.
4. Confirm the dossier page shows:
   - the persisted dossier state
   - the phase rail
   - the canonical question pack
   - the next action
5. Return to `/entity-browser`.
6. Repeat for the other four smoke entities.
7. Open `/pipeline` and confirm lane health is visible.
8. Open `/control-center` to confirm the continuous system remains available as a secondary view.

## Acceptance Criteria
- Entity browser is the first screen users see.
- Each smoke entity has a direct dossier link from the browser.
- The dossier page shows persisted state rather than a blank shell.
- At least one entity demonstrates a strong dossier path.
- At least one entity demonstrates a sparse/no-signal path without breaking the UI.
- The pipeline and control center remain visible but secondary.

## What To Watch
- Whether the dossier data is already persisted and loaded on first render.
- Whether opening a dossier feels like a continuation of the browser rather than a separate app.
- Whether the smoke journey reduces the time needed to demo the system.
