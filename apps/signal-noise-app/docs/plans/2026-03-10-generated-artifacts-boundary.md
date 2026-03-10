# Generated Artifacts Boundary

This boundary keeps generated runtime/build artifacts out of active source control paths.

## Denylist

- `.next.preclean*`
- `.pytest_cache/`
- `.venv*`
- `backend/data/dossiers/*`

## Exceptions

- `backend/data/dossiers/.gitkeep` is allowed to preserve directory structure.

## Intent

- Avoid noisy diffs from local build/runtime output.
- Keep runtime-facing and reviewable changes focused on source files.
