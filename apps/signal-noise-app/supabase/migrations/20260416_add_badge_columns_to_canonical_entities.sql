-- Add badge_path and badge_s3_url as real columns on canonical_entities
-- Backfilled from properties JSONB

ALTER TABLE canonical_entities
  ADD COLUMN IF NOT EXISTS badge_path TEXT,
  ADD COLUMN IF NOT EXISTS badge_s3_url TEXT;

-- Backfill from properties JSONB where columns are null
UPDATE canonical_entities
SET
  badge_path = properties->>'badge_path',
  badge_s3_url = properties->>'badge_s3_url'
WHERE badge_path IS NULL
  AND properties ? 'badge_path';
