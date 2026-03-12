begin;

update cached_entities
set properties = properties - 'neo4j_id' - 'supabase_id' - 'id'
where properties ?| array['neo4j_id', 'supabase_id', 'id'];

commit;
