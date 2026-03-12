alter table if exists cached_entities
  add column if not exists graph_id text;

update cached_entities
set graph_id = coalesce(graph_id, neo4j_id::text)
where graph_id is null
  and neo4j_id is not null;

create unique index if not exists cached_entities_graph_id_key
  on cached_entities (graph_id)
  where graph_id is not null;

alter table if exists entity_relationships
  add column if not exists source_graph_id text,
  add column if not exists target_graph_id text;

update entity_relationships
set source_graph_id = coalesce(source_graph_id, source_neo4j_id::text),
    target_graph_id = coalesce(target_graph_id, target_neo4j_id::text)
where source_graph_id is null
   or target_graph_id is null;

create index if not exists entity_relationships_source_graph_id_idx
  on entity_relationships (source_graph_id);

create index if not exists entity_relationships_target_graph_id_idx
  on entity_relationships (target_graph_id);

alter table if exists entity_sync_tracker
  add column if not exists graph_id text;

update entity_sync_tracker
set graph_id = coalesce(graph_id, neo4j_id::text)
where graph_id is null
  and neo4j_id is not null;

create unique index if not exists entity_sync_tracker_graph_id_key
  on entity_sync_tracker (graph_id)
  where graph_id is not null;
