-- Phase 2 congruence: canonical IDs across relationships + team/league linkage

ALTER TABLE IF EXISTS canonical_entities
  ADD COLUMN IF NOT EXISTS league_canonical_entity_id UUID,
  ADD COLUMN IF NOT EXISTS parent_canonical_entity_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'canonical_entities'
  ) THEN
    BEGIN
      ALTER TABLE canonical_entities
        ADD CONSTRAINT canonical_entities_league_canonical_fk
        FOREIGN KEY (league_canonical_entity_id)
        REFERENCES canonical_entities(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TABLE canonical_entities
        ADD CONSTRAINT canonical_entities_parent_canonical_fk
        FOREIGN KEY (parent_canonical_entity_id)
        REFERENCES canonical_entities(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS canonical_entities_league_canonical_idx
  ON canonical_entities (league_canonical_entity_id);

CREATE INDEX IF NOT EXISTS canonical_entities_parent_canonical_idx
  ON canonical_entities (parent_canonical_entity_id);

ALTER TABLE IF EXISTS entity_relationships
  ADD COLUMN IF NOT EXISTS source_canonical_entity_id UUID,
  ADD COLUMN IF NOT EXISTS target_canonical_entity_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'entity_relationships'
  ) THEN
    BEGIN
      ALTER TABLE entity_relationships
        ADD CONSTRAINT entity_relationships_source_canonical_fk
        FOREIGN KEY (source_canonical_entity_id)
        REFERENCES canonical_entities(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TABLE entity_relationships
        ADD CONSTRAINT entity_relationships_target_canonical_fk
        FOREIGN KEY (target_canonical_entity_id)
        REFERENCES canonical_entities(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS entity_relationships_source_canonical_idx
  ON entity_relationships (source_canonical_entity_id);

CREATE INDEX IF NOT EXISTS entity_relationships_target_canonical_idx
  ON entity_relationships (target_canonical_entity_id);
