# Schema-First Pre-Phase (Canonical Pipeline)

## Purpose

Add an optional schema-first BrightData pass before dossier/discovery so the pipeline can seed high-value fields early (especially `official_site`) and reduce low-yield URL resolution paths later.

## Execution Order

When enabled, canonical `PipelineOrchestrator` now runs:

1. `schema_first` (new, optional, non-blocking)
2. `dossier_generation`
3. `baseline_monitoring`
4. `discovery`
5. `ralph_validation`
6. `temporal_persistence`
7. `dashboard_scoring`

If disabled, `schema_first` is marked as `skipped`.

For `run_fixed_dossier_pipeline.py`, the same feature is enabled with the same env flags as a pre-phase before phase 1 dossier generation.

## Runtime Configuration

```bash
# Enable/disable schema-first pre-phase
PIPELINE_SCHEMA_FIRST_ENABLED=true
PIPELINE_SCHEMA_SWEEP_ENABLED=false

# Artifact output location
PIPELINE_SCHEMA_FIRST_OUTPUT_DIR=backend/data/dossiers

# BrightData pilot search budget
PIPELINE_SCHEMA_FIRST_MAX_RESULTS=8
PIPELINE_SCHEMA_FIRST_MAX_CANDIDATES_PER_QUERY=4

# Optional field subset (comma-separated)
# Example: official_site,founded_year,headquarters
PIPELINE_SCHEMA_FIRST_FIELDS=

# Schema sweep runtime (only when PIPELINE_SCHEMA_SWEEP_ENABLED=true)
SCHEMA_SWEEP_MAX_HOPS_PER_FIELD=3
SCHEMA_SWEEP_MIN_FIELD_CONFIDENCE=0.55
SCHEMA_SWEEP_SEARCH_ENGINE=google
SCHEMA_SWEEP_SEARCH_COUNTRY=us
```

Defaults:
- `PIPELINE_SCHEMA_FIRST_ENABLED=false`
- `PIPELINE_SCHEMA_SWEEP_ENABLED=false`
- `PIPELINE_SCHEMA_FIRST_OUTPUT_DIR=backend/data/dossiers`
- `PIPELINE_SCHEMA_FIRST_MAX_RESULTS=8`
- `PIPELINE_SCHEMA_FIRST_MAX_CANDIDATES_PER_QUERY=4`
- `SCHEMA_SWEEP_MAX_HOPS_PER_FIELD=3`
- `SCHEMA_SWEEP_MIN_FIELD_CONFIDENCE=0.55`
- `SCHEMA_SWEEP_SEARCH_ENGINE=google`
- `SCHEMA_SWEEP_SEARCH_COUNTRY=us`

## What Gets Merged

After dossier generation, schema-first output is merged into dossier metadata:

- `metadata.schema_first` stores run metadata + extracted fields.
- `metadata.canonical_sources.official_site` is populated from schema-first if dossier did not already provide it.

This gives discovery a stable official-site seed without overriding stronger dossier-provided canonical sources.

In `run_fixed_dossier_pipeline.py`:
- schema-first `official_site` is merged into dossier metadata canonical sources.
- phase-1 collector now receives schema-first `official_site` as a preferred seed before BrightData search, so official-site scraping starts from that deterministic URL when available.
- discovery official-site seeding also falls back to schema-first when generator cache/artifact lookup does not return a URL.

## Phase/Artifact Shape

`phases.schema_first` reports:
- `status`
- `run_mode` (`schema_first_pilot` or `schema_sweep_single_pass`)
- `answered_fields`
- `unanswered_fields`
- `artifact_path`

`artifacts.schema_first` includes the raw schema-first output object (or `null` if skipped/failed).

When schema sweep is enabled, artifact payload also includes:
- `step_log_path` (JSONL of each tool action)
- `cache_metrics` (search/scrape call counts and cache-hit counts)
- `field_traces` (attempt-by-attempt trace per field)

## Failure Semantics

Schema-first failures are non-fatal:
- `phases.schema_first.status=failed`
- pipeline continues through dossier/discovery path

This preserves pipeline completion reliability while still capturing diagnostics for tuning.
