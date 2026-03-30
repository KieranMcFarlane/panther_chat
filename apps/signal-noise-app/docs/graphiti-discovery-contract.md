# Graphiti Discovery Contract

## Core Primitive

All future discovery and reasoning systems in this repo must follow the same loop:

1. Generate focused questions first.
2. Gather fresh evidence with BrightData and MCP tools.
3. Let Graphiti reason over the collected episodes, facts, and relationships.
4. Persist the result to Supabase and FalkorDB.
5. Surface a materialized, human-readable output to the UI.

## Rules

- Do not bypass the question pack unless a feature has a narrow, documented reason.
- Do not rely on raw scraping alone for final answers.
- Do not ask Graphiti to reason without fresh evidence.
- Do not query the graph directly from the UI when a materialized view is available.
- Do not introduce a new discovery flow that ignores the existing service-hypothesis model.

## Required Shape

Every discovery path should be able to answer:

- What changed?
- Which service does it map to?
- What evidence supports it?
- Who likely owns it?
- What is the likely timing?
- What should the user do next?

## Implementation Standard

If you add a new pipeline, agent, or UI surface:

- start from the question pack
- scope the evidence window
- use BrightData or another MCP source to collect proof
- attach temporal context in Graphiti
- save the result in the durable store
- expose a materialized feed or summary, not raw traversal output

If the feature does not fit this loop, it needs an explicit exception in its own design note.
