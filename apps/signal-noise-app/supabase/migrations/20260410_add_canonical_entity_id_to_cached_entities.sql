ALTER TABLE cached_entities
  ADD COLUMN IF NOT EXISTS canonical_entity_id UUID;

CREATE INDEX IF NOT EXISTS idx_cached_entities_canonical_entity_id
  ON cached_entities(canonical_entity_id);

UPDATE cached_entities ce
SET canonical_entity_id = c.id
FROM canonical_entities c
WHERE ce.canonical_entity_id IS NULL
  AND (
    ce.neo4j_id = ANY(c.source_neo4j_ids)
    OR ce.graph_id = ANY(c.source_graph_ids)
    OR ce.id::text = ANY(c.source_entity_ids)
    OR NULLIF(BTRIM(ce.properties->>'supabase_id'), '') = ANY(c.source_entity_ids)
    OR NULLIF(BTRIM(ce.properties->>'uuid'), '') = ANY(c.source_entity_ids)
  );

UPDATE cached_entities
SET properties = jsonb_set(
  COALESCE(properties, '{}'::jsonb),
  '{canonical_entity_id}',
  to_jsonb(canonical_entity_id),
  true
)
WHERE canonical_entity_id IS NOT NULL
  AND (properties->>'canonical_entity_id' IS DISTINCT FROM canonical_entity_id::text OR properties->>'canonical_entity_id' IS NULL);

CREATE OR REPLACE FUNCTION set_cached_entity_canonical_entity_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  matched_canonical_id UUID;
BEGIN
  SELECT c.id
  INTO matched_canonical_id
  FROM canonical_entities c
  WHERE (
    NEW.neo4j_id = ANY(c.source_neo4j_ids)
    OR NEW.graph_id = ANY(c.source_graph_ids)
    OR NEW.id::text = ANY(c.source_entity_ids)
    OR NULLIF(BTRIM(NEW.properties->>'supabase_id'), '') = ANY(c.source_entity_ids)
    OR NULLIF(BTRIM(NEW.properties->>'uuid'), '') = ANY(c.source_entity_ids)
  )
  ORDER BY c.quality_score DESC, c.alias_count DESC, c.updated_at DESC
  LIMIT 1;

  NEW.canonical_entity_id := COALESCE(NEW.canonical_entity_id, matched_canonical_id);

  IF NEW.canonical_entity_id IS NOT NULL THEN
    NEW.properties := jsonb_set(
      COALESCE(NEW.properties, '{}'::jsonb),
      '{canonical_entity_id}',
      to_jsonb(NEW.canonical_entity_id),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cached_entities_set_canonical_entity_id ON cached_entities;

CREATE TRIGGER trg_cached_entities_set_canonical_entity_id
BEFORE INSERT OR UPDATE ON cached_entities
FOR EACH ROW
EXECUTE FUNCTION set_cached_entity_canonical_entity_id();

