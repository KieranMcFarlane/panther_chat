# Yellow Panther End-to-End System Overview

> **For Claude:** this document captures the current dominant system state in v5 so the branch can be merged into `main` without losing the entity-browser, dossier, and performance work.

**Goal:** Summarize the full Yellow Panther workflow end-to-end: entity browser first, persisted dossier state, question-driven Ralph loops, discovery lanes, enrichment, graph memory, and the performance work that makes the browser usable as the default operator surface.

**Architecture:** The product now behaves like a continuous intelligence workspace:

- **Entity browser** is the primary landing surface.
- **Dossiers** are persisted, question-driven work units.
- **OpenCode** runs per question where we need controlled iteration.
- **LeadIQ** enriches persisted entities with people/company context.
- **Manus** scouts off-graph sports RFPs and candidate opportunities.
- **BrightData MCP** supplies live web evidence.
- **Graphiti / FalkorDB** stores durable relationships, evidence, and revisit history.
- **GLM / Ralph** reason over evidence, validate it, and determine what gets written back.

The current branch combines the original browser performance work with the newer dossier and multi-lane system. That is the state worth promoting to `main`.

---

## 1. Operator Journey

The primary operator flow is now:

1. Open `/entity-browser`
2. Select an entity or use the 5-entity smoke panel
3. Open the dossier page
4. Review the persisted dossier banner
5. Work the question pack
6. Persist the validated dossier writeback
7. Enrich the entity with LeadIQ
8. Scout new off-graph leads with Manus
9. Review the pipeline and graph surfaces for live status and history

The browser is no longer just a list of entities. It is the control surface for the full system.

---

## 2. UI / UX Surfaces

### Entity Browser

The entity browser is the dominant landing surface:

- entity cards show dossier progress
- cards surface phase, confidence, freshness, next action
- the smoke journey is visible at the top
- the browser can open into full dossier work directly

### Dossier Page

The dossier page is the primary working surface for a single entity:

- persisted dossier banner appears at the top
- the canonical question pack is visible
- the phase rail shows phase 0-5 progress
- graph episodes and timeline context are rendered
- the system/writeback tab shows artifact state

### Control Center

The control center is secondary:

- shows live system progress
- shows now / next / blocked
- shows stale sources and revisit backlog
- shows the last-minute activity feed

### Pipeline

Pipeline is the operational monitor:

- scout lane health
- enrichment lane health
- validation / writeback health
- active vs awaiting-first-snapshot state

### Scout / Enrichment / Graph

These are supporting surfaces:

- Scout discovers off-graph opportunities
- Enrichment adds people/company detail
- Graph shows durable relationships and temporal evidence

---

## 3. Dossier Model

The dossier model now has a durable writeback path:

- `entity_dossiers` remains the canonical persisted dossier snapshot
- `/api/entity-question-pack` persists the final Ralph question pack
- dossier pages load the persisted pack and graph episodes
- the UI surfaces the writeback artifact path explicitly

The question pack is no longer just an in-memory response. It is a persistent artifact that the page can show and the backend can re-use.

### Question Pack Structure

The question pack now combines:

- the existing entity-type catalog
- Yellow Panther business-fit prompts
- ranked question ordering
- persisted writeback metadata

The practical result is that the dossier flow is focused on:

- service fit
- budget / timeline fit
- positioning strategy
- outreach angle
- next action

---

## 4. Question-Driven Reasoning

The system uses a controlled question loop rather than a single opaque dossier generation pass.

### Core loop

1. Build a canonical question pack from the entity type
2. Persist the question pack artifact
3. Run OpenCode / Ralph-style reasoning per question where needed
4. Validate evidence and score confidence
5. Write back the final question pack
6. Extend the dossier with human-readable context

### Why this matters

This makes the dossier work:

- inspectable
- repeatable
- resumable
- easier to rank by business value
- safer to merge into a long-lived branch

---

## 5. Discovery Lanes

### Manus Scout

Manus acts as an external scout:

- searches the wider sports universe
- finds opportunities not yet modeled as official entities
- outputs candidate leads and shadow entities
- keeps off-graph opportunities visible until promoted

### OpenCode Enrichment

OpenCode consumes scout output and persisted entity dossiers:

- enriches with LeadIQ
- adds contacts
- adds company context
- adds role hierarchy
- adds outreach hooks
- keeps the dossier history intact

### BrightData MCP

BrightData remains the evidence layer:

- live web search
- procurement / RFP evidence
- source validation
- source freshness

---

## 6. Memory and Persistence

The system now persists at multiple layers:

- entity dossier snapshots
- final Ralph question pack
- graph episodes
- scout/enrichment lane state
- revisit and backlog state

The important property is that each lane can resume from prior work instead of starting over.

### Persistence benefits

- less duplicated work
- better operator trust
- clearer evidence lineage
- less “two lots of bugs” across duplicate implementations

---

## 7. Performance Work That Makes This Usable

The branch includes the performance work needed to make the entity browser the dominant interface:

- virtualization for long entity lists
- server-side filtering and debouncing
- URL pagination
- faster SPA navigation
- dossier surfacing from persisted state
- live progressive status updates
- taxonomy fallback when Supabase is unavailable

The point of the performance work is not just speed. It is to make the browser feel like a working system instead of a stalled dashboard.

---

## 8. Current System Status

The branch is now at a useful dominant state:

- entity browser is the primary entry point
- dossier pages load persisted state
- question packs are written back and re-used
- taxonomy no longer hard-fails when Supabase is unavailable
- the continuous system surfaces live state clearly
- the 5-entity smoke journey shows what the app looks like in motion

This is the state that should become the mainline baseline.

---

## 9. Why Merge This Branch

Merging v5 into `main` gives us:

- one entity-browser path instead of two
- one dossier model instead of competing versions
- one performance baseline for list/filter/navigation behavior
- one continuous intelligence model across scout, enrichment, pipeline, and graph

The branch is coherent enough now to stop splitting work between “prototype” and “dominant” code paths.

