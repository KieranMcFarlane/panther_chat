-- Migration: Add signal_category to temporal_episodes
-- Description: Add signal_category column for temporal intelligence categorization

-- Add signal_category column
ALTER TABLE temporal_episodes
ADD COLUMN IF NOT EXISTS signal_category VARCHAR(50);

-- Create index on signal_category for fast queries
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_signal_category
ON temporal_episodes(signal_category);

-- Create composite index for entity + category queries
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_entity_category
ON temporal_episodes(entity_id, signal_category);

-- Create index for category-only queries (used in global priors)
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_category_only
ON temporal_episodes(signal_category);

-- Add comment for documentation
COMMENT ON COLUMN temporal_episodes.signal_category IS 'Canonical signal category (CRM, TICKETING, DATA_PLATFORM, etc.) for temporal intelligence';

-- Migration notes:
-- - Run the Python migration script to backfill existing episodes
-- - See scripts/migrate_add_signal_category.py
