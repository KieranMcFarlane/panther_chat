# Schema Governance

Purpose
Explain fixed schema rules and how evolution is handled.

TL;DR
- Meta-schema is fixed; extensions are controlled.
- Runtime agents do not mutate schema.
- Schema evolution is offline-only and requires review.

Invariants / Non-negotiables
- Do not change core signal schema during runtime.
- New fields must be additive and backward-compatible.

Interfaces / Contracts
- Schema definitions: backend/schemas.py
- Supabase tables: entities, signals, evidence, relationships

Failure modes & mitigations
- Schema drift breaks reasoning. Enforce strict migrations.

Concrete artifacts
- backend/schemas.py
- Supabase schema docs and SQL in repo

Where to go next
- Ops/testing: 10-OPS-TESTING.md
