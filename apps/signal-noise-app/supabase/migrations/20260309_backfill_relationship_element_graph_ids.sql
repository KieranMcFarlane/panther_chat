begin;

update entity_relationships
set
  source_element_id = coalesce(source_graph_id, source_neo4j_id::text, source_element_id),
  target_element_id = coalesce(target_graph_id, target_neo4j_id::text, target_element_id)
where
  source_element_id is distinct from coalesce(source_graph_id, source_neo4j_id::text, source_element_id)
  or target_element_id is distinct from coalesce(target_graph_id, target_neo4j_id::text, target_element_id);

commit;
