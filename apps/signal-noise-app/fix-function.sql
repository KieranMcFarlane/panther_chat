-- Fix the ambiguous column reference issue
CREATE OR REPLACE FUNCTION upsert_entity_embedding (
  p_entity_id VARCHAR(255),
  p_entity_type VARCHAR(50),
  p_name VARCHAR(255),
  p_embedding vector(1536),
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO entity_embeddings (entity_id, entity_type, name, description, embedding, metadata)
  VALUES (p_entity_id, p_entity_type, p_name, p_description, p_embedding, p_metadata)
  ON CONFLICT (entity_id, entity_type)
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING entity_embeddings.id, entity_embeddings.created_at, entity_embeddings.updated_at;
END;
$$;