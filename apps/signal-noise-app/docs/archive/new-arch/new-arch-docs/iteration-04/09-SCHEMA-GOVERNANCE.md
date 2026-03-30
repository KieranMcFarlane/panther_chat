# Schema Governance

Purpose
Explain fixed schema rules and how evolution is handled.

TL;DR
- Meta-schema is fixed; extensions are controlled.
- Runtime agents do not mutate schema.
- Schema evolution happens offline, with validation.

Invariants
- Graph structure and signal schema must remain stable.
- Changes require explicit review and migration steps.

Where to go next
- Ops/testing: 10-OPS-TESTING.md
