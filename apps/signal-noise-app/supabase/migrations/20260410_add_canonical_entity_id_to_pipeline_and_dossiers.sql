ALTER TABLE entity_pipeline_runs
  ADD COLUMN IF NOT EXISTS canonical_entity_id UUID;

ALTER TABLE entity_dossiers
  ADD COLUMN IF NOT EXISTS canonical_entity_id UUID;

CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_canonical_entity_id
  ON entity_pipeline_runs(canonical_entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_dossiers_canonical_entity_id
  ON entity_dossiers(canonical_entity_id);

UPDATE entity_pipeline_runs epr
SET canonical_entity_id = resolved.canonical_entity_id
FROM (
  SELECT
    run_rows.id AS run_id,
    COALESCE(cache_rows.canonical_entity_id, canonical_rows.id) AS canonical_entity_id
  FROM entity_pipeline_runs run_rows
  LEFT JOIN cached_entities cache_rows
    ON (
      run_rows.entity_id = cache_rows.id::text
      OR run_rows.entity_id = cache_rows.neo4j_id::text
      OR NULLIF(BTRIM(cache_rows.properties->>'supabase_id'), '') = run_rows.entity_id
      OR NULLIF(BTRIM(cache_rows.properties->>'uuid'), '') = run_rows.entity_id
      OR NULLIF(BTRIM(cache_rows.properties->>'canonical_entity_id'), '') = run_rows.entity_id
    )
  LEFT JOIN canonical_entities canonical_rows
    ON (
      run_rows.entity_id = canonical_rows.id::text
      OR run_rows.entity_id = ANY(canonical_rows.source_entity_ids)
      OR run_rows.entity_id = ANY(canonical_rows.source_neo4j_ids)
    )
  WHERE run_rows.canonical_entity_id IS NULL
    AND COALESCE(cache_rows.canonical_entity_id, canonical_rows.id) IS NOT NULL
) AS resolved
WHERE epr.id = resolved.run_id
  AND epr.canonical_entity_id IS NULL;

UPDATE entity_dossiers ed
SET canonical_entity_id = resolved.canonical_entity_id
FROM (
  SELECT
    dossier_rows.id AS dossier_id,
    COALESCE(cache_rows.canonical_entity_id, canonical_rows.id) AS canonical_entity_id
  FROM entity_dossiers dossier_rows
  LEFT JOIN cached_entities cache_rows
    ON (
      dossier_rows.entity_id = cache_rows.id::text
      OR dossier_rows.entity_id = cache_rows.neo4j_id::text
      OR NULLIF(BTRIM(cache_rows.properties->>'supabase_id'), '') = dossier_rows.entity_id
      OR NULLIF(BTRIM(cache_rows.properties->>'uuid'), '') = dossier_rows.entity_id
      OR NULLIF(BTRIM(cache_rows.properties->>'canonical_entity_id'), '') = dossier_rows.entity_id
    )
  LEFT JOIN canonical_entities canonical_rows
    ON (
      dossier_rows.entity_id = canonical_rows.id::text
      OR dossier_rows.entity_id = ANY(canonical_rows.source_entity_ids)
      OR dossier_rows.entity_id = ANY(canonical_rows.source_neo4j_ids)
    )
  WHERE dossier_rows.canonical_entity_id IS NULL
    AND COALESCE(cache_rows.canonical_entity_id, canonical_rows.id) IS NOT NULL
) AS resolved
WHERE ed.id = resolved.dossier_id
  AND ed.canonical_entity_id IS NULL;
