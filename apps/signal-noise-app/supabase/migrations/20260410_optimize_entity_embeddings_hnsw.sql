-- Optimize entity vector search for recall and latency.
-- Supabase/pgvector guidance favors HNSW for better query performance and recall
-- than IVFFlat, especially when paired with cosine distance and a direct ORDER BY
-- on the distance operator.

DROP INDEX IF EXISTS public.idx_entity_embeddings_embedding;

CREATE INDEX IF NOT EXISTS idx_entity_embeddings_embedding_hnsw
ON public.entity_embeddings
USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_entities(
  query_embedding vector,
  entity_types character varying[] DEFAULT NULL::character varying[],
  match_threshold double precision DEFAULT 0.2,
  match_count integer DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  entity_id character varying,
  entity_type character varying,
  name character varying,
  description text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Keep HNSW search reasonably broad without sacrificing ordering.
  PERFORM set_config('hnsw.ef_search', '64', true);
  PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);

  RETURN QUERY
  SELECT
    e.id,
    e.entity_id,
    e.entity_type,
    e.name,
    e.description,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM entity_embeddings e
  WHERE
    (entity_types IS NULL OR e.entity_type = ANY(entity_types))
    AND (e.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
