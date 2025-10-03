-- Dossier System Tables for Supabase
-- These tables support the entity intelligence dossier system

-- Entity Dossiers Table
CREATE TABLE IF NOT EXISTS entity_dossiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id TEXT NOT NULL,
  dossier_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT entity_dossiers_entity_id_key UNIQUE (entity_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entity_dossiers_entity_id ON entity_dossiers(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_dossiers_created_at ON entity_dossiers(created_at);

-- Events Table for signals and intelligence data
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  source TEXT DEFAULT 'manual',
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT events_entity_id_check CHECK (entity_id IS NOT NULL AND entity_id != '')
);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_entity_id ON events(entity_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_received_at ON events(received_at);
CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);

-- Person of Interest Tracking
CREATE TABLE IF NOT EXISTS person_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'email', 'meeting', 'call', etc.
  interaction_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT person_interactions_unique UNIQUE (entity_id, person_id, interaction_type, created_at)
);

-- Create indexes for person interactions
CREATE INDEX IF NOT EXISTS idx_person_interactions_entity_id ON person_interactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_person_interactions_person_id ON person_interactions(person_id);

-- Dossier Generation Cache
CREATE TABLE IF NOT EXISTS dossier_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cache_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for cache expiration
CREATE INDEX IF NOT EXISTS idx_dossier_cache_expires_at ON dossier_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dossier_cache_key ON dossier_cache(cache_key);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE entity_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all operations for service role)
CREATE POLICY "Allow all operations for service role" ON entity_dossiers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow all operations for service role" ON events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow all operations for service role" ON person_interactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow all operations for service role" ON dossier_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_entity_dossiers_updated_at
  BEFORE UPDATE ON entity_dossiers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM dossier_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired cache (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-dossier-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');

-- Comments for documentation
COMMENT ON TABLE entity_dossiers IS 'Stores generated intelligence dossiers for entities';
COMMENT ON TABLE events IS 'Stores signals and events related to entities for intelligence analysis';
COMMENT ON TABLE person_interactions IS 'Tracks interactions with persons of interest';
COMMENT ON TABLE dossier_cache IS 'Cache for frequently accessed dossier data';