-- Speed up dossier/pipeline temporal episode lookups.
--
-- The worker/backend repeatedly checks for existing temporal episodes by
-- entity_id, episode_type, and JSON metadata containment. Without these
-- indexes, local Postgres can spend minutes scanning temporal_episodes during
-- dossier generation.

create index concurrently if not exists temporal_episodes_entity_type_idx
  on temporal_episodes (entity_id, episode_type);

create index concurrently if not exists temporal_episodes_metadata_gin_idx
  on temporal_episodes using gin (metadata jsonb_path_ops);

