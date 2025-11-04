-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for storing documents with embeddings
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a table for entity embeddings (sports entities, clubs, etc.)
CREATE TABLE IF NOT EXISTS entity_embeddings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- club, sportsperson, poi, tender, contact
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb, -- store additional entity data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, entity_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_embedding ON entity_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_entity_type ON entity_embeddings (entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_name ON entity_embeddings (name);

-- Function to perform similarity search on documents
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 10,
  min_content_length int DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    AND LENGTH(d.content) >= min_content_length
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to perform similarity search on entities
CREATE OR REPLACE FUNCTION match_entities (
  query_embedding vector(1536),
  entity_types VARCHAR(50)[] DEFAULT NULL,
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  entity_id VARCHAR(255),
  entity_type VARCHAR(50),
  name VARCHAR(255),
  description TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
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
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (entity_types IS NULL OR e.entity_type = ANY(entity_types))
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to insert or update entity embedding
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

-- Function to get entity statistics
CREATE OR REPLACE FUNCTION get_entity_stats ()
RETURNS TABLE (
  entity_type VARCHAR(50),
  count BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    entity_type,
    COUNT(*) as count,
    MAX(updated_at) as last_updated
  FROM entity_embeddings
  GROUP BY entity_type
  ORDER BY count DESC;
END;
$$;

-- Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_embeddings_updated_at BEFORE UPDATE ON entity_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();