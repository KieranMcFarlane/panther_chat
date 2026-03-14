# Entity Congruence Repo-Wide Plan (P1 to P3)

## Goal
Stabilize entity identity across Supabase cache, embedding rows, and graph relationships so search/filter/hierarchy are consistent and deterministic.

## Current Baseline (2026-03-14)
- `entity_relationships` sync is wired into full graph sync.
- Reconciliation endpoint supports `id_backfill` and `semantic_merge`.
- Semantic merge now avoids FK-breaking relationship rewrites and supports stronger name normalization.
- IPL exact-name spot-check is 10/10 present by normalized name.
- Residual `id_name_mismatches` remain due historical cross-pass ID collisions.

## P1 (Operational Hardening) - Complete
1. Keep full-sync pipeline as:
   - `POST /api/sync/graph-to-supabase`
   - `POST /api/admin/entity-reconciliation/remediate` with `strategy=semantic_merge`
2. Keep reconciliation guardrails:
   - strict noise filtering for obvious system/non-entity rows
   - semantic name promotion when alias-only matches hide canonical names
3. Validate after every run:
   - overlap by graph ID
   - normalized names missing in cached
   - id/name mismatch count
   - IPL and Premier League spot checks

## P2 (Canonical Identity Layer) - Next
1. Introduce canonical identity as source of truth for browse/search:
   - expand usage of `canonical_entities` + `entity_aliases`
   - map every `cached_entities` row to one canonical entity key
2. Add canonical linking fields to reconciliation output:
   - `canonical_key`
   - `canonical_entity_id`
   - confidence score and conflict reason
3. Stop ID-only semantics:
   - ID collisions become "additional source IDs" on a canonical entity
   - preserve provenance in `source_embedding_ids`

## P2 (Search Coverage QA) - Next
1. Add repo script: `scripts/qa/entity-congruence-audit.ts`
2. Emit a machine-readable report:
   - source count
   - cached count
   - indexed count
   - missing canonical names
   - unresolved ID/name mismatches
3. Add CI gate for minimum thresholds:
   - no regression on exact-name coverage for seeded test sets
   - no regression on relationship population

## P2 (Hierarchy Fidelity) - Next
1. Enforce canonical relationship types in `entity_relationships`:
   - `LEAGUE_HAS_TEAM`
   - `FEDERATION_GOVERNS_LEAGUE`
   - `TEAM_PLAYS_IN_LEAGUE`
2. Add post-sync validator:
   - every league must resolve to expected child teams for seeded leagues (IPL, EPL, Bundesliga)

## P3 (Product Integration) - Later
1. UI filter rail:
   - sport -> entity type -> league/federation -> search
2. Hybrid search ranking:
   - exact > alias > normalized/prefix > semantic
3. A-Z browsing in scoped result sets.

## Runbook
1. Start app.
2. Trigger full sync.
3. Trigger semantic remediation.
4. Run audit script/check endpoint.
5. Confirm seeded acceptance checks.

