CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE cached_entities
  ADD COLUMN IF NOT EXISTS uuid TEXT;

UPDATE cached_entities
SET uuid = COALESCE(
  NULLIF(BTRIM(uuid), ''),
  NULLIF(BTRIM(properties->>'uuid'), ''),
  NULLIF(BTRIM(properties->>'entity_uuid'), ''),
  uuid_generate_v5(
    'f5c2b2b8-9cf2-4e66-a1c2-38cde7bc3f4e'::uuid,
    COALESCE(
      NULLIF(BTRIM(properties->>'supabase_id'), ''),
      NULLIF(BTRIM(graph_id::text), ''),
      NULLIF(BTRIM(neo4j_id::text), ''),
      NULLIF(BTRIM(id::text), ''),
      COALESCE(BTRIM(properties->>'type'), '') || '|' || COALESCE(BTRIM(properties->>'name'), '')
    )
  )::text
)
WHERE uuid IS NULL OR BTRIM(uuid) = '';

UPDATE cached_entities
SET properties = jsonb_set(
  COALESCE(properties, '{}'::jsonb),
  '{uuid}',
  to_jsonb(uuid),
  true
)
WHERE uuid IS NOT NULL
  AND BTRIM(uuid) <> ''
  AND (properties->>'uuid' IS DISTINCT FROM uuid OR properties->>'uuid' IS NULL);

CREATE INDEX IF NOT EXISTS idx_cached_entities_uuid
  ON cached_entities(uuid);
