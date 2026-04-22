-- Add priority_score and entity_category columns to canonical_entities
-- Backfilled from cached_entities via the canonical_entity_id link

ALTER TABLE canonical_entities
  ADD COLUMN IF NOT EXISTS priority_score INTEGER,
  ADD COLUMN IF NOT EXISTS entity_category TEXT;

-- Backfill from cached_entities
UPDATE canonical_entities c
SET
  priority_score = ce.priority_score::int,
  entity_category = ce.entity_category
FROM cached_entities ce
WHERE ce.canonical_entity_id = c.id
  AND ce.priority_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_entities_priority_score
  ON canonical_entities(priority_score)
  WHERE priority_score IS NOT NULL;
