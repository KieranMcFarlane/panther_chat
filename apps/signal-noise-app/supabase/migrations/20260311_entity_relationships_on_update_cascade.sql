begin;

alter table if exists entity_relationships
  drop constraint if exists fk_source_entity;

alter table if exists entity_relationships
  add constraint fk_source_entity
  foreign key (source_neo4j_id)
  references cached_entities(neo4j_id)
  on update cascade
  on delete cascade;

alter table if exists entity_relationships
  drop constraint if exists fk_target_entity;

alter table if exists entity_relationships
  add constraint fk_target_entity
  foreign key (target_neo4j_id)
  references cached_entities(neo4j_id)
  on update cascade
  on delete cascade;

commit;
